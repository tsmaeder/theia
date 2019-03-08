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

import * as theia from '@theia/plugin';
import { UriComponents } from '../common/uri-components';
import { FileStat } from '@theia/filesystem/lib/common';
import * as lsp from 'vscode-languageserver-types';

export interface Selection {
    anchor: lsp.Position;
    active: lsp.Position;
}

// Should contains internal Plugin API types

/**
 * Represents options to configure the behavior of showing a document in an editor.
 */
export interface TextDocumentShowOptions {
    /**
     * An optional selection to apply for the document in the editor.
     */
    selection?: Range;

    /**
     * An optional flag that when `true` will stop the editor from taking focus.
     */
    preserveFocus?: boolean;

    /**
     * An optional flag that controls if an editor-tab will be replaced
     * with the next editor or if it will be kept.
     */
    preview?: boolean;

    /**
     * Denotes a location of an editor in the window. Editors can be arranged in a grid
     * and each column represents one editor location in that grid by counting the editors
     * in order of their appearance.
     */
    viewColumn?: theia.ViewColumn;
}

export interface SerializedDocumentFilter {
    $serialized: true;
    language?: string;
    scheme?: string;
    pattern?: theia.GlobPattern;
}

export interface FileWatcherSubscriberOptions {
    globPattern: theia.GlobPattern;
    ignoreCreateEvents?: boolean;
    ignoreChangeEvents?: boolean;
    ignoreDeleteEvents?: boolean;
}

export interface FileChangeEvent {
    subscriberId: string,
    uri: UriComponents,
    type: FileChangeEventType
}

export type FileChangeEventType = 'created' | 'updated' | 'deleted';

export enum CompletionTriggerKind {
    Invoke = 0,
    TriggerCharacter = 1,
    TriggerForIncompleteCompletions = 2
}

export interface CompletionContext {
    triggerKind: CompletionTriggerKind;
    triggerCharacter?: string;
}

export type SnippetType = 'internal' | 'textmate';

export class IdObject {
    id: number;
}

export interface FormattingOptions {
    tabSize: number;
    insertSpaces: boolean;
}

export interface DefinitionProvider {
    provideDefinition(model: monaco.editor.ITextModel, position: monaco.Position, token: monaco.CancellationToken): lsp.Definition | lsp.DefinitionLink[] | undefined;
}

export interface DocumentLinkProvider {
    provideLinks(model: monaco.editor.ITextModel, token: monaco.CancellationToken): lsp.DocumentLink[] | undefined | PromiseLike<lsp.DocumentLink[] | undefined>;
    resolveLink?: (link: lsp.DocumentLink, token: monaco.CancellationToken) => lsp.DocumentLink | PromiseLike<lsp.DocumentLink[]>;
}

export interface CodeActionProvider {
    provideCodeActions(
        model: monaco.editor.ITextModel,
        range: Range | Selection,
        context: monaco.languages.CodeActionContext,
        token: monaco.CancellationToken
    ): lsp.CodeAction[] | PromiseLike<lsp.CodeAction[]>;

    providedCodeActionKinds?: string[];
}
export interface WorkspaceRootsChangeEvent {
    roots: FileStat[];
}

export interface WorkspaceFolder {
    uri: UriComponents;
    name: string;
    index: number;
}

export interface Breakpoint {
    readonly id: string;
    readonly enabled: boolean;
    readonly condition?: string;
    readonly hitCondition?: string;
    readonly logMessage?: string;
    readonly location?: Location;
    readonly functionName?: string;
}

export interface WorkspaceSymbolProvider {
    provideWorkspaceSymbols(params: WorkspaceSymbolParams, token: monaco.CancellationToken): Thenable<lsp.SymbolInformation[]>;
    resolveWorkspaceSymbol(symbol: lsp.SymbolInformation, token: monaco.CancellationToken): Thenable<lsp.SymbolInformation>
}

export interface WorkspaceSymbolParams {
    query: string
}

export interface FoldingContext {
}

export interface DocumentColorProvider {
    provideDocumentColors(model: monaco.editor.ITextModel): PromiseLike<lsp.ColorInformation[]>;
    provideColorPresentations(model: monaco.editor.ITextModel, colorInfo: lsp.ColorInformation): PromiseLike<lsp.ColorPresentation[]>;
}

export type RenameLocation = Range | {
    range: lsp.Range;
    placeholder: string;
};

export interface RenameProvider {
    provideRenameEdits(model: monaco.editor.ITextModel, position: Position, newName: string): PromiseLike<lsp.WorkspaceEdit>;
    resolveRenameLocation?(model: monaco.editor.ITextModel, position: Position): PromiseLike<RenameLocation>;
}
