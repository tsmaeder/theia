// *****************************************************************************
// Copyright (C) 2020 TypeFox and others.
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

import URI from '@theia/core/lib/common/uri';
import { PluginId } from '@theia/installer';

/**
 * Static methods for identifying a plugin as the target of the VSCode deployment system.
 * In practice, this means that it will be resolved and deployed by the Open-VSX system.
 */
export namespace VSCodeExtensionUri {
    export const SCHEME = 'vscode-extension';

    export function is(uri: URI): boolean {
        return uri.scheme === SCHEME && !!uri.authority;
    }

    export function fromId(id: PluginId): URI {
        if (id.version) {
            return new URI().withScheme(VSCodeExtensionUri.SCHEME).withAuthority(id.id).withPath(`@${id.version}`);
        } else {
            return new URI().withScheme(VSCodeExtensionUri.SCHEME).withAuthority(id.id);
        }
    }

    export function toId(uri: URI): PluginId | undefined {
        if (uri.scheme === VSCodeExtensionUri.SCHEME) {
            if (uri.path.isRoot) {
                return PluginId.parse(`${uri.authority}`);
            } else {
                return PluginId.parse(`${uri.authority}@${uri.path.base}`);
            }
        }
        return undefined;
    }
}
