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

import { EditorPosition, DecorationOptions, TaskDto, ProcessTaskDto } from '../api/plugin-api';
import * as model from '../api/model';
import * as theia from '@theia/plugin';
import * as types from './types-impl';
import { LanguageSelector, LanguageFilter, RelativePattern } from './languages';
import { isMarkdownString } from './markdown-string';
import URI from 'vscode-uri';
import * as lsp from 'vscode-languageserver-types';

const SIDE_GROUP = -2;
const ACTIVE_GROUP = -1;
import { SymbolInformation, Range as R, Position as P, SymbolKind as S, Location as L } from 'vscode-languageserver-types';
import { TheiaDockPanel } from '@theia/core/src/browser/shell/theia-dock-panel';

export function toViewColumn(ep?: EditorPosition): theia.ViewColumn | undefined {
    if (typeof ep !== 'number') {
        return undefined;
    }

    if (ep === EditorPosition.ONE) {
        return <number>types.ViewColumn.One;
    } else if (ep === EditorPosition.TWO) {
        return <number>types.ViewColumn.Two;
    } else if (ep === EditorPosition.THREE) {
        return <number>types.ViewColumn.Three;
    }

    return undefined;
}

export function fromViewColumn(column?: theia.ViewColumn): number {
    if (typeof column === 'number' && column >= types.ViewColumn.One) {
        return column - 1;
    }

    if (column! === <number>types.ViewColumn.Beside) {
        return SIDE_GROUP;
    }

    return ACTIVE_GROUP;
}

export function toWebviewPanelShowOptions(options: theia.ViewColumn | theia.WebviewPanelShowOptions): theia.WebviewPanelShowOptions {
    if (typeof options === 'object') {
        const showOptions = options as theia.WebviewPanelShowOptions;
        return {
            area: showOptions.area ? showOptions.area : types.WebviewPanelTargetArea.Main,
            viewColumn: showOptions.viewColumn ? fromViewColumn(showOptions.viewColumn) : undefined,
            preserveFocus: showOptions.preserveFocus ? showOptions.preserveFocus : false
        };
    }

    return {
        area: types.WebviewPanelTargetArea.Main,
        viewColumn: fromViewColumn(options as theia.ViewColumn),
        preserveFocus: false
    };
}

export function toSelection(selection: model.Selection): types.Selection {
    const start = toPosition(selection.anchor);
    const end = toPosition(selection.active);
    return new types.Selection(start, end);
}

export function fromSelection(selection: types.Selection): model.Selection {
    const { active, anchor } = selection;
    return {
        active: fromPosition(active),
        anchor: fromPosition(anchor)
    };
}

export function toRange(range: lsp.Range): types.Range {
    // if (!range) {
    //     return undefined;
    // }

    return new types.Range(toPosition(range.start), toPosition(range.end));
}

export function fromRange(range: theia.Range | undefined): lsp.Range | undefined {
    if (!range) {
        return undefined;
    }
    return {
        start: fromPosition(range.start),
        end: fromPosition(range.end)
    };
}

export function fromPosition(position: theia.Position): lsp.Position {
    return { line: position.line, character: position.character };
}

export function toPosition(position: lsp.Position): types.Position {
    return new types.Position(position.line, position.character);
}

// tslint:disable-next-line:no-any
function isDecorationOptions(something: any): something is theia.DecorationOptions {
    return (typeof something.range !== 'undefined');
}

export function isDecorationOptionsArr(something: theia.Range[] | theia.DecorationOptions[]): something is theia.DecorationOptions[] {
    if (something.length === 0) {
        return true;
    }
    return isDecorationOptions(something[0]) ? true : false;
}

export function fromRangeOrRangeWithMessage(ranges: theia.Range[] | theia.DecorationOptions[]): DecorationOptions[] {

    if (isDecorationOptionsArr(ranges)) {
        return ranges.map(r => {
            let hoverMessage;
            if (Array.isArray(r.hoverMessage)) {
                hoverMessage = fromManyMarkdown(r.hoverMessage);
            } else if (r.hoverMessage) {
                hoverMessage = fromMarkdown(r.hoverMessage);
            } else {
                hoverMessage = undefined;
            }
            return {
                range: fromRange(r.range)!,
                hoverMessage: hoverMessage,
                // tslint:disable-next-line:no-any
                renderOptions: <any> /* URI vs Uri */r.renderOptions
            };
        });
    } else {
        return ranges.map((r): DecorationOptions =>
            ({
                range: fromRange(r)!
            }));
    }
}

