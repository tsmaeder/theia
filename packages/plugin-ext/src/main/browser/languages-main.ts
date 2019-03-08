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

import {
    LanguagesMain,
    SerializedLanguageConfiguration,
    SerializedRegExp,
    SerializedIndentationRule,
    SerializedOnEnterRule,
    MAIN_RPC_CONTEXT,
    LanguagesExt
} from '../../api/plugin-api';
import { interfaces } from 'inversify';
import { SerializedDocumentFilter, WorkspaceSymbolProvider } from '../../api/model';
import { RPCProtocol } from '../../api/rpc-protocol';
import { fromLanguageSelector } from '../../plugin/type-converters';
import { LanguageSelector } from '../../plugin/languages';
import { DocumentFilter, MonacoModelIdentifier, testGlob, getLanguages, MonacoToProtocolConverter, ProtocolToMonacoConverter } from 'monaco-languageclient/lib';
import { DisposableCollection, Emitter } from '@theia/core';
import { MonacoLanguages } from '@theia/monaco/lib/browser/monaco-languages';
import URI from 'vscode-uri/lib/umd';
import CoreURI from '@theia/core/lib/common/uri';
import { ProblemManager } from '@theia/markers/lib/browser';
import * as lsp from 'vscode-languageserver-types';

export class LanguagesMainImpl implements LanguagesMain {

    private ml: MonacoLanguages;
    private problemManager: ProblemManager;
    private m2p: MonacoToProtocolConverter;
    private p2m: ProtocolToMonacoConverter;

    private readonly proxy: LanguagesExt;
    private readonly disposables = new Map<number, monaco.IDisposable>();
    constructor(rpc: RPCProtocol, container: interfaces.Container) {
        this.proxy = rpc.getProxy(MAIN_RPC_CONTEXT.LANGUAGES_EXT);
        this.ml = container.get(MonacoLanguages);
        this.problemManager = container.get(ProblemManager);
        this.m2p = container.get(MonacoToProtocolConverter);
        this.p2m = container.get(ProtocolToMonacoConverter);
    }

    $getLanguages(): Promise<string[]> {
        return Promise.resolve(monaco.languages.getLanguages().map(l => l.id));
    }

    $unregister(handle: number): void {
        const disposable = this.disposables.get(handle);
        if (disposable) {
            disposable.dispose();
            this.disposables.delete(handle);
        }
    }

    $setLanguageConfiguration(handle: number, languageId: string, configuration: SerializedLanguageConfiguration): void {
        const config: monaco.languages.LanguageConfiguration = {
            comments: configuration.comments,
            brackets: configuration.brackets,
            wordPattern: reviveRegExp(configuration.wordPattern),
            indentationRules: reviveIndentationRule(configuration.indentationRules),
            onEnterRules: reviveOnEnterRules(configuration.onEnterRules),
        };

        this.disposables.set(handle, monaco.languages.setLanguageConfiguration(languageId, config));
    }

    private asPosition(position: monaco.Position): lsp.Position {
        return this.m2p.asPosition(position.lineNumber, position.column);
    }

    private asColor(color: monaco.languages.IColor): lsp.Color {
        return {
            red: color.red,
            green: color.green,
            blue: color.blue,
            alpha: color.alpha
        }
    }

    private asColorInformation(info: monaco.languages.IColorInformation): lsp.ColorInformation {
        return {
            color: this.asColor(info.color),
            range: this.m2p.asRange(info.range)
        }
    }

    private asLocationLink(link: lsp.LocationLink | lsp.Location): monaco.languages.DefinitionLink {
        if (lsp.LocationLink.is(link)) {
            return {
                origin: this.p2m.asRange(link.originSelectionRange),
                range: this.p2m.asRange(link.targetRange),
                selectionRange: this.p2m.asRange(link.targetSelectionRange),
                uri: monaco.Uri.parse(link.targetUri)
            };
        } else {
            return {
                range: this.p2m.asRange(link.range),
                uri: monaco.Uri.parse(link.uri)
            }
        }
    }

