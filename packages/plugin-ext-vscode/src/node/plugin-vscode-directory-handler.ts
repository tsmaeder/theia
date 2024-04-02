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
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as path from 'path';
import * as fs from '@theia/core/shared/fs-extra';
import { injectable } from '@theia/core/shared/inversify';

import { PluginDirectoryLayout, PluginDirectoryLayoutHandler, PluginEngineHandler } from '@theia/plugin-ext/lib/main/node/plugin-directory-layout';
import { DeployedPlugin, DeploymentKind, DeploymentLocation, PluginHost, PluginId, VersionedPluginId } from '@theia/installer';

export class VSCodePluginDeployerEntry implements DeployedPlugin {
    protected readonly _types: PluginHost[] = [];
    constructor(
        readonly id: VersionedPluginId,
        readonly location: DeploymentLocation,
        readonly uri: string,
        readonly relativePluginRoot: string,

        readonly kind: DeploymentKind,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        protected readonly pkgJson: any,
        readonly isUnderDevelopment: boolean = false) {

        if (this.pkgJson.main) {
            this._types.push(PluginHost.BACKEND);
        }
        if (this.pkgJson.browser) {
            this._types.push(PluginHost.FRONTEND);
        }
        if (this._types.length === 0) {
            this._types.push(PluginHost.BACKEND);
        }

    }

    get types(): readonly PluginHost[] {
        return this._types;
    }
}

@injectable()
export class VsixDirectoryLayoutHandler implements PluginDirectoryLayoutHandler {
    async handle(pluginRootPath: string): Promise<PluginDirectoryLayout | undefined> {
        try {
            await fs.access(path.resolve(pluginRootPath, 'extension.vsixmanifest'));
            await fs.access(path.resolve(pluginRootPath, 'extension/package.json'));
            return {
                assetRootPath: path.resolve(pluginRootPath, 'extension'),
                metadataFilePath: path.resolve(pluginRootPath, 'extension/package.json'),
            };
        } catch (e) {
            return undefined;
        }
    }
}

@injectable()
export class VsixEngineHandler implements PluginEngineHandler {
    async handle(location: DeploymentLocation, rootUri: string, deploymentKind: DeploymentKind, metadataContent: string): Promise<DeployedPlugin | undefined> {
        const packageJson = JSON.parse(metadataContent);
        const id = {
            id: `${packageJson.publisher || PluginId.UNPUBLISHED}.${packageJson.name}`.toLowerCase(),
            version: packageJson.version
        };
        if (packageJson.engines?.vscode) {
            return new VSCodePluginDeployerEntry(id, location, rootUri, 'extension', deploymentKind, packageJson);
        }
        return undefined;
    }
}
