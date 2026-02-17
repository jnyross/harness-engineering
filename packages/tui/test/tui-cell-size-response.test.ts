import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCellDimensions, setCellDimensions } from "../src/terminal-image.js";
import { TUI } from "../src/tui.js";
import { VirtualTerminal } from "./virtual-terminal.js";

function createTestTui(): TUI {
	return new TUI(new VirtualTerminal(80, 24));
}

describe("TUI cell-size response parsing", () => {
	it("updates cell dimensions for valid positive integer responses", () => {
		setCellDimensions({ widthPx: 9, heightPx: 18 });
		const tui = createTestTui();
		(tui as unknown as { inputBuffer: string }).inputBuffer = "\x1b[6;24;12t";
		(tui as unknown as { cellSizeQueryPending: boolean }).cellSizeQueryPending = true;

		const remaining = (tui as unknown as { parseCellSizeResponse: () => string }).parseCellSizeResponse();

		assert.equal(remaining, "");
		assert.deepEqual(getCellDimensions(), { widthPx: 12, heightPx: 24 });
	});

	it("ignores unsafe integer dimension responses", () => {
		setCellDimensions({ widthPx: 9, heightPx: 18 });
		const tui = createTestTui();
		(tui as unknown as { inputBuffer: string }).inputBuffer = "\x1b[6;9007199254740993;12t";
		(tui as unknown as { cellSizeQueryPending: boolean }).cellSizeQueryPending = true;

		const remaining = (tui as unknown as { parseCellSizeResponse: () => string }).parseCellSizeResponse();

		assert.equal(remaining, "");
		assert.deepEqual(getCellDimensions(), { widthPx: 9, heightPx: 18 });
	});
});
