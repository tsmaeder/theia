// *****************************************************************************
// Copyright (C) 2022 STMicroelectronics, Ericsson, ARM, EclipseSource and others.
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
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { ipcRenderer } from '../../../electron-shared/electron';
import { injectable, postConstruct } from 'inversify';
import { DefaultSecondaryWindowService } from '../../browser/window/default-secondary-window-service';
import { CloseSecondaryRequestArguments, CLOSE_SECONDARY_REQUESTED_SIGNAL, FOCUS_SECONDARY_REQUESTED_SIGNAL } from '../../electron-common/messaging/electron-messages';

@injectable()
export class ElectronSecondaryWindowService extends DefaultSecondaryWindowService {

    private electronWindowsByName: Map<string, () => Promise<boolean>> = new Map();

    @postConstruct()
    override init(): void {
        super.init();
        ipcRenderer.addListener(CLOSE_SECONDARY_REQUESTED_SIGNAL, (_sender, args: CloseSecondaryRequestArguments) => this.handleCloseRequestedEvent(args));
    }

    protected async handleCloseRequestedEvent(event: CloseSecondaryRequestArguments): Promise<void> {
        const safeToClose = await this.safeToClose(event.windowName);
        if (safeToClose) {
            ipcRenderer.send(event.confirmChannel);
        } else {
            ipcRenderer.send(event.cancelChannel);
        }
    }

    protected override doCreateSecondaryWindow(id: string, wouldLoseStateOnClosing: () => boolean, tryCloseWidget: (trySaving: boolean) => Promise<boolean>,
        closed: (win: Window) => void): Window | undefined {

        this.electronWindowsByName.set(id, () => tryCloseWidget(true));
        const win = window.open(DefaultSecondaryWindowService.SECONDARY_WINDOW_URL, id, 'popup') || undefined;
        if (win) {
            win.addEventListener('DOMContentLoaded', () => {
                win.addEventListener('unload', evt => {
                    if (closed) {
                        closed(win);
                    }
                    this.handleWindowClosed(win!);
                    this.electronWindowsByName.delete(id);
                });
            });
        }
        return win;
    }

    override focus(win: Window): void {
        ipcRenderer.send(FOCUS_SECONDARY_REQUESTED_SIGNAL, { windowId: win.name });
    }

    safeToClose(windowName: string): Promise<boolean> {
        const closingHandler = this.electronWindowsByName.get(windowName);
        if (closingHandler) {
            return closingHandler!();
        } else {
            return Promise.resolve(true);
        }
    }
}
