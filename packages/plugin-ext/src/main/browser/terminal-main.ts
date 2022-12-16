// *****************************************************************************
// Copyright (C) 2018 Red Hat, Inc. and others.
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
// *****************************************************************************

import { interfaces } from '@theia/core/shared/inversify';
import { ApplicationShell, WidgetOpenerOptions } from '@theia/core/lib/browser';
import { TerminalOptions } from '@theia/plugin';
import { CancellationToken } from '@theia/core/shared/vscode-languageserver-protocol';
import { TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalProfileService } from '@theia/terminal/lib/browser/terminal-profile-service';
import { TerminalServiceMain, TerminalServiceExt, MAIN_RPC_CONTEXT } from '../../common/plugin-api-rpc';
import { RPCProtocol } from '../../common/rpc-protocol';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { SerializableEnvironmentVariableCollection } from '@theia/terminal/lib/common/base-terminal-protocol';
import { IShellTerminalServerOptions, ShellTerminalServerProxy } from '@theia/terminal/lib/common/shell-terminal-protocol';
import { TerminalLink, TerminalLinkProvider } from '@theia/terminal/lib/browser/terminal-link-provider';
import { Pseudoterminal, TerminalDimensions } from '@theia/terminal/lib/browser/base/pseudoterminal';
import { Event } from '@theia/core';
import { ShellPtyFactory } from '@theia/terminal/lib/browser/shell-pty-factory';

/**
 * Plugin api service allows working with terminal emulator.
 */
export class TerminalServiceMainImpl implements TerminalServiceMain, TerminalLinkProvider, Disposable {

    private readonly terminals: TerminalService;
    private readonly terminalProfileService: TerminalProfileService;
    private readonly shell: ApplicationShell;
    private readonly extProxy: TerminalServiceExt;
    private readonly shellTerminalServer: ShellTerminalServerProxy;
    private readonly shellPtyFactory: ShellPtyFactory;
    private readonly terminalLinkProviders: string[] = [];

    private readonly toDispose = new DisposableCollection();

    constructor(rpc: RPCProtocol, container: interfaces.Container) {
        this.terminals = container.get(TerminalService);
        this.terminalProfileService = container.get(TerminalProfileService);
        this.shell = container.get(ApplicationShell);
        this.shellTerminalServer = container.get(ShellTerminalServerProxy);
        this.shellPtyFactory = container.get(ShellPtyFactory);
        this.extProxy = rpc.getProxy(MAIN_RPC_CONTEXT.TERMINAL_EXT);
        this.toDispose.push(this.terminals.onDidCreateTerminal(terminal => this.trackTerminal(terminal)));
        for (const terminal of this.terminals.all) {
            this.trackTerminal(terminal);
        }
        this.toDispose.push(this.terminals.onDidChangeCurrentTerminal(() => this.updateCurrentTerminal()));
        this.updateCurrentTerminal();
        if (this.shellTerminalServer.collections.size > 0) {
            const collectionAsArray = [...this.shellTerminalServer.collections.entries()];
            const serializedCollections: [string, SerializableEnvironmentVariableCollection][] = collectionAsArray.map(e => [e[0], [...e[1].map.entries()]]);
            this.extProxy.$initEnvironmentVariableCollections(serializedCollections);
        }

        container.bind(TerminalLinkProvider).toDynamicValue(() => this);
    }
    async $registerTerminalProfileProvider(providerId: string, profileId: string): Promise<void> {
        return this.terminalProfileService.registerTerminalProfile(profileId, {
            label: profileId,
            start(): TerminalWidget | undefined {
                return undefined;
            }
        });
    }
    $unregisterTerminalProfileProvider(providerId: string): Promise<void> {
        throw new Error('Method not implemented.');
    }

