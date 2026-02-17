import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getExternalEditorError } from "../src/modes/interactive/external-editor-status.js";

function createResult(overrides: Partial<SpawnSyncReturns<string>>): SpawnSyncReturns<string> {
	return {
		stdout: "",
		stderr: "",
		status: 0,
		signal: null,
		output: [],
		pid: 1,
		error: undefined,
		...overrides,
	} as SpawnSyncReturns<string>;
}

describe("getExternalEditorError", () => {
	it("reports startup failures", () => {
		const result = createResult({ status: null, error: new Error("spawn ENOENT") });
		expect(getExternalEditorError(result)).toBe("Failed to start external editor: spawn ENOENT");
	});

	it("includes command context for startup failures when provided", () => {
		const result = createResult({ status: null, error: new Error("spawn ENOENT") });
		expect(getExternalEditorError(result, { invokedCommand: "code --wait /tmp/editor.md" })).toBe(
			"Failed to start external editor command 'code --wait /tmp/editor.md': spawn ENOENT",
		);
	});

	it("reports signal exits", () => {
		const result = createResult({ status: null, signal: "SIGTERM" });
		expect(getExternalEditorError(result)).toBe("External editor terminated by signal SIGTERM");
	});

	it("reports null status without signal", () => {
		const result = createResult({ status: null, signal: null });
		expect(getExternalEditorError(result)).toBe("External editor exited with unknown status");
	});

	it("reports non-zero exits", () => {
		const result = createResult({ status: 2 });
		expect(getExternalEditorError(result)).toBe("External editor exited with code 2");
	});

	it("includes stderr details for non-zero exits when available", () => {
		const result = createResult({ status: 1, stderr: "permission denied\n" });
		expect(getExternalEditorError(result, { invokedCommand: "vim /tmp/editor.md" })).toBe(
			"External editor command 'vim /tmp/editor.md' exited with code 1: permission denied",
		);
	});

	it("returns undefined for successful exits", () => {
		const result = createResult({ status: 0 });
		expect(getExternalEditorError(result)).toBeUndefined();
	});
});
