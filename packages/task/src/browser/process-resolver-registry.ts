/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, postConstruct } from 'inversify';
import { Disposable } from '@theia/core';
import { TaskResolverRegistry, TaskResolver } from '../common/task-protocol';

@injectable()
export class TaskResolverRegistryImpl implements TaskResolverRegistry {

    protected resolvers: Map<string, TaskResolver>;

    @postConstruct()
    protected init(): void {
        this.resolvers = new Map();
    }

    register(type: string, resolver: TaskResolver): Disposable {
        this.resolvers.set(type, resolver);
        return {
            dispose: () => this.resolvers.delete(type)
        };
    }

    getResolver(type: string): TaskResolver | undefined {
        return this.resolvers.get(type);
    }
}
