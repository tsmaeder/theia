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

import { inject, injectable } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { HostedPluginReader as PluginReaderHosted } from '@theia/plugin-ext/lib/hosted/node/plugin-reader';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { PluginDeployer, PluginMetadata } from '@theia/plugin-ext/lib/common/plugin-protocol';
import { DirectoryDeploymentLocation, InstallerService } from '@theia/plugin-management/lib/node';
import { DeploymentKind } from '@theia/installer';
import * as path from 'path';

@injectable()
export class HostedPluginReader implements BackendApplicationContribution {

    @inject(PluginReaderHosted)
    protected readonly pluginReader: PluginReaderHosted;

    @inject(InstallerService)
    protected readonly installerService: InstallerService;

    private readonly hostedPlugin = new Deferred<PluginMetadata | undefined>();

    @inject(PluginDeployer)
    protected deployer: PluginDeployer;

    async initialize(): Promise<void> {
        this.pluginReader.getPluginMetadata(process.env.HOSTED_PLUGIN)
            .then(this.hostedPlugin.resolve.bind(this.hostedPlugin));

        const pluginPath = process.env.HOSTED_PLUGIN;
        if (pluginPath) {
            const location = new DirectoryDeploymentLocation(path.resolve(pluginPath, '..'));
            const entry = await this.installerService.readPlugin(location, pluginPath, DeploymentKind.Installed);
            this.deployer.deployPlugin(entry);
        }
    }

    async getPlugin(): Promise<PluginMetadata | undefined> {
        return this.hostedPlugin.promise;
    }
}
