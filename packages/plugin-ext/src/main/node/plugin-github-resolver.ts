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
import { getTempDirPathAsync } from './temp-dir-util';
import { DeployableFileArtifact, DownloadableFileArtifact } from '@theia/plugin-management/lib/node';
import { ArtifactResolver } from '@theia/installer';

/**
 * Resolver that handle the github: protocol
 * github:<org>/<repo>/<filename>@latest
 * github:<org>/<repo>/<filename>@<version>
 */
@injectable()
export class GithubArtifactResolver implements ArtifactResolver {

    private static PREFIX = 'github:';

    private static GITHUB_ENDPOINT = 'https://github.com/';

    private unpackedFolder: Deferred<string>;

    @inject(RequestService)
    protected readonly request: RequestService;

    constructor() {
        this.unpackedFolder = new Deferred();
        getTempDirPathAsync('github-remote').then(async unpackedFolder => {
            try {
                await fs.mkdir(unpackedFolder, { recursive: true });
                this.unpackedFolder.resolve(unpackedFolder);
            } catch (err) {
                this.unpackedFolder.reject(err);
            }
        });
    }

    /**
  * Handle only the plugins that starts with github:
  */
    canHandle(uri: string): boolean {
        return uri.startsWith(GithubArtifactResolver.PREFIX);
    }

    /**
     * Grab the remote file specified by Github URL
     */
    async resolve(uri: string): Promise<DeployableFileArtifact> {

        // download the file
        // extract data
        const extracted = /^github:(.*)\/(.*)\/(.*)$/gm.exec(uri);
        if (!extracted || extracted === null || extracted.length !== 4) {
            throw new Error('Invalid extension' + uri);
        }

        const orgName = extracted[1];
        const repoName = extracted[2];
        const file = extracted[3];

        // get version if any
        const splitFile = file.split('@');
        let version;
        let filename: string;
        if (splitFile.length === 1) {
            filename = file;
            version = 'latest';
        } else {
            filename = splitFile[0];
            version = splitFile[1];
        }

        // if latest, resolve first the real version
        if (version === 'latest') {
            // latest version, need to get the redirect
            const url = GithubArtifactResolver.GITHUB_ENDPOINT + orgName + '/' + repoName + '/releases/latest';
            // disable redirect to grab the release
            const followRedirects = 0;
            const response = await this.request.request({ url, followRedirects });
            // should have a redirect
            if (response.res.statusCode === 302) {
                const redirectLocation = response.res.headers.location;
                if (!redirectLocation) {
                    throw new Error('Invalid github link with latest not being found');
                }

                // parse redirect link
                const taggedValueArray = /^https:\/\/.*tag\/(.*)/gm.exec(redirectLocation);
                if (!taggedValueArray || taggedValueArray.length !== 2) {
                    throw new Error('The redirect link for latest is invalid ' + redirectLocation);
                }

                // grab version of tag
                const downloadUri = GithubArtifactResolver.GITHUB_ENDPOINT + orgName + '/' + repoName + '/releases/download/' + version + '/' + filename;

                return new DownloadableFileArtifact(this.request, await this.unpackedFolder.promise, `${filename}-${version}`, { id: filename, version: taggedValueArray[1] }, downloadUri)
            } else {
                throw new Error(`Could not resolve latest version for ${url}`);
            }
        } else {
            const downloadUri = GithubArtifactResolver.GITHUB_ENDPOINT + orgName + '/' + repoName + '/releases/download/' + version + '/' + filename;
            return new DownloadableFileArtifact(this.request, await this.unpackedFolder.promise, `${filename}-${version}`, { id: filename, version: version }, downloadUri)
        }
    }
}
