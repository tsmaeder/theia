/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from 'inversify';
import { TaskContribution, TaskResolverRegistry, TaskProviderRegistry } from '@theia/task/lib/common';
import { NpmTaskProvider } from './npm-task-provider';
import { NpmTaskResolver } from './npm-task-resolver';

@injectable()
export class NpmTaskContribution implements TaskContribution {

    @inject(NpmTaskResolver)
    protected readonly taskResolver: NpmTaskResolver;

    @inject(NpmTaskProvider)
    protected readonly taskProvider: NpmTaskProvider;

    registerResolvers(resolvers: TaskResolverRegistry): void {
        resolvers.register('npm', this.taskResolver);
    }

    registerProviders(providers: TaskProviderRegistry): void {
        providers.register('npm', this.taskProvider);
    }
}
