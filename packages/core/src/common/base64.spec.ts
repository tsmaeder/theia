/********************************************************************************
 * Copyright (C) 2021 Red Hat and others.
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
import { Base64 } from './base64';
import * as chai from 'chai';

describe('Base64', () => {
    it('should encode a simple buffer', async () => {
        doTest([0]);
        doTest([16]);
        doTest([128]);
        doTest([255]);
    });

    it('should encode uneven array lengths', async () => {
        doTest([]);
        doTest([0]);
        doTest([0, 1]);
        doTest([0, 1, 2]);
        doTest([0, 1, 2, 3]);
        doTest([0, 1, 2, 3, 4]);
        doTest([0, 1, 2, 3, 4, 5]);
    });
});

function doTest(array: number[]): void {
    const buffer = new Uint8Array([0, 1, 2, 3]);
    const encoded = Base64.encode(buffer);
    const decoded = Base64.decode(encoded);
    chai.expect(decoded).deep.equal(buffer);
}
