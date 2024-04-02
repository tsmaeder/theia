
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

import { ContributionProvider, DisposableCollection, Emitter, URI } from '@theia/core';
import { inject, injectable, named, postConstruct } from '@theia/core/shared/inversify';
import { FileUri, SettingService } from '@theia/core/lib/node';

import {
    ArtifactResolver, DependencyResolver, DeployedPlugin, DeployedPluginHandler, DeployerImpl, DeploymentKind, DeploymentLocation, InstallerImpl,
    PluginDeployer, PluginId, ResolvedArtifact,
    VersionedPluginId
} from '@theia/installer';

export const DependencyResolverContribution = Symbol('DependencyResolver');
export const ArtifactResolverContribution = Symbol('ArtifactResolverContribution');
export const PluginDeployerContribution = Symbol('PluginDeployerContribution');

import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { promises as fs } from 'fs';
import { InstallerBackendService, InstallerClient } from '../common/installer-backend-service';
import { DirectoryDeploymentLocation } from './directory-deployment';

const PLUGINS_TO_UNINSTALL_KEY = 'installer-service.pluginsToUninstall';

export const DeployedPluginHandlerContribution = Symbol('DeployedPluginHandlerContribution');
@injectable()
export class InstallerService {
    @inject(EnvVariablesServer)
    protected readonly environments: EnvVariablesServer;
    @inject(ContributionProvider) @named(ArtifactResolverContribution)
    protected readonly artifactResolvers: ContributionProvider<ArtifactResolver>;
    @inject(ContributionProvider) @named(PluginDeployerContribution)
    protected readonly pluginDeployers: ContributionProvider<PluginDeployer>;
    @inject(ContributionProvider) @named(DeployedPluginHandlerContribution)
    protected readonly pluginHandlers: ContributionProvider<DeployedPluginHandler>;

    @inject(DependencyResolverContribution)
    protected dependencyResolver: DependencyResolver;
    @inject(SettingService)
    protected readonly settingService: SettingService;

    protected readonly installer: InstallerImpl = new InstallerImpl();
    protected readonly deployer: DeployerImpl = new DeployerImpl();
    protected readonly installOnStartup: string[] = [];
    protected installedPlugins: DeployedPlugin[] = [];
    protected readonly markedForUninstall: Set<PluginId.VersionedId> = new Set();

    protected readonly onDidChangeUninstalledPluginsEmitter = new Emitter<void>();
    readonly onDidChangeUninstalledPlugins = this.onDidChangeUninstalledPluginsEmitter.event;

    protected readonly onDidChangeInstalledPluginsEmitter = new Emitter<void>();
    readonly onDidChangeInstalledPlugins = this.onDidChangeInstalledPluginsEmitter.event;

    @postConstruct()
    setup(): void {
        this.installer.setDeployer(this.deployer);
        this.pluginDeployers.getContributions().forEach(deployer => this.deployer.registerDeployer(deployer));
        this.artifactResolvers.getContributions().forEach(resolver => this.installer.registerResolver(resolver));
        this.pluginHandlers.getContributions().forEach(handler => this.installer.registerDeployedPluginHandler(handler));
    }

    async start(): Promise<void> {
        const configDir = new URI(await this.environments.getConfigDirUri());
        const targetLocation = FileUri.fsPath(configDir.resolve('deployedPlugins'));
        await fs.mkdir(targetLocation, { recursive: true });
        this.setTargetLocation(new DirectoryDeploymentLocation(targetLocation));

        const stored = await this.settingService.get(PLUGINS_TO_UNINSTALL_KEY);
        const toUninstall = JSON.parse(stored || '[]');

        for (const id of toUninstall) {
            await this.installer.undeploy(PluginId.parse(id) as VersionedPluginId);
        };

        this.installedPlugins = await this.installer.getDeployedPlugins();
        await this.settingService.set(PLUGINS_TO_UNINSTALL_KEY, '[]');
        await this.install(this.installOnStartup, false);
    }

    async getInstalledPlugins(): Promise<readonly DeployedPlugin[]> {
        return this.installer.getDeployedPlugins();
    }

    get builtInLocations(): readonly DeploymentLocation[] {
        return this.installer.builtInLocations;
    }

    isUninstalled(id: PluginId.VersionedId): boolean {
        return this.markedForUninstall.has(id);
    }

    getUninstalledPlugins(): PluginId.VersionedId[] {
        return [...this.markedForUninstall];
    }