export function fromManyMarkdown(markup: (theia.MarkedString)[]): lsp.MarkupContent {
    let combined: string = '';
    for (const block of markup) {
        const markDown = fromMarkdown(block);
        combined = combined + markDown.value;
    }
    return <lsp.MarkupContent>{
        kind: lsp.MarkupKind.Markdown,
        value: combined
    };
}

interface Codeblock {
    language: string;
    value: string;
}

// tslint:disable-next-line:no-any
function isCodeblock(thing: any): thing is Codeblock {
    return thing && typeof thing === 'object'
        && typeof (<Codeblock>thing).language === 'string'
        && typeof (<Codeblock>thing).value === 'string';
}

export function fromMarkdown(markup: theia.MarkedString): lsp.MarkupContent {
    if (isCodeblock(markup)) {
        const { language, value } = markup;
        return { kind: lsp.MarkupKind.Markdown, value: '```' + language + '\n' + value + '\n```\n' };
    } else if (isMarkdownString(markup)) {
        return { kind: lsp.MarkupKind.Markdown, value: markup.value };
    } else if (typeof markup === 'string') {
        return { kind: lsp.MarkupKind.PlainText, value: <string>markup };
    } else {
        return { kind: lsp.MarkupKind.PlainText, value: '' };
    }
}

export function fromDocumentSelector(selector: theia.DocumentSelector | undefined): LanguageSelector | undefined {
    if (!selector) {
        return undefined;
    } else if (Array.isArray(selector)) {
        return <LanguageSelector>selector.map(fromDocumentSelector);
    } else if (typeof selector === 'string') {
        return selector;
    } else {
        return {
            language: selector.language,
            scheme: selector.scheme,
            pattern: fromGlobPattern(selector.pattern!)
        } as LanguageFilter;
    }

}

export function fromGlobPattern(pattern: theia.GlobPattern): string | RelativePattern {
    if (typeof pattern === 'string') {
        return pattern;
    }

    if (isRelativePattern(pattern)) {
        return new types.RelativePattern(pattern.base, pattern.pattern);
    }

    return pattern;
}

function isRelativePattern(obj: {}): obj is theia.RelativePattern {
    const rp = obj as theia.RelativePattern;
    return rp && typeof rp.base === 'string' && typeof rp.pattern === 'string';
}

export function fromCompletionItemKind(kind?: types.CompletionItemKind): lsp.CompletionItemKind {
    switch (kind) {
        case types.CompletionItemKind.Method: return lsp.CompletionItemKind.Method;
        case types.CompletionItemKind.Function: return lsp.CompletionItemKind.Function;
        case types.CompletionItemKind.Constructor: return lsp.CompletionItemKind.Constructor;
        case types.CompletionItemKind.Field: return lsp.CompletionItemKind.Field;
        case types.CompletionItemKind.Variable: return lsp.CompletionItemKind.Variable;
        case types.CompletionItemKind.Class: return lsp.CompletionItemKind.Class;
        case types.CompletionItemKind.Interface: return lsp.CompletionItemKind.Interface;
        case types.CompletionItemKind.Struct: return lsp.CompletionItemKind.Struct;
        case types.CompletionItemKind.Module: return lsp.CompletionItemKind.Module;
        case types.CompletionItemKind.Property: return lsp.CompletionItemKind.Property;
        case types.CompletionItemKind.Unit: return lsp.CompletionItemKind.Unit;
        case types.CompletionItemKind.Value: return lsp.CompletionItemKind.Value;
        case types.CompletionItemKind.Constant: return lsp.CompletionItemKind.Constant;
        case types.CompletionItemKind.Enum: return lsp.CompletionItemKind.Enum;
        case types.CompletionItemKind.EnumMember: return lsp.CompletionItemKind.EnumMember;
        case types.CompletionItemKind.Keyword: return lsp.CompletionItemKind.Keyword;
        case types.CompletionItemKind.Snippet: return lsp.CompletionItemKind.Snippet;
        case types.CompletionItemKind.Text: return lsp.CompletionItemKind.Text;
        case types.CompletionItemKind.Color: return lsp.CompletionItemKind.Color;
        case types.CompletionItemKind.File: return lsp.CompletionItemKind.File;
        case types.CompletionItemKind.Reference: return lsp.CompletionItemKind.Reference;
        case types.CompletionItemKind.Folder: return lsp.CompletionItemKind.Folder;
        case types.CompletionItemKind.Event: return lsp.CompletionItemKind.Event;
        case types.CompletionItemKind.Operator: return lsp.CompletionItemKind.Operator;
        case types.CompletionItemKind.TypeParameter: return lsp.CompletionItemKind.TypeParameter;
    }
    return lsp.CompletionItemKind.Property;
}

