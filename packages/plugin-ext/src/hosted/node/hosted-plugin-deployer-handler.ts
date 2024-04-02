// *****************************************************************************
// Copyright (C) 2019 RedHat and others.
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

import { injectable, inject } from '@theia/core/shared/inversify';
import { ILogger, URI } from '@theia/core';
import {
    PluginDeployerHandler, PluginEntryPoint, DeployedPlugin
} from '../../common/plugin-protocol';
import { HostedPluginReader } from './plugin-reader';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { HostedPluginLocalizationService } from './hosted-plugin-localization-service';
import { Stopwatch } from '@theia/core/lib/common';
import { DeployedPlugin as DeployerPlugin, PluginId, VersionedIdString } from '@theia/installer';

@injectable()
export class HostedPluginDeployerHandler implements PluginDeployerHandler {

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(HostedPluginReader)
    private readonly reader: HostedPluginReader;

    @inject(HostedPluginLocalizationService)
    private readonly localizationService: HostedPluginLocalizationService;

    @inject(Stopwatch)
    protected readonly stopwatch: Stopwatch;

    private readonly deployedLocations = new Map<VersionedIdString, Set<string>>();

    /**
     * Managed plugin metadata backend entries.
     */
    private readonly deployedBackendPlugins = new Map<VersionedIdString, DeployedPlugin>();

    /**
     * Managed plugin metadata frontend entries.
     */
    private readonly deployedFrontendPlugins = new Map<VersionedIdString, DeployedPlugin>();

    private backendPluginsMetadataDeferred = new Deferred<void>();

    private frontendPluginsMetadataDeferred = new Deferred<void>();

    async getDeployedFrontendPluginIds(): Promise<VersionedIdString[]> {
        // await first deploy
        await this.frontendPluginsMetadataDeferred.promise;
        // fetch the last deployed state
        return Array.from(this.deployedFrontendPlugins.keys());
    }

    async getDeployedBackendPluginIds(): Promise<VersionedIdString[]> {
        // await first deploy
        await this.backendPluginsMetadataDeferred.promise;
        // fetch the last deployed state
        return Array.from(this.deployedBackendPlugins.keys());
    }

    async getDeployedBackendPlugins(): Promise<DeployedPlugin[]> {
        // await first deploy
        await this.backendPluginsMetadataDeferred.promise;
        // fetch the last deployed state
        return Array.from(this.deployedBackendPlugins.values());
    }

    getDeployedPlugin(pluginId: PluginId.VersionedId): DeployedPlugin | undefined {
        return this.deployedBackendPlugins.get(pluginId) ?? this.deployedFrontendPlugins.get(pluginId);
    }

    async deployFrontendPlugins(frontendPlugins: DeployerPlugin[]): Promise<number> {
        let successes = 0;
        for (const plugin of frontendPlugins) {
            if (await this.deployPlugin(plugin, 'frontend')) { successes++; }
        }
        // resolve on first deploy
        this.frontendPluginsMetadataDeferred.resolve(undefined);
        return successes;
    }

    async deployBackendPlugins(backendPlugins: DeployerPlugin[]): Promise<number> {
        let successes = 0;
        for (const plugin of backendPlugins) {
            if (await this.deployPlugin(plugin, 'backend')) { successes++; }
        }
        // rebuild translation config after deployment
        await this.localizationService.buildTranslationConfig([...this.deployedBackendPlugins.values()]);
        // resolve on first deploy
        this.backendPluginsMetadataDeferred.resolve(undefined);
        return successes;
    }

    /**
     * @throws never! in order to isolate plugin deployment.
     * @returns whether the plugin is deployed after running this function. If the plugin was already installed, will still return `true`.
     */
    protected async deployPlugin(entry: DeployerPlugin, entryPoint: keyof PluginEntryPoint): Promise<boolean> {
        const pluginPath = new URI(entry.uri).resolve(entry.relativePluginRoot).path.fsPath();
        const deployPlugin = this.stopwatch.start('deployPlugin');
        let id;
        let success = true;
        try {
            const manifest = await this.reader.readPackage(pluginPath);
            if (!manifest) {
                deployPlugin.error(`Failed to read ${entryPoint} plugin manifest from '${pluginPath}''`);
                return success = false;
            }

            const metadata = this.reader.readMetadata(manifest);
            metadata.isUnderDevelopment = entry.isUnderDevelopment;

            id = PluginId.toVersionedString(PluginId.fromComponents(metadata.model));

            const deployedLocations = this.deployedLocations.get(id) ?? new Set<string>();
            deployedLocations.add(pluginPath);
            this.deployedLocations.set(id, deployedLocations);

            const deployedPlugins = entryPoint === 'backend' ? this.deployedBackendPlugins : this.deployedFrontendPlugins;
            if (deployedPlugins.has(id)) {
                deployPlugin.debug(`Skipped ${entryPoint} plugin ${metadata.model.name} already deployed`);
                return true;
            }

            const { kind } = entry;
            const deployed: DeployedPlugin = { metadata, kind };
            deployed.contributes = await this.reader.readContribution(manifest);
            await this.localizationService.deployLocalizations(deployed);
            deployedPlugins.set(id, deployed);
            deployPlugin.debug(`Deployed ${entryPoint} plugin "${id}" from "${metadata.model.entryPoint[entryPoint] || pluginPath}"`);
        } catch (e) {
            deployPlugin.error(`Failed to deploy ${entryPoint} plugin from '${pluginPath}' path`, e);
            return success = false;
        } finally {
        }
        return success;
    }
}
