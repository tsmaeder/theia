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
import { CompletionList, Range, SnippetString } from '../types-impl';
import { DocumentsExtImpl } from '../documents';
import * as Converter from '../type-converters';
import { CompletionContext } from '../../api/model';
import { createToken } from '../token-provider';
import * as lsp from 'vscode-languageserver-types';
import { ObjectIdentifier } from '../../common/object-identifier';

export class CompletionAdapter {
    private cacheId = 0;
    private cache = new Map<number, theia.CompletionItem>();
    private listCache = new Map<number, number[]>();

    constructor(private readonly delegate: theia.CompletionItemProvider,
        private readonly documents: DocumentsExtImpl) {

    }

    provideCompletionItems(resource: URI, position: lsp.Position, context: CompletionContext): Promise<lsp.CompletionList | undefined> {
        const document = this.documents.getDocumentData(resource);
        if (!document) {
            return Promise.reject(new Error(`There are no document for  ${resource}`));
        }

        const doc = document.document;

        const pos = Converter.toPosition(position);
        return Promise.resolve(this.delegate.provideCompletionItems(doc, pos, createToken(), context)).then(value => {
            if (!value) {
                return undefined;
            }
            const id = this.cacheId++;

            let list: CompletionList;
            if (Array.isArray(value)) {
                list = new CompletionList(value);
            } else {
                list = value;
            }
            const result: lsp.CompletionList = {
                isIncomplete: list.isIncomplete || false,
                items: [],
            };

            const wordRangeBeforePos = (doc.getWordRangeAtPosition(pos) as Range || new Range(pos, pos))
                .with({ end: pos });

            const itemList: number[] = [];
            this.listCache.set(id, itemList);

            for (let i = 0; i < list.items.length; i++) {
                const suggestion = this.convertCompletionItem(list.items[i], pos, wordRangeBeforePos);
                if (suggestion) {
                    result.items.push(suggestion);
                    const itemId: number = this.cacheId++;
                    ObjectIdentifier.mixin(suggestion, itemId);
                    itemList.push(itemId);
                    this.cache.set(itemId, list.items[i]);
                }
            }
            return result;
        });
    }

    resolveCompletionItem(resource: URI, position: lsp.Position, completion: lsp.CompletionItem): Promise<lsp.CompletionItem> {

        if (typeof this.delegate.resolveCompletionItem !== 'function') {
            return Promise.resolve(completion);
        }

        const id: number = ObjectIdentifier.of(completion);
        const item = this.cache.get(id);
        if (!item) {
            return Promise.resolve(completion);
        }

        return Promise.resolve(this.delegate.resolveCompletionItem(item, undefined)).then(resolvedItem => {

            if (!resolvedItem) {
                return completion;
            }

            const doc = this.documents.getDocumentData(resource)!.document;
            const pos = Converter.toPosition(position);
            const wordRangeBeforePos = (doc.getWordRangeAtPosition(pos) as Range || new Range(pos, pos)).with({ end: pos });
            const newCompletion = this.convertCompletionItem(resolvedItem, pos, wordRangeBeforePos);
            if (newCompletion) {
                return newCompletion;
            }
            return completion;
        });
    }

    releaseCompletionItems(id: number) {
        this.cache.delete(id);
        return Promise.resolve();
    }

    private convertCompletionItem(item: theia.CompletionItem, position: theia.Position, defaultRange: theia.Range): lsp.CompletionItem | undefined {
        if (typeof item.label !== 'string' || item.label.length === 0) {
            console.warn('Invalid Completion Item -> must have at least a label');
            return undefined;
        }

        const result: lsp.CompletionItem = {
            label: item.label,
            kind: Converter.fromCompletionItemKind(item.kind),
            detail: item.detail,
            documentation: item.documentation ? Converter.fromMarkdown(item.documentation) : undefined,
            filterText: item.filterText,
            sortText: item.sortText,
            preselect: item.preselect,
            additionalTextEdits: item.additionalTextEdits && item.additionalTextEdits.map(Converter.fromTextEdit),
            command: undefined,   // TODO: implement this: this.commands.toInternal(item.command),
            commitCharacters: item.commitCharacters
        };

        let range: theia.Range;
        if (item.range) {
            range = item.range;
        } else {
            range = defaultRange;
        }
        result.textEdit = { newText: '', range: Converter.fromRange(range)! };

        if (!range.isSingleLine || range.start.line !== position.line) {
            console.warn('Invalid Completion Item -> must be single line and on the same line');
            return undefined;
        }

        if (typeof item.insertText === 'string') {
            result.textEdit.newText = item.insertText;
            result.insertTextFormat = lsp.InsertTextFormat.PlainText;

        } else if (item.insertText instanceof SnippetString) {
            result.textEdit.newText = item.insertText.value;
            result.insertTextFormat = lsp.InsertTextFormat.Snippet;
        } else {
            result.textEdit.newText = item.label;
            result.insertTextFormat = lsp.InsertTextFormat.PlainText;
        }

        return result;
    }

    static hasResolveSupport(provider: theia.CompletionItemProvider): boolean {
        return typeof provider.resolveCompletionItem === 'function';
    }
}
