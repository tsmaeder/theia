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

import { ArtifactResolver, DeployableArtifact, VersionedPluginId } from "@theia/installer";
import { DeployableFileArtifact } from "./directory-deployment";
import * as path from "path";
import { URI } from "@theia/core";
import { injectable } from "@theia/core/shared/inversify";
import { FileUri } from "@theia/core/lib/node";

export class LocalFileArtifact implements DeployableFileArtifact {

    constructor(
        protected readonly filePath: string,
        readonly id: VersionedPluginId) { }
    provideFile(): Promise<string> {
        return Promise.resolve(this.filePath);
    }

    get originalFileName(): string {
        return path.basename(this.filePath);
    }
}


@injectable()
export class LocalFileArtifactResolver implements ArtifactResolver {
    canHandle(uriString: string): boolean {
        const uri = new URI(uriString);
        if (uri.scheme !== 'local-file') {
            return false;
        }
        return !!uri.path.ext && uri.path.name.includes('-');
    }
    async resolve(uriString: string): Promise<DeployableArtifact> {
        const uri = new URI(uriString);
        const index = uri.path.name.lastIndexOf('-');
        const id = {
            id: uri.path.name.substring(0, index).toLowerCase(),
            version: uri.path.name.substring(index + 1).toLocaleLowerCase()
        };
        return new LocalFileArtifact(FileUri.fsPath(uri), id);
    }
}