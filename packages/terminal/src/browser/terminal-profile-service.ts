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

import { TerminalWidget } from './base/terminal-widget';

export const TerminalProfileService = Symbol('TerminalProfileService');

export interface TerminalProfile {
    readonly label: string;
    start(): TerminalWidget | undefined;
}

export interface TerminalProfileService {
    registerTerminalProfile(id: string, profile: TerminalProfile): void;
}

export class DefaultTerminalProfileService implements TerminalProfileService {
    protected _profiles: Map<string, TerminalProfile> = new Map();

    registerTerminalProfile(id: string, profile: TerminalProfile): void {
        if (this._profiles.has(id)) {
            throw new Error(`Profile with id '${id} is already registered`);
        }
        this._profiles.set(id, profile);
    }

    getProfile(id: string): TerminalProfile | undefined {
        return this._profiles.get(id);
    }

    get profiles(): TerminalProfile[] {
        return [...this._profiles.values()];
    }
}