export function toCompletionItemKind(type?: lsp.CompletionItemKind): types.CompletionItemKind {
    if (type) {
        switch (type) {
            case lsp.CompletionItemKind.Method: return types.CompletionItemKind.Method;
            case lsp.CompletionItemKind.Function: return types.CompletionItemKind.Function;
            case lsp.CompletionItemKind.Constructor: return types.CompletionItemKind.Constructor;
            case lsp.CompletionItemKind.Field: return types.CompletionItemKind.Field;
            case lsp.CompletionItemKind.Variable: return types.CompletionItemKind.Variable;
            case lsp.CompletionItemKind.Class: return types.CompletionItemKind.Class;
            case lsp.CompletionItemKind.Interface: return types.CompletionItemKind.Interface;
            case lsp.CompletionItemKind.Struct: return types.CompletionItemKind.Struct;
            case lsp.CompletionItemKind.Module: return types.CompletionItemKind.Module;
            case lsp.CompletionItemKind.Property: return types.CompletionItemKind.Property;
            case lsp.CompletionItemKind.Unit: return types.CompletionItemKind.Unit;
            case lsp.CompletionItemKind.Value: return types.CompletionItemKind.Value;
            case lsp.CompletionItemKind.Constant: return types.CompletionItemKind.Constant;
            case lsp.CompletionItemKind.Enum: return types.CompletionItemKind.Enum;
            case lsp.CompletionItemKind.EnumMember: return types.CompletionItemKind.EnumMember;
            case lsp.CompletionItemKind.Keyword: return types.CompletionItemKind.Keyword;
            case lsp.CompletionItemKind.Snippet: return types.CompletionItemKind.Snippet;
            case lsp.CompletionItemKind.Text: return types.CompletionItemKind.Text;
            case lsp.CompletionItemKind.Color: return types.CompletionItemKind.Color;
            case lsp.CompletionItemKind.File: return types.CompletionItemKind.File;
            case lsp.CompletionItemKind.Reference: return types.CompletionItemKind.Reference;
            case lsp.CompletionItemKind.Folder: return types.CompletionItemKind.Folder;
            case lsp.CompletionItemKind.Event: return types.CompletionItemKind.Event;
            case lsp.CompletionItemKind.Operator: return types.CompletionItemKind.Operator;
            case lsp.CompletionItemKind.TypeParameter: return types.CompletionItemKind.TypeParameter;
        }
    }
    return types.CompletionItemKind.Property;
}

export function fromTextEdit(edit: theia.TextEdit): lsp.TextEdit {
    return <lsp.TextEdit>{
        newText: edit.newText,
        range: fromRange(edit.range)
    };
}

export function fromLanguageSelector(selector: theia.DocumentSelector): LanguageSelector | undefined {
    if (!selector) {
        return undefined;
    } else if (Array.isArray(selector)) {
        return <LanguageSelector>selector.map(fromLanguageSelector);
    } else if (typeof selector === 'string') {
        return selector;
    } else {
        return <LanguageFilter>{
            language: selector.language,
            scheme: selector.scheme,
            pattern: fromGlobPattern(selector.pattern!)
        };
    }
}

export function fromHover(hover: theia.Hover): lsp.Hover {
    return <lsp.Hover>{
        range: fromRange(hover.range),
        contents: fromManyMarkdown(hover.contents)
    };
}

export function fromLocation(location: theia.Location): lsp.Location {
    return <lsp.Location>{
        uri: location.uri.toString(),
        range: fromRange(location.range)
    };
}

