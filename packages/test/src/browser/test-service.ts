// *****************************************************************************
// Copyright (C) 2022 STMicroelectronics and others.
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
import { Disposable, URI } from '@theia/core/lib/common';

export enum TestRunProfileKind {
    Run = 1,
    Debug = 2,
    Coverage = 3
}

export interface TestRunProfile {
    readonly kind: TestRunProfileKind;
    readonly isDefault: boolean;
    run(): void;
    configure(): void;
}

export interface TestRun {
    cancel(): void;
    readonly name: string;
    readonly isRunning: boolean;
    readonly queued: TestItem[];
    readonly started: TestItem[];
    readonly skipped: TestItem[];
    readonly failures: TestFailure[];
    readonly errors: TestFailure[];
    readonly passed: TestSuccess[];

    // output?
}

export interface TestFailure {
    readonly duration?: number;
    readonly item: TestItem;
    readonly messages: TestMessage[];
}

export interface TestSuccess {
    readonly duration?: number;
    readonly item: TestItem;
}

export interface TestMessage {
    readonly expected?: string;
    readonly actual?: string;
    // readonly location: Location;
    readonly message: string; // | MarkdownString;
}

export interface TestItem {
    readonly id: string;
    readonly label: string;
    // readonly range: Range;
    readonly sortKey?: string;
    readonly tags: string[];
    readonly uri: URI;
    readonly busy: boolean;
    readonly canResolveChildren: boolean;
    readonly children: TestItem[];
    readonly description?: string;
    readonly error?: string; // | MarkdownString
}

export interface TestController {
    readonly id: string;
    readonly label: string;
    readonly tests: TestItem[];
    readonly testRunProfiles: TestRunProfile[];
    readonly testRuns: TestRun[];
}

export interface TestService {
    registerTestController(controller: TestController): Disposable;
}
