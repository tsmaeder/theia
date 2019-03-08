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

import URI from 'vscode-uri/lib/umd';
import * as theia from '@theia/plugin';
import * as lsp from 'vscode-languageserver-types';
import { DocumentsExtImpl } from '../documents';
import * as Converter from '../type-converters';
import { createToken } from '../token-provider';
import * as types from '../types-impl';

/** Adapts the calls from main to extension thread for providing the document symbols. */
export class OutlineAdapter {

    constructor(
        private readonly documents: DocumentsExtImpl,
        private readonly provider: theia.DocumentSymbolProvider
    ) { }

    provideDocumentSymbols(resource: URI): Promise<lsp.DocumentSymbol[] | undefined> {
        const document = this.documents.getDocumentData(resource);
        if (!document) {
            return Promise.reject(new Error(`There is no document for ${resource}`));
        }

        const doc = document.document;

        return Promise.resolve(this.provider.provideDocumentSymbols(doc, createToken())).then(value => {
            if (!value || value.length === 0) {
                return undefined;
            }
            if (value[0] instanceof types.DocumentSymbol) {
                return (<types.DocumentSymbol[]>value).map(Converter.fromDocumentSymbol);
            } else {
                return OutlineAdapter.asDocumentSymbolTree(resource, <types.SymbolInformation[]>value);
            }
        });
    }

    private static asDocumentSymbolTree(resource: URI, info: types.SymbolInformation[]): lsp.DocumentSymbol[] {
        // first sort by start (and end) and then loop over all elements
        // and build a tree based on containment.
        info = info.slice(0).sort((a, b) => {
            let r = a.location.range.start.compareTo(b.location.range.start);
            if (r === 0) {
                r = b.location.range.end.compareTo(a.location.range.end);
            }
            return r;
        });
        const res: lsp.DocumentSymbol[] = [];
        const parentStack: lsp.DocumentSymbol[] = [];
        for (let i = 0; i < info.length; i++) {
            const element = <lsp.DocumentSymbol>{
                name: info[i].name,
                detail: '',
                kind: Converter.SymbolKind.fromSymbolKind(info[i].kind),
                containerName: info[i].containerName,
                range: Converter.fromRange(info[i].location.range),
                selectionRange: Converter.fromRange(info[i].location.range),
                children: []
            };

            while (true) {
                if (parentStack.length === 0) {
                    parentStack.push(element);
                    res.push(element);
                    break;
                }
                const parent = parentStack[parentStack.length - 1];
                if (OutlineAdapter.containsRange(parent.range, element.range) && !OutlineAdapter.equalsRange(parent.range, element.range)) {
                    parent.children!.push(element);
                    parentStack.push(element);
                    break;
                }
                parentStack.pop();
            }
        }
        return res;
    }

    /**
     * Test if `otherRange` is in `range`. If the ranges are equal, will return true.
     */
    private static containsRange(range: lsp.Range, otherRange: lsp.Range): boolean {
        if (otherRange.start.line < range.start.line || otherRange.end.line < range.start.line) {
            return false;
        }
        if (otherRange.start.line > range.end.line || otherRange.end.line > range.end.line) {
            return false;
        }
        if (otherRange.start.line === range.start.line && otherRange.start.character < range.start.character) {
            return false;
        }
        if (otherRange.end.line === range.end.line && otherRange.end.character > range.end.character) {
            return false;
        }
        return true;
    }

    /**
     * Test if range `a` equals `b`.
     */
    private static equalsRange(a: lsp.Range, b: lsp.Range): boolean {
        return (
            !!a &&
            !!b &&
            a.start.line === b.start.line &&
            a.start.character === b.start.character &&
            a.end.line === b.end.line &&
            a.end.character === b.end.character
        );
    }
}
