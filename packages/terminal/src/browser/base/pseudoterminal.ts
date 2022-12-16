// *****************************************************************************
// Copyright (C) 2022 ST Microelectronics and others.
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
import URI from '@theia/core/lib/common/uri';

export interface TerminalDimensions {
    cols: number;
    rows: number;
}

export interface Pseudoterminal {
    id: string;
    /**
     * The terminal has produced output
     */
    onDidWrite: Event<string>;

    /**
     * Send text as input to the terminal
     * @param data the input text
     */
    sendText(data: string): void;

    /**
     * Set the output window of the terminal
     * @param dimensions the new dimensions
     */
    setDimensions(dimensions: TerminalDimensions): void;
    onDidChangeDimensions?: Event<TerminalDimensions | undefined>;

    close(): void;

    /**
     * Release all resources associated with this terminal. The instance cannot be used after this call
     */
    dispose(): void;

    /**
     * An event sent when this pty is disposed. If the dispose happended
     * becuase the pty process exited, the exit code is sent
     */
    onDisposed: Event<number | undefined>;

    hasChildProcesses(): Promise<boolean>;

    cwd?: Promise<URI>;

    processId?: number;
}