export function fromDefinitionLink(definitionLink: theia.DefinitionLink): lsp.DefinitionLink {
    return <lsp.DefinitionLink>{
        targetUri: definitionLink.targetUri.toString(),
        targetRange: fromRange(definitionLink.targetRange),
        originSelectionRange: definitionLink.originSelectionRange ? fromRange(definitionLink.originSelectionRange) : undefined,
        targetSelectionRange: definitionLink.targetSelectionRange ? fromRange(definitionLink.targetSelectionRange) : undefined
    };
}

export function fromDocumentLink(definitionLink: theia.DocumentLink): lsp.DocumentLink {
    return <lsp.DocumentLink>{
        range: fromRange(definitionLink.range),
        url: definitionLink.target && definitionLink.target.toString()
    };
}

export function fromDocumentHighlightKind(kind?: theia.DocumentHighlightKind): lsp.DocumentHighlightKind | undefined {
    switch (kind) {
        case types.DocumentHighlightKind.Text: return lsp.DocumentHighlightKind.Text;
        case types.DocumentHighlightKind.Read: return lsp.DocumentHighlightKind.Read;
        case types.DocumentHighlightKind.Write: return lsp.DocumentHighlightKind.Write;
    }
    return lsp.DocumentHighlightKind.Text;
}

export function fromDocumentHighlight(documentHighlight: theia.DocumentHighlight): lsp.DocumentHighlight {
    return <lsp.DocumentHighlight>{
        range: fromRange(documentHighlight.range),
        kind: fromDocumentHighlightKind(documentHighlight.kind)
    };
}

export function toInternalCommand(external: theia.Command): lsp.Command {
    // we're deprecating Command.id, so it has to be optional.
    // Existing code will have compiled against a non - optional version of the field, so asserting it to exist is ok
    // tslint:disable-next-line: no-any
    return KnownCommands.map((external.command || external.id)!, external.arguments, (mappedId: string, mappedArgs: any[]) =>
        ({
            command: mappedId,
            title: external.title || external.label || ' ',
            tooltip: external.tooltip,
            arguments: mappedArgs
        }));
}

export namespace KnownCommands {
    // tslint:disable: no-any
    const mappings: { [id: string]: [string, (args: any[] | undefined) => any[] | undefined] } = {};
    mappings['editor.action.showReferences'] = ['textEditor.commands.showReferences', createConversionFunction(
        (uri: URI) => uri.toString(),
        fromPosition,
        toArrayConversion(fromLocation))];

    export function map<T>(id: string, args: any[] | undefined, toDo: (mappedId: string, mappedArgs: any[] | undefined) => T): T {
        if (mappings[id]) {
            return toDo(mappings[id][0], mappings[id][1](args));
        } else {
            return toDo(id, args);
        }
    }

    type conversionFunction = ((parameter: any) => any) | undefined;
    function createConversionFunction(...conversions: conversionFunction[]): (args: any[] | undefined) => any[] | undefined {
        return function (args: any[] | undefined): any[] | undefined {
            if (!args) {
                return args;
            }
            return args.map(function (arg: any, index: number): any {
                if (index < conversions.length) {
                    const conversion = conversions[index];
                    if (conversion) {
                        return conversion(arg);
                    }
                }
                return arg;
            });
        };
    }
}

function toArrayConversion<T, U>(f: (a: T) => U): (a: T[]) => U[] {
    return function (a: T[]) {
        return a.map(f);
    };
}

// tslint:disable-next-line:no-any
export function fromWorkspaceEdit(value: theia.WorkspaceEdit, documents?: any): lsp.WorkspaceEdit {
    const result: lsp.WorkspaceEdit = {
        changes: {},
        documentChanges: []
    };
    for (const entry of (value as types.WorkspaceEdit)._allEntries()) {
        const [uri, uriOrEdits] = entry;
        if (Array.isArray(uriOrEdits)) {
            // text edits
            result.changes![uri.toString()] = uriOrEdits.map(fromTextEdit);

        } else {
            const change = createFileChange(uri.toString(), uriOrEdits.toString(), entry[2]);
            // resource edits
            if (change) {
                result.documentChanges!.push(change);
            }
        }
    }
    return result;
}

