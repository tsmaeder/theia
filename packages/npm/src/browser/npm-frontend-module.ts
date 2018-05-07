/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from 'inversify';
import { TaskContribution } from '@theia/task/lib/common';
import { NpmTaskContribution } from './npm-task-contribution';
import { NpmTaskProvider } from './npm-task-provider';
import { NpmTaskResolver } from './npm-task-resolver';

export default new ContainerModule(bind => {
    bind(NpmTaskProvider).toSelf().inSingletonScope();
    bind(NpmTaskResolver).toSelf().inSingletonScope();
    bind(TaskContribution).to(NpmTaskContribution).inSingletonScope();
});
