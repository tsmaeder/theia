/********************************************************************************
 * Copyright (C) 2021 Red Hat, Inc. and others.
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

import { Emitter } from '@theia/core/lib/common';
import { createProxyIdentifier, MessageConnection, ProxyIdentifier, RPCProtocolImpl } from './rpc-protocol';
import * as assert from 'assert';
import * as sinon from 'sinon';

class PipeMessageConnection {
    private readonly left: MessageConnection;
    private readonly right: MessageConnection;

    constructor() {
        const leftEmitter = new Emitter<string>();
        const rightEmitter = new Emitter<string>();
        this.left = {
            send: (message: string) => {
                rightEmitter.fire(message);
            },
            onMessage: leftEmitter.event
        };

        this.right = {
            send: (message: string) => {
                leftEmitter.fire(message);
            },
            onMessage: rightEmitter.event
        };
    }

    get leftConnection(): MessageConnection {
        return this.left;
    }

    get rightConnection(): MessageConnection {
        return this.right;
    }

}

describe('RPC protocol tests', () => {
    interface service {
        myMethod(args: object[]): void;
    }

    const id = createProxyIdentifier<service>('testService');
    const pipe = new PipeMessageConnection();

    it('can pass arrays', () => {
        const frontEnd = new RPCProtocolImpl(pipe.leftConnection);
        const backEnd = new RPCProtocolImpl(pipe.rightConnection);

        const service = sinon.mock({
            myMethod: () => { }
        });

        const args = [{ first: 'first' }, { second: 'second' }];

        service.expects('myMethod').once().withExactArgs(args);

        backEnd.set(id, service as unknown as service);

        const proxy: service = frontEnd.getProxy(id);
        proxy.myMethod(args);
    });
});