function createFileChange(oldUri: string, newUri: string, options?: types.FileOperationOptions) {
    if (oldUri && newUri) {
        return lsp.RenameFile.create(oldUri, newUri, options);
    } else if (oldUri) {
        return lsp.DeleteFile.create(oldUri, options);
    } else if (newUri) {
        return lsp.CreateFile.create(newUri, options);
    } else {
        console.warn('Resource change change with no old or new URI: ignoring');
        return undefined;
    }
}

export namespace SymbolKind {
    // tslint:disable-next-line:no-null-keyword
    const fromMapping: { [kind: number]: lsp.SymbolKind } = Object.create(null);
    fromMapping[theia.SymbolKind.File] = lsp.SymbolKind.File;
    fromMapping[theia.SymbolKind.Module] = lsp.SymbolKind.Module;
    fromMapping[theia.SymbolKind.Namespace] = lsp.SymbolKind.Namespace;
    fromMapping[theia.SymbolKind.Package] = lsp.SymbolKind.Package;
    fromMapping[theia.SymbolKind.Class] = lsp.SymbolKind.Class;
    fromMapping[theia.SymbolKind.Method] = lsp.SymbolKind.Method;
    fromMapping[theia.SymbolKind.Property] = lsp.SymbolKind.Property;
    fromMapping[theia.SymbolKind.Field] = lsp.SymbolKind.Field;
    fromMapping[theia.SymbolKind.Constructor] = lsp.SymbolKind.Constructor;
    fromMapping[theia.SymbolKind.Enum] = lsp.SymbolKind.Enum;
    fromMapping[theia.SymbolKind.Interface] = lsp.SymbolKind.Interface;
    fromMapping[theia.SymbolKind.Function] = lsp.SymbolKind.Function;
    fromMapping[theia.SymbolKind.Variable] = lsp.SymbolKind.Variable;
    fromMapping[theia.SymbolKind.Constant] = lsp.SymbolKind.Constant;
    fromMapping[theia.SymbolKind.String] = lsp.SymbolKind.String;
    fromMapping[theia.SymbolKind.Number] = lsp.SymbolKind.Number;
    fromMapping[theia.SymbolKind.Boolean] = lsp.SymbolKind.Boolean;
    fromMapping[theia.SymbolKind.Array] = lsp.SymbolKind.Array;
    fromMapping[theia.SymbolKind.Object] = lsp.SymbolKind.Object;
    fromMapping[theia.SymbolKind.Key] = lsp.SymbolKind.Key;
    fromMapping[theia.SymbolKind.Null] = lsp.SymbolKind.Null;
    fromMapping[theia.SymbolKind.EnumMember] = lsp.SymbolKind.EnumMember;
    fromMapping[theia.SymbolKind.Struct] = lsp.SymbolKind.Struct;
    fromMapping[theia.SymbolKind.Event] = lsp.SymbolKind.Event;
    fromMapping[theia.SymbolKind.Operator] = lsp.SymbolKind.Operator;
    fromMapping[theia.SymbolKind.TypeParameter] = lsp.SymbolKind.TypeParameter;

    export function fromSymbolKind(kind: theia.SymbolKind): lsp.SymbolKind {
        return fromMapping[kind] || lsp.SymbolKind.Property;
    }

    export function toSymbolKind(kind: lsp.SymbolKind): theia.SymbolKind {
        for (const k in fromMapping) {
            if (fromMapping[k] === kind) {
                return Number(k);
            }
        }
        return theia.SymbolKind.Property;
    }
}

export function fromDocumentSymbol(info: theia.DocumentSymbol): lsp.DocumentSymbol {
    const result: lsp.DocumentSymbol = {
        name: info.name,
        detail: info.detail,
        range: fromRange(info.range)!,
        selectionRange: fromRange(info.selectionRange)!,
        kind: SymbolKind.fromSymbolKind(info.kind)
    };
    if (info.children) {
        result.children = info.children.map(fromDocumentSymbol);
    }
    return result;
}

export function toWorkspaceFolder(folder: model.WorkspaceFolder): theia.WorkspaceFolder {
    return {
        uri: URI.revive(folder.uri),
        name: folder.name,
        index: folder.index
    };
}

