/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import { FileSystem } from '@theia/filesystem/lib/common';
import { TaskProvider } from '@theia/task/lib/common';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { NpmTaskConfiguration } from '../common/task-protocol';

@injectable()
export class NpmTaskProvider implements TaskProvider {

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(FileSystem)
    protected readonly fileSystem: FileSystem;

    async provideTasks(): Promise<NpmTaskConfiguration[]> {
        const content = await this.resolvePackageJsonContent();
        if (!content) {
            return [];
        }

        const tasks: NpmTaskConfiguration[] = [];
        const pack = JSON.parse(content);
        const scripts = pack.scripts;
        for (const script in scripts) {
            if (scripts.hasOwnProperty(script)) {
                const detectedTask: NpmTaskConfiguration = {
                    type: 'npm',
                    label: `${script} (detected)`,
                    script: script,
                    processType: 'terminal',
                    processOptions: {
                        command: `npm`,
                        args: ['run', script]
                    }
                };
                tasks.push(detectedTask);
            }
        }
        return tasks;
    }

    protected async resolvePackageJsonContent(): Promise<string | undefined> {
        const root = await this.workspaceService.root;
        if (!root) {
            return undefined;
        }
        const uri = root.uri + '/package.json';
        const { content } = await this.fileSystem.resolveContent(uri);
        return content;
    }
}
