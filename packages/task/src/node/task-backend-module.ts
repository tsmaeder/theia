/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule, Container } from 'inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from "@theia/core/lib/common/messaging";
import { ProcessTask, TaskFactory, TaskProcessOptions } from './process/process-task';
import { TaskClient, TaskServer, taskPath, TaskRunnerRegistry, TaskRunner, TaskRunnerContribution } from '../common/task-protocol';
import { TaskServerImpl } from './task-server';
import { TaskManager } from './task-manager';
import { TaskWatcher } from '../common/task-watcher';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { createCommonBindings } from '../common/task-common-module';
import { TaskRunnerRegistryImpl } from './task-runner-registry';
import { RawOrTerminalTaskRunner } from './process/raw-or-terminal-task-runner';
import { bindContributionProvider } from '@theia/core';
import { TaskBackendContribution } from './task-backend-contribution';

export default new ContainerModule(bind => {

    bind(TaskManager).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toDynamicValue(ctx => ctx.container.get(TaskManager)).inSingletonScope();
    bind(TaskServer).to(TaskServerImpl).inSingletonScope();
    bind(ProcessTask).toSelf().inTransientScope();
    bind(TaskWatcher).toSelf().inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler<TaskClient>(taskPath, client => {
            const taskServer = ctx.container.get<TaskServer>(TaskServer);
            taskServer.setClient(client);
            // when connection closes, cleanup that client of task-server
            client.onDidCloseConnection(() => {
                taskServer.disconnectClient(client);
            });
            return taskServer;
        })
    ).inSingletonScope();

    bind(TaskFactory).toFactory(ctx =>
        (options: TaskProcessOptions) => {
            const child = new Container({ defaultScope: 'Singleton' });
            child.parent = ctx.container;
            child.bind(TaskProcessOptions).toConstantValue(options);
            return child.get(ProcessTask);
        }
    );

    createCommonBindings(bind);

    bind(TaskBackendContribution).toSelf().inSingletonScope();
    for (const identifier of [BackendApplicationContribution, TaskRunnerContribution]) {
        bind(identifier).toService(TaskBackendContribution);
    }

    // task runner
    bind(TaskRunnerRegistry).to(TaskRunnerRegistryImpl).inSingletonScope();
    bindContributionProvider(bind, TaskRunnerContribution);

    // raw/process task
    bind(RawOrTerminalTaskRunner).toSelf().inSingletonScope();
    bind(TaskRunner).to(RawOrTerminalTaskRunner).inSingletonScope();
});
