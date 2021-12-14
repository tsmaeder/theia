/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
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
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// copied from https://github.com/Microsoft/vscode/blob/master/src/vs/workbench/services/extensions/node/rpcProtocol.ts
// with small modifications

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Emitter, Event } from '../event';
import { BinaryBuffer } from '../buffer';
import { Deferred } from '../promise-util';
import { WebSocketChannel } from './web-socket-channel';
import { CancellationError } from '../cancellation';

export interface RpcProtocol {
    sendRequest<T>(method: string, args: any[]): Promise<T>;
    sendNotification(method: string, args: any[]): void;
    readonly requestHandler: (method: string, args: any[]) => Promise<any>;
    onNotification: Event<{ method: string, args: any[] }>;
}

const identity = (key: string, value: any) => value;

export class RPCProtocolImpl implements RpcProtocol {
    protected readonly pendingRequests: Map<number, Deferred<any>> = new Map();
    protected nextMessageId: number = 0;

    protected onNotificationEmitter: Emitter<{ method: string; args: any[]; }> = new Emitter();
    get onNotification(): Event<{ method: string; args: any[]; }> {
        return this.onNotificationEmitter.event;
    }

    constructor(protected channel: WebSocketChannel, public readonly requestHandler: (method: string, args: any[]) => Promise<any>) {
        channel.onMessage(data => this.handleMessage(data));
    }

    handleMessage(data: Uint8Array): void {

        const message = MessageEncoder.parse(new MessageReader(identity, BinaryBuffer.wrap(data)));
        switch (message.type) {
            case MessageType.Cancel: {
                this.handleCancel(message.id);
                break;
            }
            case MessageType.Reply: {
                this.handleReply(message.id, message.res);
                break;
            }
            case MessageType.ReplyErr: {
                this.handleReplyErr(message.id, message.err);
                break;
            }
            case MessageType.Request: {
                this.handleRequest(message.id, message.method, message.args);
                break;
            }
            case MessageType.Notification: {
                this.handleNotify(message.id, message.method, message.args);
                break;
            }
        }
    }

    protected handleCancel(id: number): void {
        const replyHandler = this.pendingRequests.get(id);
        if (replyHandler) {
            this.pendingRequests.delete(id);
            replyHandler.reject(new CancellationError());
        } else {
            console.warn(`cancel: no handler for message: ${id}`);
        }
    }

    protected handleReply(id: number, value: any): void {
        const replyHandler = this.pendingRequests.get(id);
        // console.log(`received reply with id ${id}`);
        if (replyHandler) {
            this.pendingRequests.delete(id);
            replyHandler.resolve(value);
        } else {
            console.warn(`reply: no handler for message: ${id}`);
        }
    }

    protected handleReplyErr(id: number, error: any): void {
        const replyHandler = this.pendingRequests.get(id);
        if (replyHandler) {
            this.pendingRequests.delete(id);
            // console.log(`received error id ${id}`);
            replyHandler.reject(error);
        } else {
            console.warn(`error: no handler for message: ${id}`);
        }
    }

    protected withBuffer(fun: (buf: MessageWriter) => any): Uint8Array {
        const writer = new MessageWriter(identity);
        fun(writer);
        return writer.toMessage();
    }

    protected async handleRequest(id: number, method: string, args: any[]): Promise<void> {
        try {
            // console.log(`handling request ${method} with id ${id}`);
            const result = await this.requestHandler(method, args);
            this.channel.send(this.withBuffer(buf => MessageEncoder.replyOK(buf, id, result)));
            // console.log(`handled request ${method} with id ${id}`);
        } catch (err) {
            this.channel.send(this.withBuffer(buf => MessageEncoder.replyErr(buf, id, err)));
            console.log(`error on request ${method} with id ${id}`);
        }
    }

    protected async handleNotify(id: number, method: string, args: any[]): Promise<void> {
        // console.log(`handling notification ${method} with id ${id}`);
        this.onNotificationEmitter.fire({ method, args });
    }

    sendRequest<T>(method: string, args: any[]): Promise<T> {
        const id = this.nextMessageId++;
        const reply = new Deferred<T>();
        // console.log(`sending request ${method} with id ${id}`);

        this.pendingRequests.set(id, reply);
        this.channel.send(this.withBuffer(buf => MessageEncoder.request(buf, id, method, args)));
        return reply.promise;
    }

