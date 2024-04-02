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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { injectable, inject, named } from '@theia/core/shared/inversify';
import {
    PluginDeployer, PluginDeployerParticipant,
    PluginDeployerHandler
} from '../../common/plugin-protocol';
import { ILogger, Emitter, ContributionProvider, URI } from '@theia/core';
import { PluginCliContribution } from './plugin-cli-contribution';
import { Measurement, Stopwatch } from '@theia/core/lib/common';
import { InstallerService } from '@theia/plugin-management/lib/node/installer-service';
import { DirectoryDeploymentLocation } from '@theia/plugin-management/lib/node';
import { DeployedPlugin, PluginHost } from '@theia/installer';

@injectable()
export class PluginDeployerImpl implements PluginDeployer {

    protected readonly onDidDeployEmitter = new Emitter<void>();
    readonly onDidDeploy = this.onDidDeployEmitter.event;

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(InstallerService)
    protected readonly installerService: InstallerService;

    @inject(PluginDeployerHandler)
    protected readonly pluginDeployerHandler: PluginDeployerHandler;

    @inject(PluginCliContribution)
    protected readonly cliContribution: PluginCliContribution;

    @inject(Stopwatch)
    protected readonly stopwatch: Stopwatch;

    @inject(ContributionProvider) @named(PluginDeployerParticipant)
    protected readonly participants: ContributionProvider<PluginDeployerParticipant>;

    configure(): Promise<void> {
        // check THEIA_DEFAULT_PLUGINS or THEIA_PLUGINS env var
        const defaultPluginsValue = process.env.THEIA_DEFAULT_PLUGINS || undefined;
        const pluginsValue = process.env.THEIA_PLUGINS || undefined;

        this.logger.debug('Found the list of default plugins ID on env:', defaultPluginsValue);
        this.logger.debug('Found the list of plugins ID on env:', pluginsValue);

        // transform it to array
        const defaultPluginList = defaultPluginsValue ? defaultPluginsValue.split(',') : [];
        const pluginList = pluginsValue ? pluginsValue.split(',') : [];

        defaultPluginList.forEach(p => this.installerService.registerBuiltinLocation(new DirectoryDeploymentLocation(p)));
        pluginList.forEach(p => this.installerService.registerBuiltinLocation(new DirectoryDeploymentLocation(p)));
        return Promise.resolve();
    }

    start(): Promise<void> {
        this.logger.debug('Starting the deployer');
        return this.doStart();
    }

    protected async doStart(): Promise<void> {
        for (const contribution of this.participants.getContributions()) {
            if (contribution.onWillStart) {
                await contribution.onWillStart();
            }
        }

        await this.installerService.start();

        const deployPlugins = this.measure('deployPlugins');
        const plugins = await this.installerService.getInstalledPlugins();
        await this.deployPlugins(plugins);
        deployPlugins.log('Deploy plugins list');
    }

    async deployPlugin(entry: DeployedPlugin): Promise<void> {
        await this.deployPlugins([entry]);
    }

    /**
     * deploy all plugins that have been accepted
     */
    async deployPlugins(pluginsToDeploy: readonly DeployedPlugin[]): Promise<number> {
        const acceptedFrontendPlugins = pluginsToDeploy.filter(pluginDeployerEntry => pluginDeployerEntry.types.includes(PluginHost.FRONTEND));
        const acceptedBackendPlugins = pluginsToDeploy.filter(pluginDeployerEntry => pluginDeployerEntry.types.includes(PluginHost.BACKEND));
        const acceptedHeadlessPlugins = pluginsToDeploy.filter(pluginDeployerEntry => pluginDeployerEntry.types.includes(PluginHost.HEADLESS));

        this.logger.debug('the acceptedFrontendPlugins plugins are', acceptedFrontendPlugins);
        this.logger.debug('the acceptedBackendPlugins plugins are', acceptedBackendPlugins);
        this.logger.debug('the acceptedHeadlessPlugins plugins are', acceptedHeadlessPlugins);

        // local path to launch
        const pluginPaths = [...acceptedBackendPlugins, ...acceptedHeadlessPlugins].map(pluginEntry => new URI(pluginEntry.uri).path.fsPath());
        this.logger.debug('local path to deploy on remote instance', pluginPaths);

        const deployments = [];
        // start the backend plugins
        deployments.push(await this.pluginDeployerHandler.deployBackendPlugins(acceptedBackendPlugins));
        // headless plugins are deployed like backend plugins
        deployments.push(await this.pluginDeployerHandler.deployBackendPlugins(acceptedHeadlessPlugins));
        deployments.push(await this.pluginDeployerHandler.deployFrontendPlugins(acceptedFrontendPlugins));
        this.onDidDeployEmitter.fire(undefined);
        return deployments.reduce<number>((accumulated, current) => accumulated += current ?? 0, 0);
    }

    protected measure(name: string): Measurement {
        return this.stopwatch.start(name);
    }
}
