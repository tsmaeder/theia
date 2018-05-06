/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { JsonRpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { RawProcessOptions } from '@theia/process/lib/node/raw-process';
import { TerminalProcessOptions } from '@theia/process/lib/node/terminal-process';
import { Disposable } from '@theia/core';

export const taskPath = '/services/task';

export const TaskServer = Symbol('TaskServer');
export const TaskClient = Symbol('TaskClient');

export type ProcessType = 'terminal' | 'raw';

export interface TaskConfiguration {
    type: string;
    /** A label that uniquely identifies a task configuration */
    label: string;

    /**
     * Additional task type specific properties.
     */
    [key: string]: any;
}
export interface RawOrTerminalTaskConfiguration extends TaskConfiguration {
    // TODO: remove
    processType: ProcessType;
    type: 'raw' | 'terminal';
    /** contains 'command', 'args?', 'options?' */
    processOptions: RawProcessOptions | TerminalProcessOptions;
    /**
     * windows version of processOptions. Used in preference on Windows, if
     * defined
     */
    windowsProcessOptions?: RawProcessOptions | TerminalProcessOptions;
    /**
     * The 'current working directory' the task will run in. Can be a uri-as-string
     * or plain string path. If the cwd is meant to be somewhere under the workspace,
     * one can use the variable `${workspaceFolder}`, which will be replaced by its path,
     * at runtime. If not specified, defaults to the workspace root.
     * ex:  cwd: '${workspaceFolder}/foo'
     */
    cwd?: string;
}
export interface RawTaskConfiguration extends RawOrTerminalTaskConfiguration {
    type: 'raw';
}
export interface TerminalTaskConfiguration extends RawOrTerminalTaskConfiguration {
    type: 'terminal';
}

export interface TaskInfo {
    /** internal unique task id */
    taskId: number,
    /** terminal id. Defined if task is run as a terminal process */
    terminalId?: number,
    /** internal unique process id */
    processId?: number,
    /** OS PID of the process running the task */
    osProcessId: number,
    /** The command used to start this task */
    command: string,
    /** task label */
    label: string,
    /** context that was passed as part of task creation, if any */
    ctx?: string
}

export interface TaskServer extends JsonRpcServer<TaskClient> {
    /** Run a task. Optionally pass a context.  */
    run(task: TaskConfiguration, ctx?: string): Promise<TaskInfo>;
    /** Kill a task, by id. */
    kill(taskId: number): Promise<void>;
    /**
     * Returns a list of currently running tasks. If a context is provided,
     * only the tasks started in that context will be provided. Using an
     * undefined context matches all tasks, no matter the creation context.
     */
    getTasks(ctx?: string): Promise<TaskInfo[]>

    /** removes the client that has disconnected */
    disconnectClient(client: TaskClient): void;
}

export const TaskContribution = Symbol('TaskContribution');
/**
 * The Task Contribution should be implemented to register custom Resolvers.
 */
export interface TaskContribution {
    registerResolvers(resolvers: TaskResolverRegistry): void;
}
export const TaskResolver = Symbol('TaskResolver');
export interface TaskResolver {
    resolveTask(task: TaskConfiguration): Promise<TaskConfiguration>;
}
export const TaskResolverRegistry = Symbol('TaskResolverRegistry');
export interface TaskResolverRegistry {
    register(type: string, runner: TaskResolver): Disposable;
    getResolver(type: string): TaskResolver | undefined;
}

export const TaskRunnerContribution = Symbol('TaskRunnerContribution');
/**
 * The Task Runner Contribution should be implemented to register custom Runners.
 */
export interface TaskRunnerContribution {
    registerRunner(runners: TaskRunnerRegistry): void;
}
export const TaskRunner = Symbol('TaskRunner');
export interface TaskRunner {
    type: string;
    run(options: TaskConfiguration, ctx?: string): Promise<Task>;
}
export const TaskRunnerRegistry = Symbol('TaskRunnerRegistry');
export interface TaskRunnerRegistry {
    registerRunner(runner: TaskRunner): Disposable;
    getRunner(type: string): TaskRunner | undefined;
}
export interface Task {
    id: number;
    context?: string;
    kill(): Promise<void>;
    getRuntimeInfo(): TaskInfo;
}

/** Event sent when a task has concluded its execution */
export interface TaskExitedEvent {
    taskId: number;
    code: number;
    signal?: string;
    ctx?: string
}

export interface TaskClient {
    onTaskExit(event: TaskExitedEvent): void;
    onTaskCreated(event: TaskInfo): void;
}
