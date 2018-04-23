/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable } from "inversify";
import { MessageService } from "../message-service";
import { MessageOptions } from "../message-service-protocol";

@injectable()
export class MockMessageService implements MessageService {
    // tslint:disable-next-line:no-any

    log(message: string, ...actions: string[]): Promise<string | undefined>;
    log(message: string, options?: MessageOptions, ...actions: string[]): Promise<string | undefined>;
    // tslint:disable-next-line:no-any
    log(message: string, ...args: any[]): Promise<string | undefined> {
        return Promise.resolve(undefined);
    }

    info(message: string, ...actions: string[]): Promise<string | undefined>;
    info(message: string, options?: MessageOptions, ...actions: string[]): Promise<string | undefined>;
    // tslint:disable-next-line:no-any
    info(message: any, options?: any, ...actions: any[]): Promise<string | undefined> {
        return Promise.resolve(undefined);
    }
    warn(message: string, ...actions: string[]): Promise<string | undefined>;
    warn(message: string, options?: MessageOptions, ...actions: string[]): Promise<string | undefined>;
    // tslint:disable-next-line:no-any
    warn(message: any, options?: any, ...actions: any[]): Promise<string | undefined> {
        return Promise.resolve(undefined);
    }
    error(message: string, ...actions: string[]): Promise<string | undefined>;
    error(message: string, options?: MessageOptions, ...actions: string[]): Promise<string | undefined>;
    // tslint:disable-next-line:no-any
    error(message: any, options?: any, ...actions: any[]): Promise<string | undefined> {
        return Promise.resolve(undefined);
    }
}
