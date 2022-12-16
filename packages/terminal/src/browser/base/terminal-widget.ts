// *****************************************************************************
// Copyright (C) 2018 Red Hat, Inc. and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { Event } from '@theia/core';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { BaseWidget } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { TerminalSearchWidget } from '../search/terminal-search-widget';
import { TerminalFactory } from '../terminal-factories';
import { Pseudoterminal, TerminalDimensions } from './pseudoterminal';

export interface TerminalExitStatus {
    readonly code: number | undefined;
}

/**
 * Terminal UI widget.
 */
export abstract class TerminalWidget extends BaseWidget {
    /** Terminal kind that indicates whether a terminal is created by a user or by some extension for a user */
    abstract readonly kind: 'user' | string;

    abstract pty: Pseudoterminal | undefined;
    readonly waitForPty: Deferred<Pseudoterminal> = new Deferred();

    abstract readonly terminalId: string | undefined;
    abstract readonly dimensions: TerminalDimensions;

    abstract readonly exitStatus: TerminalExitStatus | undefined;

    /** Terminal widget can be hidden from users until explicitly shown once. */
    abstract readonly hiddenFromUser: boolean;

    /** The last CWD assigned to the terminal, useful when attempting getCwdURI on a task terminal fails */
    lastCwd: URI;

    /**
     * Start terminal and return terminal id.
     * @param ptyFactory - a factory to create a Pseudoterminal.
     */
    abstract start<T extends Pseudoterminal>(pytFactory: TerminalFactory<T>): Promise<T>;

    /**
     * Send text to the terminal server.
     * @param text - text content.
     */
    abstract sendText(text: string): void;

    /** Event that fires when the terminal is connected or reconnected */
    abstract onDidOpen: Event<void>;

    /** Event that fires when the terminal fails to connect or reconnect */
    abstract onDidOpenFailure: Event<void>;

    /** Event that fires when the terminal size changed */
    abstract onSizeChanged: Event<{ cols: number; rows: number; }>;

    /** Event that fires when the terminal receives a key event. */
    abstract onKey: Event<{ key: string, domEvent: KeyboardEvent }>;

    /** Event that fires when the terminal input data */
    abstract onData: Event<string>;

    abstract scrollLineUp(): void;

    abstract scrollLineDown(): void;

    abstract scrollToTop(): void;

    abstract scrollToBottom(): void;

    abstract scrollPageUp(): void;

    abstract scrollPageDown(): void;

    abstract resetTerminal(): void;
    /**
     * Event which fires when terminal did closed. Event value contains closed terminal widget definition.
     */
    abstract onTerminalDidClose: Event<TerminalWidget>;

    /**
     * Cleat terminal output.
     */
    abstract clearOutput(): void;

    abstract writeLine(line: string): void;

    abstract write(data: string): void;

    abstract resize(cols: number, rows: number): void;

    /**
     * Return Terminal search box widget.
     */
    abstract getSearchBox(): TerminalSearchWidget;
    /**
     * Whether the terminal process has child processes.
     */
    abstract hasChildProcesses(): Promise<boolean>;

    abstract setTitle(title: string): void;

    abstract waitOnExit(waitOnExit?: boolean | string): void;
}

/**
 * Terminal widget options.
 */
export const TerminalWidgetOptions = Symbol('TerminalWidgetOptions');
export interface TerminalWidgetOptions {

    /**
     * Human readable terminal representation on the UI.
     */
    readonly title?: string;

    /**
     * In case `destroyTermOnClose` is true - terminal process will be destroyed on close terminal widget, otherwise will be kept
     * alive.
     */
    readonly destroyTermOnClose?: boolean;

    /**
     * Terminal server side can send to the client `terminal title` to display this value on the UI. If
     * useServerTitle = true then display this title, otherwise display title defined by 'title' argument.
     */
    readonly useServerTitle?: boolean;

    /**
     * Terminal id. Should be unique for all DOM.
     */
    readonly id?: string;

    /**
     * Terminal attributes. Can be useful to apply some implementation specific information.
     */
    readonly attributes?: { [key: string]: string | null };

    /**
     * Terminal kind that indicates whether a terminal is created by a user or by some extension for a user
     */
    readonly kind?: 'user' | string;

    /**
     * When enabled the terminal will run the process as normal but not be surfaced to the user until `Terminal.show` is called.
     */
    readonly hideFromUser?: boolean;
}
