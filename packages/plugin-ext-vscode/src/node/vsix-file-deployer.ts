
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

import { DeployableArtifact, DeploymentLocation, PluginDeployer, PluginId, UnversionedPluginId } from '@theia/installer';
import { DeployableFileArtifact, DirectoryDeploymentLocation } from '@theia/plugin-management/lib/node';
import * as decompress from 'decompress';
import * as path from 'path';
import { promises as fs } from 'fs';
import { injectable } from '@theia/core/shared/inversify';

@injectable()
export class VsixFileDeployer implements PluginDeployer {
    async accepts(source: DeployableArtifact, location: DeploymentLocation): Promise<boolean> {
        return DeployableFileArtifact.is(source) &&
            location instanceof DirectoryDeploymentLocation &&
            source.originalFileName.endsWith('.vsix');
    }
    async deploy(source: DeployableArtifact, location: DeploymentLocation): Promise<UnversionedPluginId[]> {
        const sourcePath = await (source as DeployableFileArtifact).provideFile();
        const dirLocation = location as DirectoryDeploymentLocation;
        const targetDir = path.resolve(path.resolve(dirLocation.rootPath, dirLocation.getDirectoryNameFor(source.id)));
        await fs.mkdir(targetDir, { recursive: true });
        await decompress(sourcePath, targetDir);
        const pck = JSON.parse(await fs.readFile(path.resolve(targetDir, 'extension', 'package.json'), 'utf-8'));
        const result: UnversionedPluginId[] = [];
        if (Array.isArray(pck.extensionDependencies)) {
            pck.extensionDependencies.forEach((dep: string) => {
                result.push(PluginId.parse(dep));
            });
        }

        if (Array.isArray(pck.extensionPack)) {
            pck.json.extensionPack.forEach((dep: string) => {
                result.push(PluginId.parse(dep));
            });
        }
        return result;
    }
}