export function fromTask(task: theia.Task): TaskDto | undefined {
    if (!task) {
        return undefined;
    }

    const taskDto = {} as TaskDto;
    taskDto.label = task.name;
    taskDto.source = task.source;

    const taskDefinition = task.definition;
    if (!taskDefinition) {
        return taskDto;
    }

    taskDto.type = taskDefinition.type;
    const { type, ...properties } = taskDefinition;
    for (const key in properties) {
        if (properties.hasOwnProperty(key)) {
            taskDto[key] = properties[key];
        }
    }

    const execution = task.execution;
    if (!execution) {
        return taskDto;
    }

    const processTaskDto = taskDto as ProcessTaskDto;
    if (taskDefinition.type === 'shell') {
        return fromShellExecution(execution, processTaskDto);
    }

    if (taskDefinition.type === 'process') {
        return fromProcessExecution(<theia.ProcessExecution>execution, processTaskDto);
    }

    return processTaskDto;
}

export function toTask(taskDto: TaskDto): theia.Task {
    if (!taskDto) {
        throw new Error('Task should be provided for converting');
    }

    const { type, label, source, command, args, options, windows, cwd, ...properties } = taskDto;
    const result = {} as theia.Task;
    result.name = label;
    result.source = source;

    const taskType = type;
    const taskDefinition: theia.TaskDefinition = {
        type: taskType
    };

    result.definition = taskDefinition;

    if (taskType === 'process') {
        result.execution = getProcessExecution(taskDto as ProcessTaskDto);
    }

    if (taskType === 'shell') {
        result.execution = getShellExecution(taskDto as ProcessTaskDto);
    }

    if (!properties) {
        return result;
    }

    for (const key in properties) {
        if (properties.hasOwnProperty(key)) {
            taskDefinition[key] = properties[key];
        }
    }

    return result;
}

export function fromProcessExecution(execution: theia.ProcessExecution, processTaskDto: ProcessTaskDto): ProcessTaskDto {
    processTaskDto.command = execution.process;
    processTaskDto.args = execution.args;

    const options = execution.options;
    if (options) {
        processTaskDto.cwd = options.cwd;
        processTaskDto.options = options;
    }
    return processTaskDto;
}

export function fromShellExecution(execution: theia.ShellExecution, processTaskDto: ProcessTaskDto): ProcessTaskDto {
    const options = execution.options;
    if (options) {
        processTaskDto.cwd = options.cwd;
        processTaskDto.options = getShellExecutionOptions(options);
    }

    const commandLine = execution.commandLine;
    if (commandLine) {
        const args = commandLine.split(' ');
        const taskCommand = args.shift();

        if (taskCommand) {
            processTaskDto.command = taskCommand;
        }

        processTaskDto.args = args;
        return processTaskDto;
    }

    const command = execution.command;
    if (typeof command === 'string') {
        processTaskDto.command = command;
        processTaskDto.args = getShellArgs(execution.args);
        return processTaskDto;
    } else {
        throw new Error('Converting ShellQuotedString command is not implemented');
    }
}

export function getProcessExecution(processTaskDto: ProcessTaskDto): theia.ProcessExecution {
    const execution = {} as theia.ProcessExecution;

    execution.process = processTaskDto.command;

    const processArgs = processTaskDto.args;
    execution.args = processArgs ? processArgs : [];

    const options = processTaskDto.options;
    execution.options = options ? options : {};
    execution.options.cwd = processTaskDto.cwd;

    return execution;
}

export function getShellExecution(processTaskDto: ProcessTaskDto): theia.ShellExecution {
    const execution = {} as theia.ShellExecution;

    const options = processTaskDto.options;
    execution.options = options ? options : {};
    execution.options.cwd = processTaskDto.cwd;
    execution.args = processTaskDto.args;

    execution.command = processTaskDto.command;

    return execution;
}

export function getShellArgs(args: undefined | (string | theia.ShellQuotedString)[]): string[] {
    if (!args || args.length === 0) {
        return [];
    }

    const element = args[0];
    if (typeof element === 'string') {
        return args as string[];
    }

    const result: string[] = [];
    const shellQuotedArgs = args as theia.ShellQuotedString[];

    shellQuotedArgs.forEach(arg => {
        result.push(arg.value);
    });

    return result;
}