    private asSuggestion(item: lsp.CompletionItem, position: lsp.Position): monaco.modes.ISuggestion {
        const result = <monaco.modes.ISuggestion & { wrapped: lsp.Position }>{
            label: item.label,
            type: this.asSuggestionType(item.kind),
            detail: item.detail,
            documentation: item.documentation,
            filterText: item.filterText,
            sortText: item.sortText,
            preselect: item.preselect,
            commitCharacters: item.commitCharacters,
            additionalTextEdits: this.p2m.asTextEdits(item.additionalTextEdits),
            command: this.p2m.asCommand(item.command),
            snippetType: this.asSnippetType(item.insertTextFormat),
            wrapped: position
        };
        if (item.textEdit) {
            result.insertText = item.textEdit.newText;
            result.overwriteBefore = position.character - item.textEdit.range.start.character;
            result.overwriteAfter = item.textEdit.range.end.character - position.character;
        } else {
            result.insertText = item.insertText || '';
        }

        return result;
    }



    private asSuggestionType(kind?: lsp.CompletionItemKind): monaco.modes.SuggestionType {
        switch (kind) {
            case lsp.CompletionItemKind.Text: return 'text';
            case lsp.CompletionItemKind.Method: return 'method';
            case lsp.CompletionItemKind.Function: return 'function';
            case lsp.CompletionItemKind.Constructor: return 'constructor';
            case lsp.CompletionItemKind.Field: return 'field';
            case lsp.CompletionItemKind.Variable: return 'variable';
            case lsp.CompletionItemKind.Class: return 'class';
            case lsp.CompletionItemKind.Interface: return 'interface';
            case lsp.CompletionItemKind.Module: return 'module';
            case lsp.CompletionItemKind.Property: return 'property';
            case lsp.CompletionItemKind.Unit: return 'unit';
            case lsp.CompletionItemKind.Value: return 'value';
            case lsp.CompletionItemKind.Enum: return 'enum';
            case lsp.CompletionItemKind.Keyword: return 'keyword';
            case lsp.CompletionItemKind.Snippet: return 'snippet';
            case lsp.CompletionItemKind.Color: return 'color';
            case lsp.CompletionItemKind.File: return 'file';
            case lsp.CompletionItemKind.Reference: return 'reference';
            case lsp.CompletionItemKind.Folder: return 'folder';
            case lsp.CompletionItemKind.EnumMember: return 'enum-member';
            case lsp.CompletionItemKind.Constant: return 'constant';
            case lsp.CompletionItemKind.Struct: return 'struct';
            case lsp.CompletionItemKind.Event: return 'event';
            case lsp.CompletionItemKind.Operator: return 'operator';
            case lsp.CompletionItemKind.TypeParameter: return 'type-parameter';
        }
        return 'method';
    }

    private asSnippetType(type?: lsp.InsertTextFormat): monaco.modes.SnippetType | undefined {
        if (!type) {
            return undefined;
        }
        if (type === lsp.InsertTextFormat.PlainText) {
            return 'internal';
        }
        return 'textmate';
    }

    private asCompletionItem(item: monaco.modes.ISuggestion, position: lsp.Position): lsp.CompletionItem {
    }

