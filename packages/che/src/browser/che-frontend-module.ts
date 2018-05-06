/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from 'inversify';
import { TaskResolver, TaskContribution } from '@theia/task/lib/common';
import { CheTaskResolver } from './che-task-resolver';
import { CheTaskContribution } from './che-task-contribution';

export default new ContainerModule(bind => {
    bind(CheTaskResolver).toSelf().inSingletonScope();
    bind(TaskResolver).to(CheTaskResolver).inSingletonScope();
    bind(TaskContribution).to(CheTaskContribution).inSingletonScope();
});
