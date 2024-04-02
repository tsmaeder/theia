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

import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionContainerModule } from '@theia/core/lib/node/messaging/connection-container-module';

import { InstallerBackendService, InstallerClient, installerBackendServicePath } from '../common/installer-backend-service';
import { ArtifactResolverContribution, InstallerBackendServiceImpl, InstallerService, PluginDeployerContribution } from './installer-service';
import { bindContributionProvider } from '@theia/core';
import { LocalFileArtifactResolver } from './local-file-resolver';

const connectionModule = ConnectionContainerModule.create(({ bind, bindBackendService }) => {
    bindBackendService<InstallerBackendService, InstallerClient>(installerBackendServicePath, InstallerBackendServiceImpl, (server, client) => {
        server.setClient(client);
        client.onDidCloseConnection(() => server.dispose());
        return server;
    });
});

export default new ContainerModule(bind => {
    bind(InstallerBackendServiceImpl).toSelf().inSingletonScope();
    bind(InstallerBackendService).toService(InstallerBackendServiceImpl);
    bindContributionProvider(bind, ArtifactResolverContribution);
    bindContributionProvider(bind, PluginDeployerContribution);
    bind(InstallerService).toSelf().inSingletonScope();
    bind(ConnectionContainerModule).toConstantValue(connectionModule);
    bind(LocalFileArtifactResolver).toSelf().inSingletonScope();
    bind(ArtifactResolverContribution).toService(LocalFileArtifactResolver);
});
