/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import { TaskRunnerContribution, TaskRunnerRegistry } from '@theia/task/lib/common';
import { CheTaskRunner } from './che-task-runner';

@injectable()
export class CheTaskRunnerContribution implements TaskRunnerContribution {

    @inject(CheTaskRunner)
    protected readonly cheRunner: CheTaskRunner;

    registerRunner(runners: TaskRunnerRegistry): void {
        runners.registerRunner(this.cheRunner);
    }
}