    sendNotification(method: string, args: any[]): void {
        // console.log(`sending notification ${method} with id ${this.nextMessageId + 1}`);
        this.channel.send(this.withBuffer(buf => MessageEncoder.notification(buf, this.nextMessageId++, method, args)));
    }
}

export const enum MessageType {
    Request = 1,
    Notification = 2,
    Reply = 3,
    ReplyErr = 4,
    Cancel = 5,
}

export class CancelMessage {
    type: MessageType.Cancel;
    id: number;
}

export class RequestMessage {
    type: MessageType.Request;
    id: number;
    method: string;
    args: any[];
}

export class NotificationMessage {
    type: MessageType.Notification;
    id: number;
    method: string;
    args: any[];
}

export class ReplyMessage {
    type: MessageType.Reply;
    id: number;
    res: any;
}

export class ReplyErrMessage {
    type: MessageType.ReplyErr;
    id: number;
    err: SerializedError;
}

export type RPCMessage = RequestMessage | ReplyMessage | ReplyErrMessage | CancelMessage | NotificationMessage;

export namespace MessageEncoder {
    export function parse(buf: MessageReader): RPCMessage {

        try {
            const msgType = buf.readByte();

            switch (msgType) {
                case MessageType.Request:
                    return parseRequest(buf);
                case MessageType.Notification:
                    return parseNotification(buf);
                case MessageType.Reply:
                    return parseReply(buf);
                case MessageType.ReplyErr:
                    return parseReplyErr(buf);
                case MessageType.Cancel:
                    return parseCancel(buf);
            }
            throw new Error(`Unknown message type: ${msgType}`);
        } catch (e) {
            // exception does not show problematic content: log it!
            console.log('failed to parse message: ' + buf);
            throw e;
        }
    }

    function parseCancel(msg: MessageReader): CancelMessage {
        const callId = msg.readUint32();
        return {
            type: MessageType.Cancel,
            id: callId
        };
    }

    function parseRequest(msg: MessageReader): RequestMessage {
        const callId = msg.readUint32();
        const method = msg.readString();
        let args = msg.readArray();
        // convert `null` to `undefined`, since we don't use `null` in internal plugin APIs
        args = args.map(arg => arg === null ? undefined : arg); // eslint-disable-line no-null/no-null

        return {
            type: MessageType.Request,
            id: callId,
            method: method,
            args: args
        };
    }

    function parseNotification(msg: MessageReader): NotificationMessage {
        const callId = msg.readUint32();
        const method = msg.readString();
        let args = msg.readArray();
        // convert `null` to `undefined`, since we don't use `null` in internal plugin APIs
        args = args.map(arg => arg === null ? undefined : arg); // eslint-disable-line no-null/no-null

        return {
            type: MessageType.Notification,
            id: callId,
            method: method,
            args: args
        };
    }

    function parseReply(msg: MessageReader): ReplyMessage {
        const callId = msg.readUint32();
        const value = msg.readTypedValue();
        return {
            type: MessageType.Reply,
            id: callId,
            res: value
        };
    }

    function parseReplyErr(msg: MessageReader): ReplyErrMessage {
        const callId = msg.readUint32();

        let err: any = msg.readTypedValue();
        if (err && err.$isError) {
            err = new Error();
            err.name = err.name;
            err.message = err.message;
            err.stack = err.stack;
        }
        return {
            type: MessageType.ReplyErr,
            id: callId,
            err: err
        };
    }

    export function cancel(buf: MessageWriter, requestId: number): void {
        buf.writeByte(MessageType.Cancel);
        buf.writeUint32(requestId);
    }

    export function notification(buf: MessageWriter, requestId: number, method: string, args: any[]): void {
        buf.writeByte(MessageType.Notification);
        buf.writeUint32(requestId);
        buf.writeString(method);
        buf.writeArray(args);
    }

    export function request(buf: MessageWriter, requestId: number, method: string, args: any[]): void {
        buf.writeByte(MessageType.Request);
        buf.writeUint32(requestId);
        buf.writeString(method);
        buf.writeArray(args);
    }

