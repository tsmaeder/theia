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

import { inject, injectable, named } from '@theia/core/shared/inversify';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ContributionProvider, URI } from '@theia/core';
import { DeployedPlugin, DeployedPluginHandler, DeploymentKind, DeploymentLocation, PluginHost, PluginId, VersionedPluginId } from '@theia/installer';

export const PluginDirectoryLayoutHandler = Symbol('PluginDirectoryLayoutHandler');

export interface PluginDirectoryLayout {
    readonly assetRootPath: string;
    readonly metadataFilePath: string;
}

export interface PluginDirectoryLayoutHandler {
    handle(pluginRootPath: string): Promise<PluginDirectoryLayout | undefined>;
}

export const PluginEngineHandler = Symbol('PluginEngineHandler');
export interface PluginEngineHandler {
    handle(location: DeploymentLocation, rootUri: string, deploymentKind: DeploymentKind, metadataContent: string): Promise<DeployedPlugin | undefined>;
}

@injectable()
export class DirectoryDeployedPluginHandler implements DeployedPluginHandler {

    @inject(ContributionProvider) @named(PluginDirectoryLayoutHandler)
    protected readonly layoutHandlers: ContributionProvider<PluginDirectoryLayoutHandler>;

    @inject(ContributionProvider) @named(PluginEngineHandler)
    protected readonly engineHandlers: ContributionProvider<PluginEngineHandler>;

    async handle(location: DeploymentLocation, pluginUri: string, deploymentKind: DeploymentKind): Promise<DeployedPlugin | undefined> {
        const pluginDirectory = new URI(pluginUri).path.fsPath();
        for (const layoutHandler of this.layoutHandlers.getContributions()) {
            const layout = await layoutHandler.handle(pluginDirectory);
            if (layout) {
                const contents: string = await fs.readFile(layout.metadataFilePath, 'utf-8');
                for (const engineHandler of this.engineHandlers.getContributions()) {
                    const entry = await engineHandler.handle(location, pluginDirectory, deploymentKind, contents);
                    if (entry) {
                        return entry;
                    }
                }
            }
        }
        return undefined;
    }
}

@injectable()
export class PluginSourceDirectoryLayoutHandler implements PluginDirectoryLayoutHandler {
    async handle(pluginRootPath: string): Promise<PluginDirectoryLayout | undefined> {
        try {
            const pkgJson = path.resolve(pluginRootPath, 'package.json');
            await fs.access(pkgJson);
            return {
                assetRootPath: pluginRootPath,
                metadataFilePath: pkgJson
            };
        } catch (e) {
            return undefined;
        }
    }
}

@injectable()
export class TarballDirectoryLayoutHandler implements PluginDirectoryLayoutHandler {
    async handle(pluginRootPath: string): Promise<PluginDirectoryLayout | undefined> {
        try {
            const pkgJson = path.resolve(pluginRootPath, 'package', 'package.json');
            await fs.access(pkgJson);
            return {
                assetRootPath: pluginRootPath,
                metadataFilePath: pkgJson
            };
        } catch (e) {
            return undefined;
        }
    }
}

export class TheiaPluginDeployerEntry implements DeployedPlugin {
    protected readonly _types: PluginHost[] = [];
    constructor(
        readonly id: VersionedPluginId,
        readonly uri: string,
        readonly relativePluginRoot: string,
        readonly location: DeploymentLocation,
        readonly kind: DeploymentKind,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        protected readonly pkgJson: any,
        readonly isUnderDevelopment: boolean = false) {

        if (this.pkgJson.theiaPlugin?.backend) {
            this._types.push(PluginHost.BACKEND);
        }
        if (this.pkgJson.theiaPlugin?.frontend) {
            this._types.push(PluginHost.FRONTEND);
        }
        if (this.pkgJson.theiaPlugin?.headless) {
            this._types.push(PluginHost.HEADLESS);
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
export class TheiaPluginEngineHandler implements PluginEngineHandler {
    async handle(location: DeploymentLocation, rootUri: string, deploymentKind: DeploymentKind, metadataContent: string): Promise<DeployedPlugin | undefined> {
        const packageJson = JSON.parse(metadataContent);
        const id = {
            id: `${packageJson.publisher || PluginId.UNPUBLISHED}.${packageJson.name}`.toLowerCase(),
            version: packageJson.version
        };
        if (packageJson.engines?.theia) {
            return new TheiaPluginDeployerEntry(id, rootUri, '', location, deploymentKind, packageJson);
        }
        return undefined;
    }
}
