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

import { Event } from '..';
import { BinaryBuffer } from '../buffer';
import { Disposable, DisposableCollection } from '../disposable';
import { Emitter } from '../event';
import { MessageWriter, MessageReader } from './rpc-protocol';

/**
 * A closeable channel to send messages over with error/close handling
 */
export interface Channel {
    send(content: Uint8Array): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMessage: Event<Uint8Array>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: Event<any>
    onClose: Event<void>;
    close(): void;
}

export class WebSocketChannel implements Channel {

    static wsPath = '/services';

    protected readonly closeEmitter = new Emitter<void>();
    protected readonly errorEmitter = new Emitter<any>();
    protected readonly toDispose = new DisposableCollection(this.closeEmitter);

    protected readonly messageEmitter = new Emitter<Uint8Array>();

    constructor(
        readonly id: number,
        protected readonly doSend: (content: Uint8Array) => void
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
            this.messageEmitter.fire(message.content);
        } else if (message.kind === 'close') {
            this.fireClose(message.code, message.reason);
        }
    }

    open(path: string): void {
        this.checkNotDisposed();
        const buf = new MessageWriter(() => { });
        buf.writeString('open');
        buf.writeUint32(this.id);
        buf.writeString(path);
        this.doSend(buf.toMessage());
    }

    ready(): void {
        this.checkNotDisposed();
        const buf = new MessageWriter(() => { });
        buf.writeString('ready');
        buf.writeUint32(this.id);
        this.doSend(buf.toMessage());
    }

    send(content: Uint8Array): void {
        this.checkNotDisposed();
        const buf = new MessageWriter(() => { });
        buf.writeString('data');
        buf.writeUint32(this.id);
        buf.writeByteArray(content);
        this.doSend(buf.toMessage());
    }

    close(code: number = 1000, reason: string = ''): void {
        if (this.closing) {
            // Do not try to close the channel if it is already closing.
            return;
        }
        this.checkNotDisposed();
        const buf = new MessageWriter(() => { });
        buf.writeString('close');
        buf.writeUint32(this.id);
        buf.writeUint32(code);
        buf.writeString(reason);
        this.doSend(buf.toMessage());

        this.fireClose(code, reason);
    }

    fireError(err: any): void {
        this.errorEmitter.fire(err);
    }

    tryClose(code: number = 1000, reason: string = ''): void {
        if (this.closing || this.toDispose.disposed) {
            // Do not try to close the channel if it is already closing or disposed.
            return;
        }
        this.checkNotDisposed();
        const buf = new MessageWriter(() => { });
        buf.writeString('close');
        buf.writeUint32(this.id);
        buf.writeUint32(code);
        buf.writeString(reason);
        this.doSend(buf.toMessage());

        this.fireClose(code, reason);
    }

    protected fireOpen: () => void = () => { };
    onOpen(cb: () => void): void {
        this.checkNotDisposed();
        this.fireOpen = cb;
        this.toDispose.push(Disposable.create(() => this.fireOpen = () => { }));
    }

    get onMessage(): Event<Uint8Array> {
        return this.messageEmitter.event;
    }

    get onError(): Event<any> {
        return this.errorEmitter.event;
    }

    protected closing = false;
    protected fireClose(code: number, reason: string): void {
        if (this.closing) {
            return;
        }
        this.closing = true;
        try {
            this.closeEmitter.fire();
        } finally {
            this.closing = false;
        }
        this.dispose();
    }
    get onClose(): Event<void> {
        return this.closeEmitter.event;
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
        content: Uint8Array
    }
    export interface CloseMessage {
        kind: 'close'
        id: number
        code: number
        reason: string
    }
    export type Message = OpenMessage | ReadyMessage | DataMessage | CloseMessage;

    export function parse(buf: Uint8Array): Message {
        const reader = new MessageReader(o => o, BinaryBuffer.wrap(buf));
        const type = reader.readString();
        const id = reader.readUint32();
        switch (type) {
            case 'open': {
                const path = reader.readString();
                return {
                    kind: type,
                    id: id,
                    path: path
                };
            }
            case 'ready': {
                return {
                    kind: type,
                    id: id
                };
            }
            case 'close': {
                const code = reader.readUint32();
                const reason = reader.readString();

                return {
                    kind: type,
                    id: id,
                    code: code,
                    reason: reason
                };
            }
            case 'data': {
                const data = reader.readByteArray();
                return {
                    kind: type,
                    id: id,
                    content: data
                };
            }
        }
        throw new Error(`Unknown message type read: ${type}`);
    }
}
