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

export namespace Base64 {
    const CODE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/';

    export function encode2(bytes: Uint8Array): string {
        let result: string = '';

        for (let i = 0; i < Math.ceil(bytes.length / 3); i++) {
            result += encodeBytes(bytes[i * 3], bytes[(i * 3) + 1], bytes[(i * 3) + 2]);
        }

        return result;
    }

    function encodeBytes(first: number, second?: number, third?: number): string {
        const triByte = (first << 16) + (second ? (second << 8) : 0) + (third ? third : 0);

        let result = '' + CODE_CHARS.charAt((triByte >> 18) % 64);
        result += CODE_CHARS.charAt((triByte >> 12) % 64);
        if (typeof second === 'number') {
            result += CODE_CHARS.charAt((triByte >> 6) % 64);
            if (typeof third === 'number') {
                result += CODE_CHARS.charAt((triByte) % 64);
            } else {
                result += '=';
            }
        } else {
            result += '==';
        }

        return result;
    }

    export function decode2(encoded: string): Uint8Array {
        if (encoded.length === 0) {
            return new Uint8Array(0);
        }
        if (encoded.length % 4 !== 0) {
            throw new Error(`encoded string length must be a multiple of 4, but is ${encoded.length}`);
        }
        let arrayLength = (encoded.length / 4) * 3;
        if (encoded.charAt(encoded.length - 1) === '=') {
            arrayLength--;
        }
        if (encoded.charAt(encoded.length - 2) === '=') {
            arrayLength--;
        }

        const result = new Uint8Array(arrayLength);

        for (let i = 0; i < encoded.length; i += 4) {
            const quadruplet = (charToIndex(encoded.charAt(i)) << 18) + (charToIndex(encoded.charAt(i + 1)) << 12) + (charToIndex(encoded.charAt(i + 2)) << 6)
                + (charToIndex(encoded.charAt(i + 3)));

            const writeIndex = i / 4 * 3;
            result[writeIndex] = quadruplet >> 16 % 256;
            if (writeIndex < arrayLength - 1) {
                result[writeIndex + 1] = quadruplet >> 8 % 256;
                if (writeIndex < arrayLength - 2) {
                    result[writeIndex + 2] = quadruplet % 256;
                }
            }
        }

        return result;
    }

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
            result[writeIndex] = quadruplet >> 16 % 256;
            if (writeIndex < arrayLength - 1) {
                result[writeIndex + 1] = quadruplet >> 8 % 256;
                if (writeIndex < arrayLength - 2) {
                    result[writeIndex + 2] = quadruplet % 256;
                }
            }
        }

        return result;
    }

    function charToIndex(c: string): number {
        const index = CODE_CHARS.indexOf(c);
        return index < 0 ? 0 : index;
    }

    export function encode(bytes: Uint8Array): string {
        const resultLength = Math.ceil(bytes.length / 3) * 4;
        const res = new Uint8Array(resultLength);

        for (let i = 0; i < Math.ceil(bytes.length / 3); i++) {
            res.set(encodeBytes2(bytes[i * 3], bytes[(i * 3) + 1], bytes[(i * 3) + 2]), i * 4);
        }

        return BinaryBuffer.wrap(res).toString();
    }

    function encodeBytes2(first: number, second?: number, third?: number): number[] {
        const triByte = (first << 16) + (second ? (second << 8) : 0) + (third ? third : 0);

        const res: number[] = [35 + ((triByte >> 18) % 64)];
        res.push(35 + ((triByte >> 12) % 64));
        if (typeof second === 'number') {
            res.push(35 + ((triByte >> 6) % 64));
            if (typeof third === 'number') {
                res.push(35 + ((triByte) % 64));
            } else {
                res.push(34);
            }
        } else {
            res.push(34);
            res.push(34);
        }

        return res;
    }
}

// const data = new Uint8Array(1300000).fill(72);
const data = new Uint8Array([0, 1, 2, 3]);
const start = Date.now();

const encoded2 = Base64.encode(data);
const redecoded = Base64.decode(encoded2);

console.log(`size= ${redecoded.length}`);

const end = Date.now();
console.log(end - start);
