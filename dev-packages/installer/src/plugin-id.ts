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

export interface PluginId {
    id: string;
    version?: string;
}

export type UnversionedPluginId = Omit<PluginId, 'version'>;
export type VersionedPluginId = Omit<PluginId, 'version'> & { version: string; };

export type VersionedIdString = `${string}@${string}`;
export type UnversionedIdString = string;

export namespace PluginId {

    export const UNPUBLISHED = '<unpublished>';

    export type VersionedId = `${string}@${string}`;
    export type UnversionedId = string;

    export function equals(left: PluginId, right: PluginId): boolean {
        return left === right || left && right && left.id === right.id && left.version === right.version;
    }

    export function unversioned(id: PluginId): UnversionedPluginId {
        return {
            id: id.id,
        };
    }

    export function withVersion(id: PluginId, version: string): VersionedPluginId {
        return {
            ...id,
            version: version
        };
    }

    export function toString(id: PluginId): string {
        return id.version ? `${id.id}@${id.version}` : id.id;
    }

    export function toVersionedString(id: VersionedPluginId): VersionedIdString {
        return toString(id) as VersionedIdString;
    }

    export function toUnversionedString(id: UnversionedPluginId): UnversionedIdString {
        return PluginId.toString(PluginId.unversioned(id));
    }

    export function parse(id: PluginId.VersionedId): VersionedPluginId;
    export function parse(id: PluginId.UnversionedId): UnversionedPluginId;
    export function parse(id: string): PluginId {
        const splitByAt = id.split('@');
        if (splitByAt.length > 2 || splitByAt.length < 1) {
            throw new Error(`Not a valid plugins id: '${id}'`);
        }

        return {
            id: splitByAt[0].toLowerCase(),
            version: splitByAt[1]?.toLowerCase()
        };
    }

    export function fromComponents(components: { publisher: string | undefined, name: string, version: string }): VersionedPluginId {
        return {
            id: `${(components.publisher || UNPUBLISHED).toLowerCase()}.${components.name.toLowerCase()}`,
            version: components.version
        };
    }
}
