import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getTrashCommandErrorHint } from "../src/modes/interactive/trash-command-status.js";

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

describe("getTrashCommandErrorHint", () => {
	it("returns undefined for successful runs", () => {
		expect(getTrashCommandErrorHint(createResult({ status: 0 }))).toBeUndefined();
	});

	it("includes spawn error details", () => {
		const hint = getTrashCommandErrorHint(createResult({ status: null, error: new Error("ENOENT") }));
		expect(hint).toBe("trash: ENOENT");
	});

	it("includes timeout spawn errors", () => {
		const error = new Error("spawnSync trash ETIMEDOUT") as NodeJS.ErrnoException;
		error.code = "ETIMEDOUT";
		const hint = getTrashCommandErrorHint(createResult({ status: null, error }));
		expect(hint).toBe("trash: spawnSync trash ETIMEDOUT");
	});

	it("includes signal and first stderr line", () => {
		const hint = getTrashCommandErrorHint(
			createResult({
				status: null,
				signal: "SIGTERM",
				stderr: "permission denied\nsecond line",
			}),
		);
		expect(hint).toBe("trash: terminated by signal SIGTERM · permission denied");
	});

	it("includes non-zero exit code", () => {
		const hint = getTrashCommandErrorHint(createResult({ status: 2 }));
		expect(hint).toBe("trash: exited with code 2");
	});

	it("includes unknown-status hint for null/null exits", () => {
		const hint = getTrashCommandErrorHint(createResult({ status: null, signal: null, error: undefined }));
		expect(hint).toBe("trash: exited with unknown status");
	});
});
