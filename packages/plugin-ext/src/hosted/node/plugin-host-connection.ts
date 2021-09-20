/********************************************************************************
 * Copyright (C) 2018-2021 Red Hat, Inc. and others.
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

import { Emitter, Event } from '@theia/core/lib/common';
import { WebSocketChannel } from '@theia/core/lib/common/messaging/web-socket-channel';
import { MessagingService } from '@theia/core/lib/node/messaging/messaging-service';
import { injectable } from '@theia/core/shared/inversify';

@injectable()
export class PluginHostConnection implements MessagingService.Contribution {

    private channels: Map<string, WebSocketChannel> = new Map();

    private readonly onMessageEmitter: Emitter<{ pluginHostId: string, message: string }> = new Emitter();

    readonly onMessage: Event<{ pluginHostId: string, message: string }> = this.onMessageEmitter.event;

    configure(service: MessagingService): void {
        service.wsChannel('pluginAPI/:pluginHostId', ({ pluginHostId }: { pluginHostId: string }, channel) => {
            console.info(`opened a channel on channel:${channel} for plugin host: ${pluginHostId}`);
            this.channels.set(pluginHostId, channel);
            channel.onClose(c => this.channels.delete(pluginHostId));
            channel.onMessage(data => {
                this.onMessageEmitter.fire({ pluginHostId, message: data });
            });
        });
    }

    send(pluginHostId: string, message: string): void {
        const channel = this.channels.get(pluginHostId);
        if (channel) {
            channel.send(message);
        } else {
            console.error(`channel for plugin host ${pluginHostId} not found`);
        }
    }
}
