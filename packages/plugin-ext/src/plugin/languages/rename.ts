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
import * as Converter from '../type-converters';
import * as model from '../../api/model';
import { DocumentsExtImpl } from '@theia/plugin-ext/src/plugin/documents';
import { createToken } from '../token-provider';
import { Range } from '../types-impl';
import { isObject } from '../../common/types';

export class RenameAdapter {

    static supportsResolving(provider: theia.RenameProvider): boolean {
        return typeof provider.prepareRename === 'function';
    }

    constructor(
        private readonly provider: theia.RenameProvider,
        private readonly documents: DocumentsExtImpl
    ) { }

    provideRenameEdits(resource: URI, position: lsp.Position, newName: string): Promise<lsp.WorkspaceEdit | undefined> {
        const document = this.documents.getDocumentData(resource);
        if (!document) {
            return Promise.reject(new Error(`There is no document for ${resource}`));
        }

        const doc = document.document;
        const pos = Converter.toPosition(position);

        return Promise.resolve(
            this.provider.provideRenameEdits(doc, pos, newName, createToken())
        ).then(value => {
            if (!value) {
                return undefined;
            }
            return Converter.fromWorkspaceEdit(value);
        });
    }

    resolveRenameLocation(resource: URI, position: lsp.Position): Promise<model.RenameLocation | undefined> {
        if (typeof this.provider.prepareRename !== 'function') {
            return Promise.resolve(undefined);
        }

        const document = this.documents.getDocumentData(resource);
        if (!document) {
            return Promise.reject(new Error(`There is no document for ${resource}`));
        }

        const doc = document.document;
        const pos = Converter.toPosition(position);

        return Promise.resolve(
            this.provider.prepareRename(doc, pos, createToken())
        ).then(rangeOrLocation => {

            let range: theia.Range | undefined;
            let text: string;
            if (rangeOrLocation && Range.isRange(rangeOrLocation)) {
                range = rangeOrLocation;
                text = doc.getText(rangeOrLocation);
            } else if (rangeOrLocation && isObject(rangeOrLocation)) {
                range = rangeOrLocation.range;
                text = rangeOrLocation.placeholder;
            }

            if (!range) {
                return undefined;
            }
            if (range.start.line > pos.line || range.end.line < pos.line) {
                console.warn('INVALID rename location: position line must be within range start/end lines');
                return undefined;
            }
            return <model.RenameLocation>{
                range: Converter.fromRange(range)!,
                placeholder: text!
            };
        });
    }

    /* tslint:disable-next-line:no-any */
    private static asMessage(err: any): string | undefined {
        if (typeof err === 'string') {
            return err;
        } else if (err instanceof Error && typeof err.message === 'string') {
            return err.message;
        } else {
            return undefined;
        }
    }

}
