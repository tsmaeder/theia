// *****************************************************************************
// Copyright (C) 2024 STMicroelectronics and others.
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
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { RpcServer } from '@theia/core';
import { DeployedPlugin, PluginId } from '@theia/installer';

export const installerBackendServicePath = 'services/installer';

export const InstallerBackendService = Symbol('InstallerBackendService');
export const InstallerClient = Symbol('InstallerClient');

export interface InstallerClient {
    installedPluginsChanged(): void;
}

export interface InstallerBackendService extends RpcServer<InstallerClient> {
    install(uris: string[], force: boolean): Promise<void>;
    uninstall(id: string, version?: string): Promise<boolean>;
    getUninstalledPlugins(): Promise<PluginId.VersionedId[]>;
    getInstalledPlugins(): Promise<readonly DeployedPlugin[]>;
}
