/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject, named } from 'inversify';
import { ILogger } from '@theia/core';
import { Task, TaskRunner } from '@theia/task/lib/common';
import { CheTaskConfiguration } from '../common/task-protocol';

export interface MachineIdentifier {
    machineName: string,
    workspaceId: string
}
export interface MachineExec {
    identifier: MachineIdentifier,
    cmd: string[],
    tty: boolean,
    cols: number,
    rows: number,
    id?: number
}
export interface MachineExecClient {
    run(exec: MachineExec): Promise<number>;
}

@injectable()
export class CheTaskRunner implements TaskRunner {

    protected readonly machineExecClient: MachineExecClient;

    type = 'che';

    @inject(ILogger) @named('task')
    protected readonly logger: ILogger;

    async run(task: CheTaskConfiguration, ctx?: string): Promise<Task> {
        this.logger.error(`Running Che Task`);

        // const machineExec = {
        //     identifier: {
        //         machineName: task.target,
        //         workspaceId: task.target
        //     },
        //     cmd: [task.command],
        //     cols: 80,
        //     rows: 80,
        //     tty: true
        // };

        // this.terminalId = await this.machineExecClient.run(machineExec);

        return Promise.reject(new Error(`Che Task Runner isn't implemented`));
    }
}
