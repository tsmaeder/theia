/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from "inversify";
import URI from "@theia/core/lib/common/uri";
import {
    Command, CommandContribution, CommandRegistry, MessageService
} from "@theia/core";
import {
    open, QuickOpenModel, QuickOpenService, OpenerService, QuickOpenItem,
    QuickOpenMode,
} from "@theia/core/lib/browser";
import { WorkspaceService } from '@theia/workspace/lib/browser';
import {
    BuildConfigurationService, BuildConfiguration
} from "./build-configurations-service";
import { FileSystem } from "@theia/filesystem/lib/common";

@injectable()
export class ChangeBuildConfiguration implements QuickOpenModel {

    @inject(QuickOpenService)
    protected readonly quickOpenService: QuickOpenService;

    @inject(FileSystem)
    protected readonly fileSystem: FileSystem;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(BuildConfigurationService)
    protected readonly buildConfigurationService: BuildConfigurationService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    async onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): Promise<void> {
        const items: QuickOpenItem[] = [];
        const active: BuildConfiguration | undefined = await this.buildConfigurationService.getActiveConfiguration();

        // Add one item per build config.
        for (const config of this.configs) {
            items.push(new QuickOpenItem({
                label: config.name,
                description: config === active ? 'active' : '',
                run: (mode: QuickOpenMode): boolean => {
                    if (mode !== QuickOpenMode.OPEN) {
                        return false;
                    }

                    this.buildConfigurationService.changeActiveConfiguration(config);
                    return true;
                },
            }));
        }

        // Add one item to go to .theia/builds.json.  If it doesn't exist,
        // create it and add a dummy config.
        items.push(new QuickOpenItem({
            label: "Create new...",
            run: (mode: QuickOpenMode): boolean => {
                if (mode !== QuickOpenMode.OPEN) {
                    return false;
                }

                this.workspaceService.root.then(async root => {
                    if (!root) {
                        return;
                    }

                    const p = new URI(root.uri).resolve('.theia').resolve('builds.json');
                    const exists: boolean = await this.fileSystem.exists(p.toString());
                    if (!exists) {
                        await this.fileSystem.createFile(p.toString(), {
                            content: `\
{
    "builds": [{
        "name": "My Build",
        "directory": "/path/to/my/build"
    }]
}
`,
                        });
                    }

                    open(this.openerService, p);
                }).catch(e => {
                    this.messageService.error(`Couldn't open .theia/builds.json: ${e}`);
                });

                return true;
            }
        }));

        acceptor(items);
    }

    protected configs: BuildConfiguration[] = [];

    open() {
        const doOpen = () => {
            this.quickOpenService.open(this, {
                placeholder: 'Choose a build configuration...',
            });
        };

        this.buildConfigurationService.getConfigurations().then(configs => {
            this.configs = configs;
            doOpen();
        }).catch(doOpen);
    }
}

/**
 * Open the quick open menu to let the user change the active build
 * configuration.
 */
export const CHANGE_BUILD_CONFIGURATION: Command = {
    id: 'languages.change-build-configuration',
    label: 'Change Build Configuration'
};

@injectable()
export class BuildConfigurationsContributions implements CommandContribution {

    @inject(ChangeBuildConfiguration)
    protected readonly changeBuildConfiguration: ChangeBuildConfiguration;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(CHANGE_BUILD_CONFIGURATION, {
            execute: () => this.changeBuildConfiguration.open()
        });
    }
}
