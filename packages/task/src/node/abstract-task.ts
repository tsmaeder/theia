/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject, named } from 'inversify';
import { ILogger } from '@theia/core/lib/common/';
import { TaskManager } from './task-manager';
import { ProcessType, TaskInfo, Task } from '../common/task-protocol';
import { Process } from "@theia/process/lib/node";

export const TaskProcessOptions = Symbol("TaskProcessOptions");
export interface TaskProcessOptions {
    label: string,
    command: string,
    process: Process,
    processType: ProcessType,
    context?: string
}

export const TaskFactory = Symbol("TaskFactory");
export type TaskFactory = (options: TaskProcessOptions) => AbstractTask;

@injectable()
export abstract class AbstractTask implements Task {
    protected taskId: number;

    constructor(
        @inject(TaskManager) protected readonly taskManager: TaskManager,
        @inject(ILogger) @named('task') protected readonly logger: ILogger,
        @inject(TaskProcessOptions) protected readonly options: TaskProcessOptions
    ) {
        this.taskId = this.taskManager.register(this, this.options.context);

        const toDispose =
            this.process.onExit(event => {
                this.taskManager.delete(this);
                toDispose.dispose();
            });
        this.logger.info(`Created new task, id: ${this.id}, process id: ${this.options.process.id}, OS PID: ${this.process.pid}, context: ${this.context}`);
    }

    /** terminates the task */
    abstract kill(): Promise<void>;

    /** Returns runtime information about task */
    abstract getRuntimeInfo(): TaskInfo;

    get command() {
        return this.options.command;
    }
    get process() {
        return this.options.process;
    }

    get id() {
        return this.taskId;
    }

    get context() {
        return this.options.context;
    }

    get processType() {
        return this.options.processType;
    }

    get label() {
        return this.options.label;
    }
}
