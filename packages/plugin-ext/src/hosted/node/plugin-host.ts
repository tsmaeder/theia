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

import { Emitter } from '@theia/core/lib/common/event';
import { RPCProtocolImpl, ConnectionClosedError } from '../../common/rpc-protocol';
import { PluginHostRPC } from './plugin-host-rpc';
import { reviver } from '../../plugin/types-impl';
import { Base64 } from '@theia/core/lib/common/base64';

console.log('PLUGIN_HOST(' + process.pid + ') starting instance');

// override exit() function, to do not allow plugin kill this node
process.exit = function (code?: number): void {
    const err = new Error('An plugin call process.exit() and it was prevented.');
    console.warn(err.stack);
} as (code?: number) => never;

// same for 'crash'(works only in electron)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proc = process as any;
if (proc.crash) {
    proc.crash = function (): void {
        const err = new Error('An plugin call process.crash() and it was prevented.');
        console.warn(err.stack);
    };
}

process.on('uncaughtException', (err: Error) => {
    console.error(err);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unhandledPromises: Promise<any>[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    unhandledPromises.push(promise);
    setTimeout(() => {
        const index = unhandledPromises.indexOf(promise);
        if (index >= 0) {
            promise.catch(err => {
                unhandledPromises.splice(index, 1);
                if ((ConnectionClosedError.is(err) || ConnectionClosedError.is(reason))) {
                    // during termination it is expected that pending rpc request are rejected
                    return;
                }
                console.error(`Promise rejection not handled in one second: ${err} , reason: ${reason}`);
                if (err && err.stack) {
                    console.error(`With stack trace: ${err.stack}`);
                }
            });
        }
    }, 1000);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.on('rejectionHandled', (promise: Promise<any>) => {
    const index = unhandledPromises.indexOf(promise);
    if (index >= 0) {
        unhandledPromises.splice(index, 1);
    }
});

const emitter = new Emitter<Uint8Array>();
const rpc = new RPCProtocolImpl({
    onMessage: emitter.event,
    send: (m: Uint8Array) => {
        if (process.send) {
            process.send(Base64.encode(m));
        }
    }
},
    {
        reviver: reviver
    });

process.on('message', async (message: string) => {
    emitter.fire(Base64.decode(message));
});

const pluginHostRPC = new PluginHostRPC(rpc);
pluginHostRPC.initialize();
