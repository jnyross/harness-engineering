import assert from "node:assert";
import { describe, it } from "node:test";
import { Editor } from "../src/components/editor.js";
import { TUI } from "../src/tui.js";
import { defaultEditorTheme } from "./test-themes.js";
import { VirtualTerminal } from "./virtual-terminal.js";

function createTestTUI(cols = 80, rows = 24): TUI {
	return new TUI(new VirtualTerminal(cols, rows));
}

describe("Editor kitty CSI-u parsing", () => {
	it("inserts printable CSI-u characters for valid modifier values", () => {
		const editor = new Editor(createTestTUI(), defaultEditorTheme);
		editor.handleInput("\x1b[65u");
		assert.equal(editor.getText(), "A");
	});

	it("ignores CSI-u sequences with unsafe modifier integers", () => {
		const editor = new Editor(createTestTUI(), defaultEditorTheme);
		editor.handleInput("\x1b[65;9007199254740994u");
		assert.equal(editor.getText(), "");
	});
});
