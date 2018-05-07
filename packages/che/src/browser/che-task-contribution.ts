/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from 'inversify';
import { TaskContribution, TaskResolverRegistry, TaskProviderRegistry } from '@theia/task/lib/common';
import { CheTaskProvider } from './che-task-provider';
import { CheTaskResolver } from './che-task-resolver';

@injectable()
export class CheTaskContribution implements TaskContribution {

    @inject(CheTaskResolver)
    protected readonly taskResolver: CheTaskResolver;

    @inject(CheTaskProvider)
    protected readonly taskProvider: CheTaskProvider;

    registerResolvers(resolvers: TaskResolverRegistry): void {
        resolvers.register('che', this.taskResolver);
    }

    registerProviders(providers: TaskProviderRegistry): void {
        providers.register('che', this.taskProvider);
    }
}
