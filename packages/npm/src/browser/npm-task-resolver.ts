/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import { TaskResolver } from '@theia/task/lib/common';
import { VariableResolverService } from '@theia/variable-resolver/lib/browser';
import { NpmTaskConfiguration } from '../common/task-protocol';

@injectable()
export class NpmTaskResolver implements TaskResolver {

    @inject(VariableResolverService)
    protected readonly variableResolverService: VariableResolverService;

    async resolveTask(task: NpmTaskConfiguration): Promise<NpmTaskConfiguration> {
        const resultTask: NpmTaskConfiguration = {
            type: task.type,
            label: task.label,
            script: task.script,
            processType: 'terminal',
            processOptions: {
                command: `npm`,
                args: ['run', task.script]
            }
        };
        resultTask.cwd = await this.variableResolverService.resolve(task.cwd ? task.cwd : '${workspaceFolder}');
        return resultTask;
    }
}
