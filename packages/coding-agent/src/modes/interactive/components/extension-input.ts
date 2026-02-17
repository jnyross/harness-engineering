/**
 * Simple text input component for extensions.
 */

import { Container, type Focusable, getEditorKeybindings, Input, Spacer, Text, type TUI } from "@mariozechner/pi-tui";
import { theme } from "../theme/theme.js";
import { CountdownTimer } from "./countdown-timer.js";
import { DynamicBorder } from "./dynamic-border.js";
import { keyHint } from "./keybinding-hints.js";

export interface ExtensionInputOptions {
	tui?: TUI;
	timeout?: number;
}

export class ExtensionInputComponent extends Container implements Focusable {
	private input: Input;
	private onSubmitCallback: (value: string) => void;
	private onCancelCallback: () => void;
	private titleText: Text;
	private baseTitle: string;
	private countdown: CountdownTimer | undefined;
	private disposed = false;
	private invokeSubmit(value: string): void {
		if (this.disposed) {
			return;
		}
		try {
			this.onSubmitCallback(value);
		} catch (error) {
			console.error("Extension input onSubmit callback failed:", error);
		}
	}

	private invokeCancel(): void {
		if (this.disposed) {
			return;
		}
		try {
			this.onCancelCallback();
		} catch (error) {
			console.error("Extension input onCancel callback failed:", error);
		}
	}

	// Focusable implementation - propagate to input for IME cursor positioning
	private _focused = false;
	get focused(): boolean {
		return this._focused;
	}
	set focused(value: boolean) {
		this._focused = value;
		this.input.focused = value;
	}

	constructor(
		title: string,
		_placeholder: string | undefined,
		onSubmit: (value: string) => void,
		onCancel: () => void,
		opts?: ExtensionInputOptions,
	) {
		super();

		this.onSubmitCallback = onSubmit;
		this.onCancelCallback = onCancel;
		this.baseTitle = title;

		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		this.titleText = new Text(theme.fg("accent", title), 1, 0);
		this.addChild(this.titleText);
		this.addChild(new Spacer(1));

		if (opts?.timeout && opts.timeout > 0 && opts.tui) {
			this.countdown = new CountdownTimer(
				opts.timeout,
				opts.tui,
				(s) => this.titleText.setText(theme.fg("accent", `${this.baseTitle} (${s}s)`)),
				() => this.invokeCancel(),
			);
		}

		this.input = new Input();
		this.addChild(this.input);
		this.addChild(new Spacer(1));
		this.addChild(new Text(`${keyHint("selectConfirm", "submit")}  ${keyHint("selectCancel", "cancel")}`, 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());
	}

	handleInput(keyData: string): void {
		if (this.disposed) {
			return;
		}
		const kb = getEditorKeybindings();
		if (kb.matches(keyData, "selectConfirm") || keyData === "\n") {
			this.invokeSubmit(this.input.getValue());
		} else if (kb.matches(keyData, "selectCancel")) {
			this.invokeCancel();
		} else {
			this.input.handleInput(keyData);
		}
	}

	dispose(): void {
		this.disposed = true;
		this.countdown?.dispose();
	}
}
