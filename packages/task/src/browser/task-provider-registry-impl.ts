/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, postConstruct } from 'inversify';
import { Disposable } from '@theia/core';
import { TaskProviderRegistry, TaskProvider } from '../common/task-protocol';

@injectable()
export class TaskProviderRegistryImpl implements TaskProviderRegistry {
    protected providers: Map<string, TaskProvider>;

    @postConstruct()
    protected init(): void {
        this.providers = new Map();
    }

    register(type: string, resolver: TaskProvider): Disposable {
        this.providers.set(type, resolver);
        return {
            dispose: () => this.providers.delete(type)
        };
    }

    getProvider(type: string): TaskProvider | undefined {
        return this.providers.get(type);
    }

    getProviders(): TaskProvider[] {
        return [...this.providers.values()];
    }
}