    get targetLocation(): DeploymentLocation {
        return this.installer.targetLocation;
    }

    async readPlugin(location: DeploymentLocation, pluginDirPath: string, deploymentKind: DeploymentKind): Promise<DeployedPlugin> {
        for (const handler of this.pluginHandlers.getContributions()) {
            const pluginEntry = await handler.handle(location, pluginDirPath, deploymentKind);
            if (pluginEntry) {
                return pluginEntry;
            }
        }
        throw new Error(`did not find a handler for ${pluginDirPath}`);
    }

    async install(uris: string[], force: boolean): Promise<void> {
        let toDo = uris;
        const visited = new Set<string>();

        while (toDo.length > 0) {
            const batch = toDo;
            toDo = [];
            batch.forEach(uri => visited.add(uri));
            const resolved: [string, ResolvedArtifact][] = await Promise.all(batch.map(async uri => [uri, await this.installer.resolve(uri)]));

            for (const [uri, resolvedArtifact] of resolved) {
                if (this.markedForUninstall.delete(PluginId.toVersionedString(resolvedArtifact.artifact.id))) {
                    this.onDidChangeUninstalledPluginsEmitter.fire();
                } else {
                    let alreadyInstalled = false;
                    const installedVersions = this.installedPlugins.filter(deployedPlugin => {
                        if (deployedPlugin.location === this.installer.targetLocation && deployedPlugin.id.id === resolvedArtifact.artifact.id.id) {
                            if (deployedPlugin.id.version === resolvedArtifact.artifact.id.version) {
                                alreadyInstalled = true;
                                return false;
                            }
                            return true;
                        };
                        return false;
                    });
                    if (!alreadyInstalled) {
                        if (force) {
                            for (const deployedPlugin of installedVersions) {
                                this.markedForUninstall.add(PluginId.toVersionedString(deployedPlugin.id));
                                this.onDidChangeInstalledPluginsEmitter.fire();
                            }
                        }

                        if (installedVersions.length === 0 || force) {
                            const deps = await this.installer.deploy(resolvedArtifact);
                            const deployed = await this.installer.getDeployedPlugin(this.installer.targetLocation, uri, DeploymentKind.Installed);
                            if (deployed) {
                                this.installedPlugins.push(deployed);
                            }
                            this.onDidChangeInstalledPluginsEmitter.fire();

                            deps.forEach(dep => {
                                const dependencyUri = this.dependencyResolver.createDependencyUri(resolvedArtifact.resolver, dep);
                                if (!visited.has(dependencyUri)) {
                                    toDo.push(dependencyUri);
                                }
                            });
                        }
                    }
                }
            }
        }
    }

    async uninstall(id: VersionedPluginId): Promise<boolean> {
        this.markedForUninstall.add(PluginId.toVersionedString(id));
        this.onDidChangeUninstalledPluginsEmitter.fire();
        await this.settingService.set(PLUGINS_TO_UNINSTALL_KEY, JSON.stringify(this.getUninstalledPlugins()));
        return true;
    }

    registerPluginToInstall(uriString: string): void {
        this.installOnStartup.push(uriString);
    }

    setTargetLocation(location: DeploymentLocation): void {
        this.installer.setTargetLocation(location);
    }

    registerBuiltinLocation(location: DeploymentLocation): void {
        this.installer.registerBuiltinLocation(location);
    }
}

@injectable()
export class InstallerBackendServiceImpl implements InstallerBackendService {
    protected client: InstallerClient | undefined;
    protected readonly toDispose = new DisposableCollection();

    @inject(InstallerService)
    protected readonly installer: InstallerService;

    @postConstruct()
    init(): void {
        this.toDispose.push(this.installer.onDidChangeInstalledPlugins(() => {
            this.client?.installedPluginsChanged();
        }));
        this.toDispose.push(this.installer.onDidChangeUninstalledPlugins(() => {
            this.client?.installedPluginsChanged();
        }));
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    setClient(client: InstallerClient | undefined): void {
        this.client = client;
    }

    async install(uris: string[], force: boolean): Promise<void> {
        return this.installer.install(uris, force);
    }

    getInstalledPlugins(): Promise<readonly DeployedPlugin[]> {
        return this.installer.getInstalledPlugins();
    }

    uninstall(id: PluginId.VersionedId): Promise<boolean> {
        return this.installer.uninstall(PluginId.parse(id));
    }

    async getUninstalledPlugins(): Promise<`${string}@${string}`[]> {
        return this.installer.getUninstalledPlugins();
    }
}
