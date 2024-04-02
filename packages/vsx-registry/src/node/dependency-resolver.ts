// *****************************************************************************
// Copyright (C) 2024 STMicroelectronics and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable } from "@theia/core/shared/inversify";
import { ArtifactResolver, DependencyResolver, UnversionedPluginId } from "@theia/installer";
import { VSCodeExtensionUri } from "@theia/plugin-ext-vscode/lib/common/vsx-extension-uri";

@injectable()
export class OpenVsxDependencyResolver implements DependencyResolver {
    createDependencyUri(originalResolver: ArtifactResolver, pluginId: UnversionedPluginId): string {
        return VSCodeExtensionUri.fromId(pluginId).toString();
    }
}