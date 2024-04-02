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

import { promises as fs } from 'fs';
import * as filenamify from 'filenamify';
import * as url from 'url';
import * as path from 'path';
import { isObject } from '@theia/core';
import { DeployableArtifact, DeploymentLocation, PluginId, UnversionedPluginId, VersionedPluginId } from '@theia/installer';

export interface DeployableFileArtifact extends DeployableArtifact {
    /**
     * Provide the deployable artifact as a file
     */
    provideFile(): Promise<string>;
    originalFileName: string;
}

export namespace DeployableFileArtifact {
    export function is(artifact: DeployableArtifact): artifact is DeployableFileArtifact {
        return isObject(artifact) && typeof artifact['provideFile'] === 'function';
    }
}

export class DirectoryDeploymentLocation implements DeploymentLocation {
    constructor(public readonly rootPath: string) {
    }
    async getPluginLocationUris(): Promise<string[]> {
        const result: string[] = [];
        const resolvedPath = path.resolve(this.rootPath);

        const entries = await fs.opendir(resolvedPath);
        try {
            let entry = await entries.read();
            while (entry) {
                if (entry.isDirectory()) {
                    const pluginUrl = url.pathToFileURL(path.resolve(this.rootPath, entry.name));
                    result.push(pluginUrl.toString());
                }
                entry = await entries.read();
            }
            return result;
        } finally {
            entries.close();
        }
    }

    async undeploy(id: UnversionedPluginId): Promise<boolean> {
        const installedVersion = await this.getInstalledVersion(id);
        if (installedVersion) {
            const pathToRemove = path.resolve(this.rootPath, this.getDirectoryNameFor(PluginId.withVersion(id, installedVersion)));
            await fs.rm(pathToRemove, { force: true, recursive: true });
            return true;
        }
        return false;
    }

    async has(id: VersionedPluginId): Promise<boolean> {
        try {
            await fs.access(path.resolve(this.rootPath, this.getDirectoryNameFor(id)));
            return true;
        } catch (e) {
            return false;
        }
    }

    async getInstalledVersion(id: PluginId): Promise<string | undefined> {
        const namePrefix = PluginId.toString(id).replace('@', '-');
        const resolvedPath = path.resolve(this.rootPath);
        const entries = await fs.opendir(resolvedPath);
        try {
            let entry = await entries.read();
            while (entry) {
                if (entry.isDirectory()) {
                    if (entry.name.startsWith(namePrefix)) {
                        if (entry.name.length === namePrefix.length) {
                            return id.version;
                        } else {
                            const lastDash = entry.name.lastIndexOf('-');
                            if (lastDash === namePrefix.length) {
                                // the string is of the form <pluginId>-<version>
                                return entry.name.substring(lastDash + 1);
                            }
                        }
                    }
                }
                entry = await entries.read();
            }
            return undefined;
        } finally {
            entries.close();
        }
    }

    getDirectoryNameFor(id: PluginId): string {
        const idString = PluginId.toString(id).replace('@', '-');
        const fileName = filenamify(idString, { replacement: '_' });
        if (fileName !== idString) {
            // I believe this can never happen, but better fail here than to debug strange behaviors later
            throw new Error(`Plugin id: cannot be converted to a directory name: ${PluginId.toString(id)}`);
        }
        return idString;
    }
}
