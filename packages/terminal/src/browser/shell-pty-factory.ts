// *****************************************************************************
// Copyright (C) 2022 ST Microelectronics and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0

import { Channel, DisposableCollection, Event } from '@theia/core';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/shared/vscode-languageserver-protocol';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser';
import { IShellTerminalServerOptions, ShellTerminalServerProxy } from '../common/shell-terminal-protocol';
import { terminalsPath } from '../common/terminal-protocol';
import { TerminalWatcher } from '../common/terminal-watcher';
import { Pseudoterminal, TerminalDimensions } from './base/pseudoterminal';
import { IBaseTerminalServer } from '../common/base-terminal-protocol';
import { CommandLineOptions, ShellCommandBuilder } from '@theia/process/lib/common/shell-command-builder';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class ShellPtyFactory {

    @inject(TerminalWatcher)
    protected readonly terminaWatcher: TerminalWatcher;
    @inject(ShellTerminalServerProxy)
    protected readonly shellTerminalServer: ShellTerminalServerProxy;
    @inject(WebSocketConnectionProvider) protected readonly webSocketConnectionProvider: WebSocketConnectionProvider;
    @inject(ShellCommandBuilder) protected readonly shellCommandBuilder: ShellCommandBuilder;

    async createPty(shellOptions: IShellTerminalServerOptions): Promise<ShellPty> {
        const terminalId = await this.shellTerminalServer.create(shellOptions);
        return new ShellPty('shell-terminal' + terminalId, terminalId, this.webSocketConnectionProvider, this.shellTerminalServer,
            this.terminaWatcher, this.shellCommandBuilder).connect().then(async pty => {
                await this.shellTerminalServer.onAttachAttempted(terminalId);
                return pty;
            });
    }

    async attachPty(terminalId: number): Promise<ShellPty> {
        const id = await this.shellTerminalServer.attach(terminalId);
        if (IBaseTerminalServer.validateId(id)) {
            throw new Error(`Could not attach to shell terminal ${terminalId}`);
        }
        return new ShellPty('shell-terminal' + terminalId, terminalId, this.webSocketConnectionProvider, this.shellTerminalServer,
            this.terminaWatcher, this.shellCommandBuilder).connect();
    }
}

export class ShellPty implements Pseudoterminal {
    private onDidWriteEmitter = new Emitter<string>();
    onDidWrite: Event<string> = this.onDidWriteEmitter.event;
    protected channel: Channel | undefined;
    protected readonly toDispose = new DisposableCollection();

    constructor(
        readonly id: string,
        public readonly processId: number,
        protected readonly websocketConnectionProvider: WebSocketConnectionProvider,
        protected readonly terminalServer: ShellTerminalServerProxy,
        protected readonly terminalWatcher: TerminalWatcher,
        protected readonly shellCommandBuilder: ShellCommandBuilder) {

        this.toDispose.push(terminalWatcher.onTerminalExit(e => this.doDispose(e.code)));
        this.toDispose.push(terminalWatcher.onTerminalError(e => this.doDispose(undefined)));
        this.toDispose.push(this.terminalServer.onDidCloseConnection(() => {
            const disposable = this.terminalServer.onDidOpenConnection(() => {
                disposable.dispose();
                this.connect();
            });
            this.toDispose.push(disposable);
        }));
    }

    static is(pty: Pseudoterminal): pty is ShellPty {
        return pty instanceof ShellPty;
    }

    async executeCommand(commandOptions: CommandLineOptions): Promise<number | undefined> {
        const processInfo = await this.terminalServer.getProcessInfo(this.processId);
        this.sendText(this.shellCommandBuilder.buildCommand(processInfo, commandOptions) + '\n');
        return undefined;
    }

    sendText(data: string): void {
        if (this.channel) {
            this.channel.getWriteBuffer().writeString(data).commit();
        }
    }
    setDimensions(dimensions: TerminalDimensions): void {
        this.terminalServer.resize(this.processId, dimensions.cols, dimensions.rows);
    }

    onDidChangeDimensions?: Event<TerminalDimensions | undefined> | undefined;

    private onDisposedEmitter = new Emitter<number | undefined>();
    onDisposed: Event<number | undefined> = this.onDisposedEmitter.event;

    close(): void {
        this.terminalServer.close(this.processId);
        this.doDispose(undefined);
    }

    protected doDispose(exitCode: number | undefined): void {
        this.toDispose.dispose();
        this.onDisposedEmitter.fire(exitCode);
    }

    dispose(): void {
        this.doDispose(undefined);
    }

    connect(): Promise<ShellPty> {
        return new Promise((resolve, reject) => {
            this.websocketConnectionProvider.listen({
                path: `${terminalsPath}/${this.id}`,
                onConnection: connection => {
                    this.channel = connection;
                    this.channel.onMessage(e => this.onDidWriteEmitter.fire(e().readString()));
                    resolve(this);
                }
            }, { reconnecting: false });
        });
    }

    hasChildProcesses(): Promise<boolean> {
        return this.terminalServer.hasChildProcesses(this.processId);
    }

    get cwd(): Promise<URI> {
        if (!IBaseTerminalServer.validateId(this.processId)) {
            return Promise.reject(new Error('terminal is not started'));
        }
        return this.terminalServer.getCwdURI(this.processId).then(uri => new URI(uri));
    }
}
