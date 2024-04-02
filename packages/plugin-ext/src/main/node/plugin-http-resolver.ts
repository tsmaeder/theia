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

import { RequestService } from '@theia/core/shared/@theia/request';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as url from 'url';
import { getTempDirPathAsync } from './temp-dir-util';
import { DownloadableFileArtifact } from '@theia/plugin-management/lib/node';
import { ArtifactResolver, DeployableArtifact, PluginId, VersionedPluginId } from '@theia/installer';

/**
 * Resolver that handle the http(s): protocol
 * http://path/to/my.plugin@version.theia
 * https://path/to/my.plugin@version.vsix
 */
@injectable()
export class HttpArtifactResolver implements ArtifactResolver {

    private unpackedFolder: Deferred<string>;

    @inject(RequestService)
    protected readonly request: RequestService;

    constructor() {
        this.unpackedFolder = new Deferred();
        getTempDirPathAsync('http-remote').then(async unpackedFolder => {
            try {
                await fs.mkdir(unpackedFolder, { recursive: true });
                this.unpackedFolder.resolve(unpackedFolder);
            } catch (err) {
                this.unpackedFolder.reject(err);
            }
        });
    }

    /**
     * Handle only the plugins that starts with http or https:
     */
    canHandle(pluginId: string): boolean {
        return /^http[s]?:\/\/.*$/gm.test(pluginId);
    }

    /**
     * Grab the remote file specified by the given URL
     */
    async resolve(uri: string): Promise<DeployableArtifact> {
        const link = url.parse(uri);
        if (!link.pathname) {
            throw new Error('invalid link URI' + uri);
        }

        const basename = path.basename(link.pathname);
        const id = PluginId.parse(path.basename(link.pathname, path.extname(link.pathname))) as VersionedPluginId;
        if (!id.version) {
            throw new Error(`Could not parse versioned it from uri ${uri}`)
        }
        return new DownloadableFileArtifact(this.request, await this.unpackedFolder.promise, basename, id as VersionedPluginId, uri);
    }
}