    export function replyOK(buf: MessageWriter, requestId: number, res: any): void {
        buf.writeByte(MessageType.Reply);
        buf.writeUint32(requestId);
        buf.writeTypedValue(res);
    }

    export function replyErr(buf: MessageWriter, requestId: number, err: any): void {
        buf.writeByte(MessageType.Reply);
        buf.writeUint32(requestId);
        buf.writeTypedValue(err);
    }
}

export interface SerializedError {
    readonly $isError: true;
    readonly name: string;
    readonly message: string;
    readonly stack: string;
}

enum ObjectType {
    JSON = 0,
    ByteArray = 1,
    ObjectArray = 2,
    Undefined = 3
}

export class MessageReader {

    constructor(private reviver: (key: string | undefined, value: any) => any, private msg: BinaryBuffer, private offset: number = 0) {
    }

    readByte(): number {
        return this.msg.readUInt8(this.offset++);
    }

    readUint32(): number {
        const result = this.msg.readUInt32LE(this.offset);
        this.offset += 4;
        return result;
    }

    readString(): string {
        const len = this.readUint32();
        const result = this.msg.slice(this.offset, this.offset + len).toString();
        this.offset += len;
        return result;
    }

    readArray(): any[] {
        const length = this.readUint32();
        const result = new Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = this.readTypedValue();
        }
        return result;
    }
    readTypedValue(): any {
        const type = this.readByte();
        switch (type) {
            case ObjectType.JSON: {
                return JSON.parse(this.readString(), this.reviver);
            }
            case ObjectType.ByteArray: {
                return this.readByteArray();
            }
            case ObjectType.ObjectArray: {
                return this.readArray();
            }
            case ObjectType.Undefined: {
                return undefined;
            }
        }
    }

    readByteArray(): Uint8Array {
        const length = this.readUint32();
        const result = this.msg.slice(this.offset, this.offset + length);
        const res = new Uint8Array(length);
        res.set(result.buffer);
        this.offset += length;
        return res;
    }
}

export class MessageWriter {
    constructor(private replacer: (key: string | undefined, value: any) => any, private msg: BinaryBuffer = BinaryBuffer.alloc(1024), private offset: number = 0) { }

    writeByte(value: number): void {
        this.ensureCapacity(1);
        this.msg.writeUInt8(value, this.offset++);
    }

    ensureCapacity(value: number): void {
        let newLength = this.msg.byteLength;
        while (newLength < this.offset + value) {
            newLength *= 2;
        }
        if (newLength !== this.msg.byteLength) {
            const newBuffer = BinaryBuffer.alloc(newLength);
            newBuffer.set(this.msg);
            this.msg = newBuffer;
        }
    }

    writeUint32(value: number): void {
        this.ensureCapacity(4);
        this.msg.writeUInt32LE(value, this.offset);
        this.offset += 4;
    }

    writeString(value: string): void {
        const encoded = BinaryBuffer.fromString(value);
        this.writeByteArray(encoded.buffer);
    }

    writeArray(value: any[]): void {
        this.writeUint32(value.length);
        for (let i = 0; i < value.length; i++) {
            this.writeTypedValue(value[i]);
        }
    }

    writeTypedValue(value: any): void {
        if (typeof value === 'undefined') {
            this.writeByte(ObjectType.Undefined);
        } else if (Array.isArray(value)) {
            this.writeByte(ObjectType.ObjectArray);
            this.writeArray(value);
        } else if (value instanceof Uint8Array) {
            this.writeByte(ObjectType.ByteArray);
            this.writeByteArray(value);
        } else {
            this.writeByte(ObjectType.JSON);
            this.writeString(JSON.stringify(value, this.replacer));
        }

    }

    writeByteArray(value: Uint8Array): void {
        this.ensureCapacity(value.byteLength + 4);
        this.writeUint32(value.byteLength);
        this.msg.set(value, this.offset);
        this.offset += value.byteLength;
    }

    toMessage(): Uint8Array {
        const result = new Uint8Array(this.offset);
        for (let i = 0; i < this.offset; i++) {
            result[i] = this.msg.readUInt8(i);
        }
        return result;
    }
}
