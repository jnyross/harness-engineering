/**
 * TUI session selector for --resume flag
 */

import { ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import { KeybindingsManager } from "../core/keybindings.js";
import type { SessionInfo, SessionListProgress } from "../core/session-manager.js";
import { SessionSelectorComponent } from "../modes/interactive/components/session-selector.js";

type SessionsLoader = (onProgress?: SessionListProgress) => Promise<SessionInfo[]>;

/** Show TUI session selector and return selected session path or null if cancelled */
export async function selectSession(
	currentSessionsLoader: SessionsLoader,
	allSessionsLoader: SessionsLoader,
): Promise<string | null> {
	return new Promise((resolve) => {
		const ui = new TUI(new ProcessTerminal());
		const keybindings = KeybindingsManager.create();
		let resolved = false;
		const settle = (value: string | null, shouldExit: boolean = false) => {
			if (resolved) {
				return;
			}
			resolved = true;
			ui.stop();
			if (shouldExit) {
				process.exit(0);
				return;
			}
			resolve(value);
		};

		const selector = new SessionSelectorComponent(
			currentSessionsLoader,
			allSessionsLoader,
			(path: string) => {
				settle(path);
			},
			() => {
				settle(null);
			},
			() => {
				settle(null, true);
			},
			() => ui.requestRender(),
			{ showRenameHint: false, keybindings },
		);

		ui.addChild(selector);
		ui.setFocus(selector.getSessionList());
		ui.start();
	});
}
