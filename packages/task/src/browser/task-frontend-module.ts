/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from 'inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CommandContribution, MenuContribution, bindContributionProvider } from '@theia/core/lib/common';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser/messaging';
import { QuickOpenTask } from './quick-open-task';
import { TaskConfigurations } from './task-configurations';
import { TaskFrontendContribution } from './task-frontend-contribution';
import { TaskProviderRegistryImpl } from './task-provider-registry-impl';
import { TaskResolverRegistryImpl } from './task-resolver-registry-impl';
import { TaskService } from './task-service';
import { createCommonBindings } from '../common/task-common-module';
import { TaskServer, taskPath, TaskResolverRegistry, TaskContribution, TaskResolver, TaskProviderRegistry } from '../common/task-protocol';
import { TaskWatcher } from '../common/task-watcher';
import { RawOrTerminalTaskResolver } from './raw-or-terminal-task-resolver';

export default new ContainerModule(bind => {
    bind(TaskFrontendContribution).toSelf().inSingletonScope();
    bind(TaskService).toSelf().inSingletonScope();

    for (const identifier of [FrontendApplicationContribution, CommandContribution, MenuContribution, TaskContribution]) {
        bind(identifier).toService(TaskFrontendContribution);
    }

    bind(TaskWatcher).toSelf().inSingletonScope();
    bind(QuickOpenTask).toSelf().inSingletonScope();
    bind(TaskConfigurations).toSelf().inSingletonScope();

    bind(TaskServer).toDynamicValue(ctx => {
        const connection = ctx.container.get(WebSocketConnectionProvider);
        const taskWatcher = ctx.container.get(TaskWatcher);
        return connection.createProxy<TaskServer>(taskPath, taskWatcher.getTaskClient());
    }).inSingletonScope();

    createCommonBindings(bind);

    bind(TaskProviderRegistry).to(TaskProviderRegistryImpl).inSingletonScope();
    bind(TaskResolverRegistry).to(TaskResolverRegistryImpl).inSingletonScope();
    bindContributionProvider(bind, TaskContribution);

    // process task
    bind(RawOrTerminalTaskResolver).toSelf().inSingletonScope();
    bind(TaskResolver).to(RawOrTerminalTaskResolver).inSingletonScope();
});
