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

import { UnversionedPluginId, VersionedPluginId } from './plugin-id';
import { DeployableArtifact, Deployer, DeploymentLocation } from './deployment-api';

/**
 * An artifact resolver can take a resolver-specifice uri and resolve it into a DeployableArtifact.
 */
export interface ArtifactResolver {
    canHandle(uri: string): boolean;
    resolve(uri: string): Promise<DeployableArtifact>;
}

export interface DependencyResolver {
    /**
     * Resolves an unversioned dependency into a plugin uri that can be used to install the dependency.
     * @param originalResolver The resolver that was used to resolve the dependent artifact
     * @param pluginId the id of the dependency. Dependencies are unversioned.
     */
    createDependencyUri(originalResolver: ArtifactResolver, pluginId: UnversionedPluginId): string;
}

export interface ResolvedArtifact {
    resolver: ArtifactResolver;
    artifact: DeployableArtifact;
}

export interface Installer {
    readonly builtInLocations: readonly DeploymentLocation[];
    readonly targetLocation: DeploymentLocation;
    registerResolver(resolver: ArtifactResolver): void;
    registerBuiltinLocation(location: DeploymentLocation): void;
    setTargetLocation(targetLocation: DeploymentLocation): void;
    resolve(uri: string): Promise<ResolvedArtifact>;
    deploy(artifact: ResolvedArtifact): Promise<UnversionedPluginId[]>;
    undeploy(id: UnversionedPluginId): Promise<boolean>;
    getDeployedPlugins(): Promise<DeployedPlugin[]>;
}

export interface DeployedPluginHandler {
    handle(location: DeploymentLocation, pluginUri: string, deploymentKind: DeploymentKind): Promise<DeployedPlugin | undefined>;
}

export enum PluginHost {

    FRONTEND,

    BACKEND,

    HEADLESS // Deployed in the Theia Node server outside the context of a frontend/backend connection
}

/**
 * Whether a plugin installed by a user or system.
 */
export enum DeploymentKind {
    Installed,
    BuiltIn
};

export interface DeployedPlugin {
    id: VersionedPluginId;
    location: DeploymentLocation;

    /**
     * Local path on the filesystem.
     */
    uri: string;

    /**
     * The deployment types this entry supports
     */
    types: readonly PluginHost[];

    kind: DeploymentKind
    /**
     * A path relative to the root uri where the plugin contents are located.
     * Depending on a plugin format it can be different from `path`.
     * Use `path` if you want to resolve something within a plugin, like `README.md` file.
     * Use `uri` if you want to manipulate the entire plugin location, like delete or move it.
     */
    relativePluginRoot: string

    isUnderDevelopment: boolean;
}

export class InstallerImpl implements Installer {
    protected readonly resolvers: ArtifactResolver[] = [];
    protected readonly _builtinLocations: DeploymentLocation[] = [];
    protected _targetLocation: DeploymentLocation;
    protected deployer: Deployer;
    protected readonly deployedPluginHandlers: Set<DeployedPluginHandler> = new Set();

    get builtInLocations(): readonly DeploymentLocation[] {
        return this._builtinLocations;
    }
    get targetLocation(): DeploymentLocation {
        return this._targetLocation;
    }

    setDeployer(deployer: Deployer): void {
        this.deployer = deployer;
    }

    setTargetLocation(targetLocation: DeploymentLocation): void {
        this._targetLocation = targetLocation;
    }

    registerResolver(resolver: ArtifactResolver): void {
        this.resolvers.push(resolver);
    }

    registerBuiltinLocation(location: DeploymentLocation): void {
        this._builtinLocations.push(location);
    }

    registerDeployedPluginHandler(handler: DeployedPluginHandler): void {
        this.deployedPluginHandlers.add(handler);
    }

    async resolve(uri: string): Promise<ResolvedArtifact> {
        for (const resolver of this.resolvers) {
            if (resolver.canHandle(uri)) {
                return { resolver, artifact: await resolver.resolve(uri) };
            }
        }
        throw new Error(`No resolver found for plugin URI ${uri}`);
    }

    async deploy(resolvedArtifact: ResolvedArtifact): Promise<UnversionedPluginId[]> {
        return this.deployer.deploy(this._targetLocation, resolvedArtifact.artifact, false);
    }

    async undeploy(id: VersionedPluginId): Promise<boolean> {
        return this._targetLocation.undeploy(id);
    }

    async getDeployedPlugin(location: DeploymentLocation, uri: string, deploymentKind: DeploymentKind): Promise<DeployedPlugin | undefined> {
        for (const handler of this.deployedPluginHandlers) {
            const pluginEntry = await handler.handle(location, uri, deploymentKind);
            if (pluginEntry) {
                return pluginEntry;
            }
        }
    }

    async getDeployedPlugins(): Promise<DeployedPlugin[]> {
        const result: DeployedPlugin[] = [];
        const handle = async (location: DeploymentLocation, deploymentKind: DeploymentKind): Promise<boolean> => {

            const uris = await location.getPluginLocationUris();

            for (const uri of uris) {
                const plugin = await this.getDeployedPlugin(location, uri, deploymentKind);
                if (plugin) {
                    result.push(plugin);
                }
            }
            return false;
        };

        for (const location of this.builtInLocations) {
            await handle(location, DeploymentKind.BuiltIn);
        }
        await handle(this.targetLocation, DeploymentKind.Installed);
        return result;
    }
}
