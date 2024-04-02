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

import { DownloadableFileArtifact } from '@theia/plugin-management/lib/node/downloadable-file-artifact';
import { URI } from '@theia/core/lib/common';
import { OVSXApiFilter, VSXExtensionRaw } from '@theia/ovsx-client';
import { OVSXClientProvider } from '../common';
import { PluginId } from '@theia/installer';
import { inject, injectable } from '@theia/core/shared/inversify';
import { RequestService } from '@theia/core/shared/@theia/request';
import { PluginVSCodeEnvironment } from '@theia/plugin-ext-vscode/lib/common/plugin-vscode-environment';
import { FileUri } from '@theia/core/lib/node';
import * as path from 'path';
import { promises as fs } from 'fs';
import { VSCodeExtensionUri } from '@theia/plugin-ext-vscode/lib/common/vsx-extension-uri';
import { ArtifactResolver, DeployableArtifact } from '@theia/installer';

@injectable()
export class OpenVsxArtifactResolver implements ArtifactResolver {

    static readonly TEMP_DIR_PREFIX = 'vscode-download';

    @inject(OVSXClientProvider) protected clientProvider: OVSXClientProvider;
    @inject(RequestService) protected requestService: RequestService;
    @inject(PluginVSCodeEnvironment) protected readonly environment: PluginVSCodeEnvironment;
    @inject(OVSXApiFilter) protected vsxApiFilter: OVSXApiFilter;

    canHandle(uri: string): boolean {
        return !!VSCodeExtensionUri.toId(new URI(uri));
    }

    async resolve(uri: string): Promise<DeployableArtifact> {
        const id = VSCodeExtensionUri.toId(new URI(uri));
        if (!id) {
            throw new Error(`Not a valid vsx uri: ${uri}`);
        }
        const extensionId = id.id;
        let extension: VSXExtensionRaw | undefined;
        const client = await this.clientProvider();
        if (id.version) {
            console.log(`[${id}]: trying to resolve version ${id.version}...`);
            const { extensions } = await client.query({ extensionId: extensionId, extensionVersion: id.version, includeAllVersions: true });
            extension = extensions[0];
        } else {
            console.log(`[${id}]: trying to resolve latest version...`);
            const { extensions } = await client.query({ extensionId: extensionId, includeAllVersions: true });
            extension = this.vsxApiFilter.getLatestCompatibleExtension(extensions);
        }
        if (!extension) {
            throw new Error(`Did not find '${PluginId.toString(id)} in registry'`);
        }
        if (extension.error) {
            throw new Error(extension.error);
        }
        const resolvedId = PluginId.withVersion(id, extension.version);
        const downloadUrl = extension.files.download;
        console.log(`[${PluginId.toString(id)}]: resolved to '${PluginId.toString(resolvedId)}'`);
        return new DownloadableFileArtifact(this.requestService, await this.getTempDir(), path.basename(downloadUrl), resolvedId, downloadUrl);
    }

    protected async getTempDir(): Promise<string> {
        const tempDir = FileUri.fsPath(await this.environment.getTempDirUri(OpenVsxArtifactResolver.TEMP_DIR_PREFIX));
        try {
            await fs.access(tempDir);
        } catch {
            await fs.mkdir(tempDir, { recursive: true });
        }
        return tempDir;
    }
}