    $registerCompletionSupport(handle: number, selector: SerializedDocumentFilter[], triggerCharacters: string[], supportsResolveDetails: boolean): void {

        this.disposables.set(handle, monaco.modes.SuggestRegistry.register(fromLanguageSelector(selector)!, {
            triggerCharacters,
            provideCompletionItems: (model: monaco.editor.ITextModel,
                position: monaco.Position,
                context: monaco.modes.SuggestContext,
                token: monaco.CancellationToken): Thenable<monaco.modes.ISuggestResult> => {
                const lspPosition = this.asPosition(position);
                return this.proxy.$provideCompletionItems(handle, model.uri, lspPosition, context).then(result => {
                    if (!result) {
                        return undefined!;
                    }
                    return {
                        suggestions: result.items.map(item => this.asSuggestion(item, lspPosition)),
                        incomplete: result.isIncomplete,
                        // tslint:disable-next-line:no-any
                        dispose: () => this.proxy.$releaseCompletionItems(handle, (<any>result).id)
                    };
                })
            },
            resolveCompletionItem: supportsResolveDetails
                ? (model, position, suggestion, token) => Promise.resolve(this.proxy.$resolveCompletionItem(handle, model.uri, this.asPosition(position), this.asCompletionItem(suggestion))
                : undefined
        }));
    }

    $registerDefinitionProvider(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const definitionProvider = this.createDefinitionProvider(handle, languageSelector);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerDefinitionProvider(language, definitionProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    $registeReferenceProvider(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const referenceProvider = this.createReferenceProvider(handle, languageSelector);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerReferenceProvider(language, referenceProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    protected createReferenceProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.ReferenceProvider {
        return {
            provideReferences: (model, position, context, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideReferences(handle, model.uri, this.asPosition(position), context).then(result => {
                    if (!result) {
                        return undefined!;
                    }

                    if (Array.isArray(result)) {
                        const references: monaco.languages.Location[] = [];
                        for (const item of result) {
                            references.push(this.p2m.asLocation(item));
                        }
                        return references;
                    }

                    return undefined!;
                });
            }
        };
    }

    $registerSignatureHelpProvider(handle: number, selector: SerializedDocumentFilter[], triggerCharacters: string[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const signatureHelpProvider = this.createSignatureHelpProvider(handle, languageSelector, triggerCharacters);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerSignatureHelpProvider(language, signatureHelpProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    $clearDiagnostics(id: string): void {
        for (const uri of this.problemManager.getUris()) {
            this.problemManager.setMarkers(new CoreURI(uri), id, []);
        }
    }

    $changeDiagnostics(id: string, delta: [string, lsp.Diagnostic[]][]): void {
        for (const [uriString, markers] of delta) {
            const uri = new CoreURI(uriString);
            this.problemManager.setMarkers(uri, id, markers);
        }
    }

    $registerImplementationProvider(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const implementationProvider = this.createImplementationProvider(handle, languageSelector);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerImplementationProvider(language, implementationProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    protected createImplementationProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.ImplementationProvider {
        return {
            provideImplementation: (model, position, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideImplementation(handle, model.uri, this.asPosition(position)).then(result => {
                    if (!result) {
                        return undefined!;
                    }

                    if (Array.isArray(result)) {
                        // using DefinitionLink because Location is mandatory part of DefinitionLink
                        const definitionLinks: monaco.languages.DefinitionLink[] = [];
                        for (const item of result) {
                            definitionLinks.push(this.asLocationLink(item));
                        }
                        return definitionLinks;
                    } else {
                        // single Location
                        return this.asLocationLink(result);
                    }
                });
            }
        };
    }

    $registerTypeDefinitionProvider(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const typeDefinitionProvider = this.createTypeDefinitionProvider(handle, languageSelector);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerTypeDefinitionProvider(language, typeDefinitionProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    protected createTypeDefinitionProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.TypeDefinitionProvider {
        return {
            provideTypeDefinition: (model, position, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideTypeDefinition(handle, model.uri, this.asPosition(position)).then(result => {
                    if (!result) {
                        return undefined!;
                    }

                    if (Array.isArray(result)) {
                        // using DefinitionLink because Location is mandatory part of DefinitionLink
                        const definitionLinks: monaco.languages.DefinitionLink[] = [];
                        for (const item of result) {
                            definitionLinks.push(this.asLocationLink(item));
                        }
                        return definitionLinks;
                    } else {
                        // single Location
                        return this.asLocationLink(result);
                    }
                });
            }
        };
    }

    $registerHoverProvider(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const hoverProvider = this.createHoverProvider(handle, languageSelector);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerHoverProvider(language, hoverProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    protected createHoverProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.HoverProvider {
        return {
            provideHover: (model, position, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideHover(handle, model.uri, this.asPosition(position)).then(v => this.p2m.asHover(v)!);
            }
        };
    }

    $registerDocumentHighlightProvider(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const documentHighlightProvider = this.createDocumentHighlightProvider(handle, languageSelector);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerDocumentHighlightProvider(language, documentHighlightProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    protected createDocumentHighlightProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DocumentHighlightProvider {
        return {
            provideDocumentHighlights: (model, position, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideDocumentHighlights(handle, model.uri, this.asPosition(position)).then(result => {
                    if (!result) {
                        return undefined!;
                    }

                    if (Array.isArray(result)) {
                        const highlights: monaco.languages.DocumentHighlight[] = [];
                        for (const item of result) {
                            highlights.push(this.p2m.asDocumentHighlight(item));
                        }
                        return highlights;
                    }

                    return undefined!;
                });

            }
        };
    }

    $registerWorkspaceSymbolProvider(handle: number): void {
        const workspaceSymbolProvider = this.createWorkspaceSymbolProvider(handle);
        const disposable = new DisposableCollection();
        disposable.push(this.ml.registerWorkspaceSymbolProvider(workspaceSymbolProvider));
        this.disposables.set(handle, disposable);
    }

    protected createWorkspaceSymbolProvider(handle: number): WorkspaceSymbolProvider {
        return {
            provideWorkspaceSymbols: (params, token) => this.proxy.$provideWorkspaceSymbols(handle, params.query),
            resolveWorkspaceSymbol: (symbol, token) => this.proxy.$resolveWorkspaceSymbol(handle, symbol)
        };
    }

    $registerDocumentLinkProvider(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const linkProvider = this.createLinkProvider(handle, languageSelector);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerLinkProvider(language, linkProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    protected createLinkProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.LinkProvider {
        return {
            provideLinks: (model, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideDocumentLinks(handle, model.uri).then(v => this.p2m.asDocumentLinks(v!));
            },
            resolveLink: (link: monaco.languages.ILink, token) =>
                this.proxy.$resolveDocumentLink(handle, this.m2p.asDocumentLink(link)).then(v => this.p2m.asDocumentLink(v!))
        };
    }

    $registerCodeLensSupport(handle: number, selector: SerializedDocumentFilter[], eventHandle: number): void {
        const languageSelector = fromLanguageSelector(selector);
        const lensProvider = this.createCodeLensProvider(handle, languageSelector);

        if (typeof eventHandle === 'number') {
            const emitter = new Emitter<monaco.languages.CodeLensProvider>();
            this.disposables.set(eventHandle, emitter);
            lensProvider.onDidChange = emitter.event;
        }

        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerCodeLensProvider(language, lensProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    protected createCodeLensProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.CodeLensProvider {
        return {
            provideCodeLenses: (model, token) =>
                this.proxy.$provideCodeLenses(handle, model.uri).then(v => this.p2m.asCodeLenses(v!))
            ,
            resolveCodeLens: (model, codeLens, token) =>
                this.proxy.$resolveCodeLens(handle, model.uri, this.m2p.asCodeLens(codeLens)).then(v => this.p2m.asCodeLens(v!))
        };
    }

    // tslint:disable-next-line:no-any
    $emitCodeLensEvent(eventHandle: number, event?: any): void {
        const obj = this.disposables.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(event);
        }
    }

    $registerOutlineSupport(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const symbolProvider = this.createDocumentSymbolProvider(handle, languageSelector);

        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerDocumentSymbolProvider(language, symbolProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    protected createDocumentSymbolProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DocumentSymbolProvider {
        return {
            provideDocumentSymbols: (model, token) =>
                this.proxy.$provideDocumentSymbols(handle, model.uri).then(v => this.p2m.asDocumentSymbols(v!))
        };
    }

    protected createDefinitionProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DefinitionProvider {
        return {
            provideDefinition: (model, position, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideDefinition(handle, model.uri, this.asPosition(position)).then(result => {
                    if (!result) {
                        return undefined!;
                    }

                    if (Array.isArray(result)) {
                        // using DefinitionLink because Location is mandatory part of DefinitionLink
                        const definitionLinks: monaco.languages.DefinitionLink[] = [];
                        for (const item of result) {
                            definitionLinks.push(this.asLocationLink(item));
                        }
                        return definitionLinks;
                    } else {
                        // single Location
                        return this.asLocationLink(result);
                    }
                });
            }
        };
    }

    protected createSignatureHelpProvider(handle: number, selector: LanguageSelector | undefined, triggerCharacters: string[]): monaco.languages.SignatureHelpProvider {
        return {
            signatureHelpTriggerCharacters: triggerCharacters,
            provideSignatureHelp: (model, position, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideSignatureHelp(handle, model.uri, this.asPosition(position)).then(v => this.p2m.asSignatureHelp(v!));
            }
        };
    }

    $registerDocumentFormattingSupport(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const documentFormattingEditSupport = this.createDocumentFormattingSupport(handle, languageSelector);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerDocumentFormattingEditProvider(language, documentFormattingEditSupport));
            }
        }
        this.disposables.set(handle, disposable);
    }

    createDocumentFormattingSupport(handle: number, selector: LanguageSelector | undefined): monaco.languages.DocumentFormattingEditProvider {
        return {
            provideDocumentFormattingEdits: (model, options, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideDocumentFormattingEdits(handle, model.uri, options).then(v => this.p2m.asTextEdits(v!));
            }
        };
    }

    $registerRangeFormattingProvider(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const rangeFormattingEditProvider = this.createRangeFormattingProvider(handle, languageSelector);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerDocumentRangeFormattingEditProvider(language, rangeFormattingEditProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    createRangeFormattingProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DocumentRangeFormattingEditProvider {
        return {
            provideDocumentRangeFormattingEdits: (model, range, options, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideDocumentRangeFormattingEdits(handle, model.uri, this.m2p.asRange(range), options).then(v => this.p2m.asTextEdits(v!));
            }
        };
    }

    $registerOnTypeFormattingProvider(handle: number, selector: SerializedDocumentFilter[], autoFormatTriggerCharacters: string[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const onTypeFormattingProvider = this.createOnTypeFormattingProvider(handle, languageSelector, autoFormatTriggerCharacters);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerOnTypeFormattingEditProvider(language, onTypeFormattingProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    protected createOnTypeFormattingProvider(
        handle: number,
        selector: LanguageSelector | undefined,
        autoFormatTriggerCharacters: string[]
    ): monaco.languages.OnTypeFormattingEditProvider {
        return {
            autoFormatTriggerCharacters,
            provideOnTypeFormattingEdits: (model, position, ch, options) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideOnTypeFormattingEdits(handle, model.uri, this.asPosition(position), ch, options).then(v => this.p2m.asTextEdits(v!));
            }
        };
    }

    $registerFoldingRangeProvider(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const provider = this.createFoldingRangeProvider(handle, languageSelector);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerFoldingRangeProvider(language, provider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    createFoldingRangeProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.FoldingRangeProvider {
        return {
            provideFoldingRanges: (model, context, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideFoldingRange(handle, model.uri).then(v => this.p2m.asFoldingRanges(v!));
            }
        };
    }

    $registerDocumentColorProvider(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const colorProvider = this.createColorProvider(handle, languageSelector);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerColorProvider(language, colorProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    createColorProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DocumentColorProvider {
        return {
            provideDocumentColors: (model, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideDocumentColors(handle, model.uri).then(documentColors =>
                    this.p2m.asColorInformations(documentColors)
                );
            },
            provideColorPresentations: (model, colorInfo, token) =>
                this.proxy.$provideColorPresentations(handle, model.uri, this.asColorInformation(colorInfo)).then(v => this.p2m.asColorPresentations(v!))
        };
    }

    $registerQuickFixProvider(handle: number, selector: SerializedDocumentFilter[], codeActionKinds?: string[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const quickFixProvider = this.createQuickFixProvider(handle, languageSelector, codeActionKinds);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerCodeActionProvider(language, quickFixProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    protected createQuickFixProvider(handle: number, selector: LanguageSelector | undefined, providedCodeActionKinds?: string[]): monaco.languages.CodeActionProvider {
        return {
            provideCodeActions: (model, range, monacoContext) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideCodeActions(handle, model.uri, this.m2p.asRange(range), this.m2p.asCodeActionContext(monacoContext))
                    .then(v => this.p2m.asCodeActions(v));
            }
        };
    }

    $registerRenameProvider(handle: number, selector: SerializedDocumentFilter[], supportsResolveLocation: boolean): void {
        const languageSelector = fromLanguageSelector(selector);
        const renameProvider = this.createRenameProvider(handle, languageSelector, supportsResolveLocation);
        const disposable = new DisposableCollection();
        for (const language of getLanguages()) {
            if (this.matchLanguage(languageSelector, language)) {
                disposable.push(monaco.languages.registerRenameProvider(language, renameProvider));
            }
        }
        this.disposables.set(handle, disposable);
    }

    protected createRenameProvider(handle: number, selector: LanguageSelector | undefined, supportsResolveLocation: boolean): monaco.languages.RenameProvider {
        return {
            provideRenameEdits: (model, position, newName, token) => {
                if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                    return undefined!;
                }
                return this.proxy.$provideRenameEdits(handle, model.uri, this.m2p.asPosition(position.lineNumber, position.column), newName)
                    .then(v => this.p2m.asWorkspaceEdit(v!));
            },
            resolveRenameLocation: supportsResolveLocation
                ? (model, position, token) => {
                    if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
                        return undefined!;
                    }
                    return this.proxy.$resolveRenameLocation(handle, model.uri, this.asPosition(position)).then(v => this.asRenameLocation(v!));
                }
                : undefined
        };
    }

    protected matchModel(selector: LanguageSelector | undefined, model: MonacoModelIdentifier): boolean {
        if (Array.isArray(selector)) {
            return selector.some(filter => this.matchModel(filter, model));
        }
        if (DocumentFilter.is(selector)) {
            if (!!selector.language && selector.language !== model.languageId) {
                return false;
            }
            if (!!selector.scheme && selector.scheme !== model.uri.scheme) {
                return false;
            }
            if (!!selector.pattern && !testGlob(selector.pattern, model.uri.path)) {
                return false;
            }
            return true;
        }
        return selector === model.languageId;
    }

    protected matchLanguage(selector: LanguageSelector | undefined, languageId: string): boolean {
        if (Array.isArray(selector)) {
            return selector.some(filter => this.matchLanguage(filter, languageId));
        }

        if (DocumentFilter.is(selector)) {
            return !selector.language || selector.language === languageId;
        }

        return selector === languageId;
    }
}

function reviveRegExp(regExp?: SerializedRegExp): RegExp | undefined {
    if (typeof regExp === 'undefined' || regExp === null) {
        return undefined;
    }
    return new RegExp(regExp.pattern, regExp.flags);
}

function reviveIndentationRule(indentationRule?: SerializedIndentationRule): monaco.languages.IndentationRule | undefined {
    if (typeof indentationRule === 'undefined' || indentationRule === null) {
        return undefined;
    }
    return {
        increaseIndentPattern: reviveRegExp(indentationRule.increaseIndentPattern)!,
        decreaseIndentPattern: reviveRegExp(indentationRule.decreaseIndentPattern)!,
        indentNextLinePattern: reviveRegExp(indentationRule.indentNextLinePattern),
        unIndentedLinePattern: reviveRegExp(indentationRule.unIndentedLinePattern),
    };
}

function reviveOnEnterRule(onEnterRule: SerializedOnEnterRule): monaco.languages.OnEnterRule {
    return {
        beforeText: reviveRegExp(onEnterRule.beforeText)!,
        afterText: reviveRegExp(onEnterRule.afterText),
        action: onEnterRule.action
    };
}

function reviveOnEnterRules(onEnterRules?: SerializedOnEnterRule[]): monaco.languages.OnEnterRule[] | undefined {
    if (typeof onEnterRules === 'undefined' || onEnterRules === null) {
        return undefined;
    }
    return onEnterRules.map(reviveOnEnterRule);
}