// tslint:disable-next-line:no-any
export function getShellExecutionOptions(options: theia.ShellExecutionOptions): { [key: string]: any } {
    // tslint:disable-next-line:no-any
    const result = {} as { [key: string]: any };

    const env = options.env;
    if (env) {
        result['env'] = env;
    }

    const executable = options.executable;
    if (executable) {
        result['executable'] = executable;
    }

    const shellQuoting = options.shellQuoting;
    if (shellQuoting) {
        result['shellQuoting'] = shellQuoting;
    }

    const shellArgs = options.shellArgs;
    if (shellArgs) {
        result['shellArgs'] = shellArgs;
    }

    return result;
}

export function fromSymbolInformation(symbolInformation: theia.SymbolInformation): SymbolInformation | undefined {
    if (!symbolInformation) {
        return undefined;
    }

    if (symbolInformation.location && symbolInformation.location.range) {
        const p1 = P.create(symbolInformation.location.range.start.line, symbolInformation.location.range.start.character);
        const p2 = P.create(symbolInformation.location.range.end.line, symbolInformation.location.range.end.character);
        return SymbolInformation.create(symbolInformation.name, symbolInformation.kind++ as S, R.create(p1, p2),
            symbolInformation.location.uri.toString(), symbolInformation.containerName);
    }

    return <SymbolInformation>{
        name: symbolInformation.name,
        containerName: symbolInformation.containerName,
        kind: symbolInformation.kind++ as S,
        location: {
            uri: symbolInformation.location.uri.toString()
        }
    };
}

export function toSymbolInformation(symbolInformation: SymbolInformation): theia.SymbolInformation | undefined {
    if (!symbolInformation) {
        return undefined;
    }

    return <theia.SymbolInformation>{
        name: symbolInformation.name,
        containerName: symbolInformation.containerName,
        kind: symbolInformation.kind,
        location: {
            uri: URI.parse(symbolInformation.location.uri),
            range: symbolInformation.location.range
        }
    };
}

export function fromFoldingRange(foldingRange: theia.FoldingRange): lsp.FoldingRange {
    const range = lsp.FoldingRange.create(foldingRange.start, foldingRange.end);
    if (foldingRange.kind) {
        range.kind = fromFoldingRangeKind(foldingRange.kind);
    }
    return range;
}

export function fromFoldingRangeKind(kind: theia.FoldingRangeKind | undefined): lsp.FoldingRangeKind | undefined {
    if (kind) {
        switch (kind) {
            case types.FoldingRangeKind.Comment:
                return lsp.FoldingRangeKind.Comment;
            case types.FoldingRangeKind.Imports:
                return lsp.FoldingRangeKind.Imports;
            case types.FoldingRangeKind.Region:
                return lsp.FoldingRangeKind.Region;
        }
    }
    return undefined;
}

export function fromColor(color: types.Color): [number, number, number, number] {
    return [color.red, color.green, color.blue, color.alpha];
}

export function toColor(color: [number, number, number, number]): types.Color {
    return new types.Color(color[0], color[1], color[2], color[3]);
}

export function fromColorPresentation(colorPresentation: theia.ColorPresentation): lsp.ColorPresentation {
    return {
        label: colorPresentation.label,
        textEdit: colorPresentation.textEdit ? fromTextEdit(colorPresentation.textEdit) : undefined,
        additionalTextEdits: colorPresentation.additionalTextEdits ? colorPresentation.additionalTextEdits.map(value => fromTextEdit(value)) : undefined
    };
}

export function fromDiagnostic(diagnostic: theia.Diagnostic): lsp.Diagnostic {
    return lsp.Diagnostic.create(fromRange(diagnostic.range)!,
        diagnostic.message,
        <lsp.DiagnosticSeverity>diagnostic.severity,
        diagnostic.code,
        diagnostic.source,
        fromRelatedInformationArray(diagnostic.relatedInformation));
}

function fromRelatedInformationArray(info?: theia.DiagnosticRelatedInformation[]): lsp.DiagnosticRelatedInformation[] | undefined {
    if (!info) {
        return undefined;
    }
    return info.map(fromRelatedInformation);
}

function fromRelatedInformation(info: theia.DiagnosticRelatedInformation): lsp.DiagnosticRelatedInformation {
    return lsp.DiagnosticRelatedInformation.create(fromLocation(info.location), info.message);
}
