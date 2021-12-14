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
import { ConnectionExt, ConnectionMain } from './plugin-api-rpc';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { Channel } from '@theia/core/lib/common/messaging/web-socket-channel';

/**
 * A channel communicating with a counterpart in a plugin host.
 */
export class PluginChannel implements Channel {
    private messageEmitter: Emitter<Uint8Array> = new Emitter();
    private errorEmitter: Emitter<unknown> = new Emitter();
    private closedEmitter: Emitter<void> = new Emitter();

    constructor(
        protected readonly id: string,
        protected readonly connection: ConnectionExt | ConnectionMain) { }

    send(content: Uint8Array): void {
        this.connection.$sendMessage(this.id, content);
    }

    fireMessageReceived(msg: Uint8Array): void {
        this.messageEmitter.fire(msg);
    }

    fireError(error: unknown): void {
        this.errorEmitter.fire(error);
    }

    fireClosed(): void {
        this.closedEmitter.fire();
    }

    get onMessage(): Event<Uint8Array> {
        return this.messageEmitter.event;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get onError(): Event<unknown> {
        return this.errorEmitter.event;
    }

    get onClose(): Event<void> {
        return this.closedEmitter.event;
    }

    close(): void {
        this.connection.$deleteConnection(this.id);
    }
}

export class ConnectionImpl implements ConnectionMain, ConnectionExt {
    private readonly proxy: ConnectionExt | ConnectionExt;
    private readonly connections = new Map<string, PluginChannel>();

    constructor(proxy: ConnectionMain | ConnectionExt) {
        this.proxy = proxy;
    }

    /**
     * Gets the connection between plugin by id and sends string message to it.
     *
     * @param id connection's id
     * @param message incoming message
     */
    async $sendMessage(id: string, message: Uint8Array): Promise<void> {
        if (this.connections.has(id)) {
            this.connections.get(id)!.fireMessageReceived(message);
        } else {
            console.warn(`Received message for unknown connection: ${id}`);
        }
    }

    /**
     * Instantiates a new connection by the given id.
     * @param id the connection id
     */
    async $createConnection(id: string): Promise<void> {
        console.debug(`Creating plugin connection: ${id}`);

        await this.doEnsureConnection(id);
    }

    /**
     * Deletes a connection.
     * @param id the connection id
     */
    async $deleteConnection(id: string): Promise<void> {
        console.debug(`Deleting plugin connection: ${id}`);
        const connection = this.connections.get(id);
        if (connection) {
            this.connections.delete(id);
            connection.fireClosed();
        }
    }

    /**
     * Returns existed connection or creates a new one.
     * @param id the connection id
     */
    async ensureConnection(id: string): Promise<PluginChannel> {
        console.debug(`Creating local connection: ${id}`);
        const connection = await this.doEnsureConnection(id);
        await this.proxy.$createConnection(id);
        return connection;
    }

    /**
     * Returns existed connection or creates a new one.
     * @param id the connection id
     */
    async doEnsureConnection(id: string): Promise<PluginChannel> {
        const connection = this.connections.get(id) || await this.doCreateConnection(id);
        this.connections.set(id, connection);
        return connection;
    }

    protected async doCreateConnection(id: string): Promise<PluginChannel> {
        const channel = new PluginChannel(id, this.proxy);
        channel.onClose(() => this.connections.delete(id));
        return channel;
    }
}
