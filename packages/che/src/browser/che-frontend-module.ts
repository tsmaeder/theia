/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from 'inversify';
import { TaskContribution } from '@theia/task/lib/common';
import { CheTaskContribution } from './che-task-contribution';
import { CheTaskProvider } from './che-task-provider';
import { CheTaskResolver } from './che-task-resolver';

export default new ContainerModule(bind => {
    bind(CheTaskProvider).toSelf().inSingletonScope();
    bind(CheTaskResolver).toSelf().inSingletonScope();
    bind(TaskContribution).to(CheTaskContribution).inSingletonScope();
});
