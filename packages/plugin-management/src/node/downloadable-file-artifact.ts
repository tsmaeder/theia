
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

import * as path from 'path';
import { promises as fs } from 'fs';
import { DeployableFileArtifact } from './directory-deployment';
import { RequestService } from '@theia/core/shared/@theia/request';
import { VersionedPluginId } from '@theia/installer';

export class DownloadableFileArtifact implements DeployableFileArtifact {
    constructor(protected readonly requestService: RequestService,
        protected readonly downloadDir: string,
        protected readonly fileName: string,
        public readonly id: VersionedPluginId,
        protected readonly downloadUri: string) { }

    async provideFile(): Promise<string> {
        const downloadPath = path.resolve(this.downloadDir, this.fileName);
        try {
            await fs.access(downloadPath);
            return downloadPath;
        } catch (e) {
            // ignore, can't access that path
        }
        const context = await this.requestService.request({ url: this.downloadUri });
        if (context.res.statusCode !== 200) {
            throw new Error('Request returned status code: ' + context.res.statusCode);
        } else {
            await fs.writeFile(downloadPath, context.buffer);
            return downloadPath;
        }
    }

    get originalFileName(): string {
        return this.fileName;
    }

}