    $setEnvironmentVariableCollection(extensionIdentifier: string, persistent: boolean, collection: SerializableEnvironmentVariableCollection | undefined): void {
        if (collection) {
            this.shellTerminalServer.setCollection(extensionIdentifier, persistent, collection);
        } else {
            this.shellTerminalServer.deleteCollection(extensionIdentifier);
        }
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected updateCurrentTerminal(): void {
        const { currentTerminal } = this.terminals;
        this.extProxy.$currentTerminalChanged(currentTerminal && currentTerminal.id);
    }

    protected async trackTerminal(terminal: TerminalWidget): Promise<void> {
        let name = terminal.title.label;
        this.extProxy.$terminalCreated(terminal.id, name);
        const updateTitle = () => {
            if (name !== terminal.title.label) {
                name = terminal.title.label;
                this.extProxy.$terminalNameChanged(terminal.id, name);
            }
        };
        terminal.title.changed.connect(updateTitle);
        this.toDispose.push(Disposable.create(() => terminal.title.changed.disconnect(updateTitle)));

        this.toDispose.push(terminal.onTerminalDidClose(term => this.extProxy.$terminalClosed(term.id, term.exitStatus)));
        this.toDispose.push(terminal.onSizeChanged(({ cols, rows }) => {
            this.extProxy.$terminalSizeChanged(terminal.id, cols, rows);
        }));
        this.toDispose.push(terminal.onData(data => {
            this.extProxy.$terminalOnInput(terminal.id, data);
            this.extProxy.$terminalStateChanged(terminal.id);
        }));
    }

    $write(id: string, data: string): void {
        const terminal = this.terminals.getById(id);
        if (!terminal) {
            return;
        }
        terminal.write(data);
    }
    $resize(id: string, cols: number, rows: number): void {
        const terminal = this.terminals.getById(id);
        if (!terminal) {
            return;
        }
        terminal.resize(cols, rows);
    }

    async $createExtensionTerminal(id: string, name: string): Promise<void> {
        const terminal = await this.terminals.newTerminal({
            title: name,
            destroyTermOnClose: true,
            useServerTitle: false
        });
        terminal.start(() => Promise.resolve(new ExtensionPty(id, this.extProxy)));
    }

    async $createShellTerminal(options: TerminalOptions): Promise<string> {
        try {
            const terminal = await this.terminals.newTerminal({
                title: options.name,
                destroyTermOnClose: true,
                useServerTitle: false,
                attributes: options.attributes,
                hideFromUser: options.hideFromUser,
            });
            if (options.message) {
                terminal.writeLine(options.message);
            }

            const shellArgs: IShellTerminalServerOptions = {
                shell: options.shellPath,
                args: options.shellArgs,
                env: options.env,
                rootURI: options.cwd ? options.cwd.toString() : undefined,
                strictEnv: options.strictEnv,
            };

            return (await terminal.start(() => this.shellPtyFactory.createPty(shellArgs))).id;
        } catch (error) {
            throw new Error('Failed to create terminal. Cause: ' + error);
        }
    }

    $sendText(id: string, text: string, addNewLine?: boolean): void {
        const terminal = this.terminals.getById(id);
        if (terminal) {
            text = text.replace(/\r?\n/g, '\r');
            if (addNewLine && text.charAt(text.length - 1) !== '\r') {
                text += '\r';
            }
            terminal.sendText(text);
        }
    }

    $show(id: string, preserveFocus?: boolean): void {
        const terminal = this.terminals.getById(id);
        if (terminal) {
            const options: WidgetOpenerOptions = {};
            if (preserveFocus) {
                options.mode = 'reveal';
            }
            this.terminals.open(terminal, options);
        }
    }

    $hide(id: string): void {
        const terminal = this.terminals.getById(id);
        if (terminal && terminal.isVisible) {
            const area = this.shell.getAreaFor(terminal);
            if (area) {
                this.shell.collapsePanel(area);
            }
        }
    }

    $dispose(id: string): void {
        const terminal = this.terminals.getById(id);
        if (terminal) {
            terminal.dispose();
        }
    }

    $setName(id: string, name: string): void {
        this.terminals.getById(id)?.setTitle(name);
    }

    async $registerTerminalLinkProvider(providerId: string): Promise<void> {
        this.terminalLinkProviders.push(providerId);
    }

    async $unregisterTerminalLinkProvider(providerId: string): Promise<void> {
        const index = this.terminalLinkProviders.indexOf(providerId);
        if (index > -1) {
            this.terminalLinkProviders.splice(index, 1);
        }
    }

    async provideLinks(line: string, terminal: TerminalWidget, cancelationToken?: CancellationToken | undefined): Promise<TerminalLink[]> {
        if (this.terminalLinkProviders.length < 1) {
            return [];
        }
        const links = await this.extProxy.$provideTerminalLinks(line, terminal.id, cancelationToken ?? CancellationToken.None);
        return links.map(link => ({ ...link, handle: () => this.extProxy.$handleTerminalLink(link) }));
    }

}
class ExtensionPty implements Pseudoterminal {
    constructor(readonly id: string, protected readonly terminalExt: TerminalServiceExt) { }

    onDidWrite: Event<string>;
    sendText(data: string): void {
        this.terminalExt.$terminalOnInput(this.id, data);
    }
    setDimensions(dimensions: TerminalDimensions): void {
        this.terminalExt.$terminalSizeChanged(this.id, dimensions.cols, dimensions.rows);
    }

    onDidChangeDimensions?: Event<TerminalDimensions | undefined> | undefined;

    close(): void {
        this.terminalExt.$terminalClosed(this.id, undefined);
    }

    dispose(): void {
        throw new Error('Method not implemented.');
    }

    onDisposed: Event<number | undefined>;

    hasChildProcesses(): Promise<boolean> {
        return Promise.resolve(true);
    }
}
