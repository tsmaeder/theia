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

export interface DeploymentLocation {
    getPluginLocationUris(): Promise<string[]>;
    /**
     * Deletes the given plugin from this DeploymentLocation
     * @param id the plugin to remove
     */
    undeploy(id: VersionedPluginId): Promise<boolean>;
}

export interface DeployableArtifact {
    id: VersionedPluginId;
}

export interface PluginDeployer {
    accepts(source: DeployableArtifact, location: DeploymentLocation): Promise<boolean>;
    deploy(source: DeployableArtifact, location: DeploymentLocation): Promise<UnversionedPluginId[]>;
}

export interface Deployer {
    registerDeployer(deployer: PluginDeployer): void;
    deploy(targetLocation: DeploymentLocation, artifact: DeployableArtifact, force: boolean): Promise<UnversionedPluginId[]>;
}

/**
 * The deployer delegates to the various ArtifactDeployers.
 */
export class DeployerImpl implements Deployer {
    protected readonly deployers: PluginDeployer[] = [];

    registerDeployer(deployer: PluginDeployer): void {
        this.deployers.push(deployer);
    }

    /**
     * Deploys the given artifact to the given target location.
     * @param targetLocation the target location
     * @param artifact the artifact to deploy.
     * @returns The dependencies of the deployed artifact
     */
    async deploy(targetLocation: DeploymentLocation, artifact: DeployableArtifact, force: boolean): Promise<UnversionedPluginId[]> {
        for (const deployer of this.deployers) {
            if (await deployer.accepts(artifact, targetLocation)) {
                return deployer.deploy(artifact, targetLocation);
            }
        }
        throw new Error(`No deployer found for artifact ${artifact} an location ${location}`);
    }
}
