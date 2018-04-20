/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { BuildConfigurationService, BuildConfigurationServiceImpl, GetWorkspaceRoot } from "./build-configurations-service";
import { ContainerModule, Container } from "inversify";
import { expect } from 'chai';
import { ILogger, MessageService } from "@theia/core";
import { MockLogger } from "@theia/core/lib/common/test/mock-logger";
import { FileSystem, FileStat } from "@theia/filesystem/lib/common";
import { StorageService } from "@theia/core/lib/browser/storage-service";
import { MockStorageService } from "@theia/core/lib/browser/test/mock-storage-service";
import * as temp from 'temp';
import { FileSystemNode } from "@theia/filesystem/lib/node/node-filesystem";
import URI from "@theia/core/lib/common/uri";
import { MockMessageService } from "@theia/core/lib/common/test/mock-message-service";
import sinon = require("sinon");

let container: Container;
const track = temp;

beforeEach(function () {
    const m = new ContainerModule(bind => {
        const baseDir = track.mkdirSync();

        bind(BuildConfigurationService).to(BuildConfigurationServiceImpl).inSingletonScope();

        bind(ILogger).to(MockLogger).inSingletonScope();
        bind(FileSystemNode).toSelf().inSingletonScope();
        bind(FileSystem).to(FileSystemNode).inSingletonScope();
        bind(MessageService).to(MockMessageService).inSingletonScope();
        bind(GetWorkspaceRoot).toDynamicValue(ctx => () => {
            const fs = ctx.container.get<FileSystem>(FileSystem);
            return fs.getFileStat('file://' + baseDir);
        }).inSingletonScope();
        bind(StorageService).to(MockStorageService).inSingletonScope();
    });

    container = new Container();
    container.load(m);
});

/**
 * Create the .theia/builds.json file with `buildsJsonContent` as its content
 * and create/return an instance of the build configuration service.  If
 * `buildsJsonContent` is undefined, don't create .theia/builds.json.
 * If `activeBuildConfigName` is not undefined, also create an entrty in the
 * storage service representing the saved active build config.
 */
async function initializeTest(buildsJsonContent: string | undefined, activeBuildConfigName: string | undefined)
    : Promise<BuildConfigurationService> {

    // Create builds.json
    if (buildsJsonContent !== undefined) {
        const root = await container.get<() => Promise<FileStat>>(GetWorkspaceRoot)();
        const buildsJsonPath = new URI(root.uri).resolve('.theia').resolve('builds.json');
        const fs = container.get<FileSystem>(FileSystem);
        const buildsJsonFileStat = await fs.createFile(buildsJsonPath.toString());
        fs.setContent(buildsJsonFileStat, buildsJsonContent);
    }

    // Save active build config
    if (activeBuildConfigName !== undefined) {
        const storage = container.get<StorageService>(StorageService);
        storage.setData('active-build-configuration', {
            configName: activeBuildConfigName,
        });
    }

    return container.get<BuildConfigurationService>(BuildConfigurationService);
}

describe("build-configurations", function () {
    it("should work with no config file", async function () {
        const service = await initializeTest(undefined, undefined);

        const configs = await service.getConfigurations();
        const active = await service.getActiveConfiguration();

        expect(active).eq(undefined);
        expect(configs).lengthOf(0);
    });

    it("should work with an empty file", async function () {
        const service = await initializeTest('', undefined);

        const configs = await service.getConfigurations();
        const active = await service.getActiveConfiguration();

        expect(active).eq(undefined);
        expect(configs).lengthOf(0);
    });

    it("should work with {}", async function () {
        const service = await initializeTest('{}', undefined);

        const configs = await service.getConfigurations();
        const active = await service.getActiveConfiguration();

        expect(active).eq(undefined);
        expect(configs).lengthOf(0);
    });

    it("should report invalid json", async function () {
        const messageService = container.get<MessageService>(MessageService);
        const spy = sinon.spy(messageService, 'error');
        const service = await initializeTest('{', 'foo');

        const configs = await service.getConfigurations();
        const active = await service.getActiveConfiguration();

        sinon.assert.calledWithMatch(spy, 'Invalid JSON syntax');
        expect(active).eq(undefined);
        expect(configs).lengthOf(0);
    });

    it("should report missing properties", async function () {
        const messageService = container.get<MessageService>(MessageService);
        const spy = sinon.spy(messageService, 'error');
        const service = await initializeTest(JSON.stringify({
            builds: [{
                // This is missing "name".
                directory: '/tmp/builds/release',
            }],
        }), undefined);

        const configs = await service.getConfigurations();
        const active = await service.getActiveConfiguration();

        sinon.assert.calledWithMatch(spy, ".builds[0] should have required property 'name'");
        expect(active).eq(undefined);
        expect(configs).lengthOf(0);
    });

    it("should report properties with wrong type", async function () {
        const messageService = container.get<MessageService>(MessageService);
        const spy = sinon.spy(messageService, 'error');
        const service = await initializeTest(JSON.stringify({
            builds: [{
                name: 2,
                directory: '/tmp/builds/release',
            }],
        }), undefined);

        const configs = await service.getConfigurations();
        const active = await service.getActiveConfiguration();

        sinon.assert.calledWithMatch(spy, ".builds[0].name should be string");
        expect(active).eq(undefined);
        expect(configs).lengthOf(0);
    });

    it("should work with an empty list of builds", async function () {
        const service = await initializeTest(JSON.stringify({
            builds: []
        }), undefined);

        const configs = await service.getConfigurations();
        const active = await service.getActiveConfiguration();

        expect(active).eq(undefined);
        expect(configs).lengthOf(0);
    });

    it("should work with a simple list of builds", async function () {
        const builds = [{
            name: 'Release',
            directory: '/tmp/builds/release',
        }, {
            name: 'Debug',
            directory: '/tmp/builds/debug',
        }];
        const service = await initializeTest(JSON.stringify({
            builds: builds,
        }), undefined);

        const configs = await service.getConfigurations();
        const active = await service.getActiveConfiguration();

        expect(active).eq(undefined);
        expect(configs).to.be.an('array').of.lengthOf(2);
        expect(configs).to.have.deep.members(builds);
    });

    it("should work with a simple list of builds and an active config", async function () {
        const builds = [{
            name: 'Release',
            directory: '/tmp/builds/release',
        }, {
            name: 'Debug',
            directory: '/tmp/builds/debug',
        }];
        const service = await initializeTest(JSON.stringify({
            builds: builds,
        }), 'Debug');

        const configs = await service.getConfigurations();
        const active = await service.getActiveConfiguration();

        expect(active).to.be.deep.eq(builds[1]);
        expect(configs).to.be.an('array').of.lengthOf(2);
        expect(configs).to.have.deep.members(builds);
    });

    it("should ignore an active config that doesn't exist", async function () {
        const builds = [{
            name: 'Release',
            directory: '/tmp/builds/release',
        }, {
            name: 'Debug',
            directory: '/tmp/builds/debug',
        }];
        const service = await initializeTest(JSON.stringify({
            builds: builds,
        }), 'foobar');

        const configs = await service.getConfigurations();
        const active = await service.getActiveConfiguration();

        expect(active).to.be.eq(undefined);
        expect(configs).to.be.an('array').of.lengthOf(2);
        expect(configs).to.have.deep.members(builds);
    });
});
