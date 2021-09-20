/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

/* eslint-disable @typescript-eslint/no-explicit-any */

import { IWebSocket } from 'vscode-ws-jsonrpc/lib/socket/socket';
import { Disposable, DisposableCollection } from '../disposable';
import { Emitter } from '../event';

export class WebSocketChannel implements IWebSocket {

    static wsPath = '/services';

    protected readonly closeEmitter = new Emitter<[number, string]>();
    protected readonly toDispose = new DisposableCollection(this.closeEmitter);

    constructor(
        readonly id: number,
        protected readonly doSend: (content: string) => void
    ) { }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected checkNotDisposed(): void {
        if (this.toDispose.disposed) {
            throw new Error('The channel has been disposed.');
        }
    }

    handleMessage(message: WebSocketChannel.Message): void {
        if (message.kind === 'ready') {
            this.fireOpen();
        } else if (message.kind === 'data') {
            this.fireMessage(message.content);
        } else if (message.kind === 'close') {
            this.fireClose(message.code, message.reason);
        }
    }

    open(path: string): void {
        this.checkNotDisposed();
        const openMessage = 'o' + this.id + ';' + path;
        this.doSend(openMessage);
    }

    ready(): void {
        this.checkNotDisposed();
        const readyMessage = 'r' + this.id + ';';
        this.doSend(readyMessage);
    }

    send(content: string): void {
        this.checkNotDisposed();
        const dataMessage = 'd' + this.id + ';' + content;
        this.doSend(dataMessage);
    }

    close(code: number = 1000, reason: string = ''): void {
        if (this.closing) {
            // Do not try to close the channel if it is already closing.
            return;
        }
        this.checkNotDisposed();

        const closeMessage = 'c' + this.id + ';' + code + ';' + reason;
        this.doSend(closeMessage);
        this.fireClose(code, reason);
    }

    tryClose(code: number = 1000, reason: string = ''): void {
        if (this.closing || this.toDispose.disposed) {
            // Do not try to close the channel if it is already closing or disposed.
            return;
        }
        const closeMessage = 'c' + this.id + ';' + code + ';' + reason;
        this.doSend(closeMessage);
        this.fireClose(code, reason);
    }

    protected fireOpen: () => void = () => { };
    onOpen(cb: () => void): void {
        this.checkNotDisposed();
        this.fireOpen = cb;
        this.toDispose.push(Disposable.create(() => this.fireOpen = () => { }));
    }

    protected fireMessage: (data: any) => void = () => { };
    onMessage(cb: (data: any) => void): void {
        this.checkNotDisposed();
        this.fireMessage = cb;
        this.toDispose.push(Disposable.create(() => this.fireMessage = () => { }));
    }

    fireError: (reason: any) => void = () => { };
    onError(cb: (reason: any) => void): void {
        this.checkNotDisposed();
        this.fireError = cb;
        this.toDispose.push(Disposable.create(() => this.fireError = () => { }));
    }

    protected closing = false;
    protected fireClose(code: number, reason: string): void {
        if (this.closing) {
            return;
        }
        this.closing = true;
        try {
            this.closeEmitter.fire([code, reason]);
        } finally {
            this.closing = false;
        }
        this.dispose();
    }
    onClose(cb: (code: number, reason: string) => void): Disposable {
        this.checkNotDisposed();
        return this.closeEmitter.event(([code, reason]) => cb(code, reason));
    }
}
export namespace WebSocketChannel {
    export interface OpenMessage {
        kind: 'open'
        id: number
        path: string
    }
    export interface ReadyMessage {
        kind: 'ready'
        id: number
    }
    export interface DataMessage {
        kind: 'data'
        id: number
        content: string
    }
    export interface CloseMessage {
        kind: 'close'
        id: number
        code: number
        reason: string
    }

    export type Message = OpenMessage | ReadyMessage | DataMessage | CloseMessage;

    export function parseMessage(content: string): Message {
        const semiIndex = content.indexOf(';');
        const id = content.substring(1, semiIndex);
        switch (content.charAt(0)) {
            case 'o': {
                const path = content.substring(semiIndex + 1);
                return {
                    kind: 'open',
                    id: Number.parseInt(id),
                    path: path
                };
            }
            case 'r': {
                return {
                    kind: 'ready',
                    id: Number.parseInt(id)
                };
            }
            case 'd': {
                return {
                    kind: 'data',
                    id: Number.parseInt(id),
                    content: content.substring(semiIndex + 1)
                };
            }
            case 'c': {
                const secondIndex = content.indexOf(';', semiIndex + 1);
                return {
                    kind: 'close',
                    id: Number.parseInt(id),
                    code: Number.parseInt(content.substring(semiIndex + 1, secondIndex)),
                    reason: content.substring(secondIndex + 1)
                };
            }
        }
        throw new Error(`unknown message type: '${content.charAt(0)}''`);
    }
}
