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

import { BinaryBuffer } from './buffer';

/**
 * This module allows to encode byte arrays to string and vice versa.
 * Just using BinaryBuffer.toString() is inefficient for some reason.
 * Building the string by hand is inefficient because of string concatenation.
 * The approach chosen is to base 64-encode ever byte triplet and add 35 to
 * every resulting 6-bit value to makes sure the value represent printable
 * ASCII characters. This seems to make the underlying transport layers behave
 * properly for some reason.
 */
export namespace Base64 {
    export function decode(encoded: string): Uint8Array {
        if (encoded.length === 0) {
            return new Uint8Array(0);
        }
        if (encoded.length % 4 !== 0) {
            throw new Error(`encoded string length must be a multiple of 4, but is ${encoded.length}`);
        }
        let arrayLength = (encoded.length / 4) * 3;
        const source = BinaryBuffer.fromString(encoded).buffer;

        if (source[encoded.length - 1] === 34) {
            arrayLength--;
        }
        if (source[encoded.length - 2] === 34) {
            arrayLength--;
        }

        const result = new Uint8Array(arrayLength);

        const v = (value: number): number => (value - 35) < 0 ? 0 : (value - 35);

        for (let i = 0; i < source.length; i += 4) {
            const quadruplet = (v(source[i]) << 18) + (v(source[i + 1]) << 12) + (v(source[i + 2]) << 6)
                + (v(source[i + 3]));

            const writeIndex = i / 4 * 3;
            result[writeIndex] = quadruplet >> 16 & 255;
            if (writeIndex < arrayLength - 1) {
                result[writeIndex + 1] = quadruplet >> 8 & 255;
                if (writeIndex < arrayLength - 2) {
                    result[writeIndex + 2] = quadruplet & 255;
                }
            }
        }

        return result;
    }

    export function encode(bytes: Uint8Array): string {
        const resultLength = Math.ceil(bytes.length / 3) * 4;
        const res = new Uint8Array(resultLength);

        let readIndex = 0;
        let writeIndex = 0;
        const sourceLength = bytes.length;
        while (writeIndex < resultLength) {
            let triplet = bytes[readIndex] << 16;

            if (readIndex + 1 < sourceLength) {
                triplet += bytes[readIndex + 1] << 8;
                if (readIndex + 2 < sourceLength) {
                    triplet += bytes[readIndex + 2];
                }
            }

            res[writeIndex] = 35 + ((triplet >> 18) & 63);
            res[writeIndex + 1] = 35 + ((triplet >> 12) & 63);
            if (readIndex + 1 < sourceLength) {
                res[writeIndex + 2] = (35 + ((triplet >> 6) & 63));
                if (readIndex + 2 < sourceLength) {
                    res[writeIndex + 3] = (35 + ((triplet) & 63));
                } else {
                    res[writeIndex + 3] = 34;
                }
            } else {
                res[writeIndex + 2] = 34;
                res[writeIndex + 3] = 34;
            }
            readIndex += 3;
            writeIndex += 4;
        }

        return BinaryBuffer.wrap(res).toString();
    }
}
