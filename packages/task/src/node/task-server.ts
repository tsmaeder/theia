/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable, named, postConstruct } from 'inversify';
import { ILogger, Disposable } from '@theia/core/lib/common/';
import { TaskClient, TaskExitedEvent, TaskInfo, TaskServer, TaskRunnerRegistry, TaskConfiguration } from '../common/task-protocol';
import { TaskManager } from './task-manager';

@injectable()
export class TaskServerImpl implements TaskServer {

    /** Task clients, to send notifications-to. */
    protected clients: TaskClient[] = [];
    /** Map of objects to dispose-of, per running task id */
    protected tasksToDispose = new Map<number, Disposable>();

    @inject(ILogger) @named('task')
    protected readonly logger: ILogger;

    @inject(TaskManager)
    protected readonly taskManager: TaskManager;

    @inject(TaskRunnerRegistry)
    protected readonly runnerRegistry: TaskRunnerRegistry;

    @postConstruct()
    protected init(): void {
        this.taskManager.onDelete(id => {
            const toDispose = this.tasksToDispose.get(id);
            if (toDispose !== undefined) {
                toDispose.dispose();
                this.tasksToDispose.delete(id);
            }
        });
    }

    dispose() {
        // do nothing
    }

    getTasks(context?: string | undefined): Promise<TaskInfo[]> {
        const taskInfo: TaskInfo[] = [];

        const tasks = this.taskManager.getTasks(context);
        if (tasks !== undefined) {
            for (const task of tasks) {
                taskInfo.push(task.getRuntimeInfo());
            }
        }
        this.logger.debug(`getTasks(): about to return task information for ${taskInfo.length} tasks`);

        return Promise.resolve(taskInfo);
    }

    async run(options: TaskConfiguration, ctx?: string): Promise<TaskInfo> {
        const taskType = options.type;
        const runner = this.runnerRegistry.getRunner(taskType);
        if (!runner) {
            return Promise.reject(new Error(`No corresponding Runner found for the Task type ${taskType}`));
        }
        const task = await runner.run(options, ctx);
        const taskInfo = task.getRuntimeInfo();
        this.fireTaskCreatedEvent(taskInfo);
        return taskInfo;
    }

    protected fireTaskExitedEvent(event: TaskExitedEvent) {
        this.logger.debug(log => log(`task has exited:`, event));

        this.clients.forEach(client => {
            client.onTaskExit(event);
        });
    }

    protected fireTaskCreatedEvent(event: TaskInfo) {
        this.logger.debug(log => log(`task created:`, event));

        this.clients.forEach(client => {
            client.onTaskCreated(event);
        });
    }

    /** Kill task for a given id. Rejects if task is not found */
    async kill(id: number): Promise<void> {
        const taskToKill = this.taskManager.get(id);
        if (taskToKill !== undefined) {
            this.logger.info(`Killing task id ${id}`);
            return taskToKill.kill();
        } else {
            this.logger.info(`Could not find task to kill, task id ${id}. Already terminated?`);
            return Promise.reject(`Could not find task to kill, task id ${id}. Already terminated?`);
        }
    }

    /** Adds a client to this server */
    setClient(client: TaskClient) {
        this.logger.debug(`a client has connected - adding it to the list:`);
        this.clients.push(client);
    }

    /** Removes a client, from this server */
    disconnectClient(client: TaskClient) {
        this.logger.debug(`a client has disconnected - removed from list:`);
        const idx = this.clients.indexOf(client);
        if (idx > -1) {
            this.clients.splice(idx, 1);
        }
    }
}
