import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getCommandPathFromLookup } from "../src/utils/shell-command-path.js";

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

describe("getCommandPathFromLookup", () => {
	it("returns first path from successful lookup output", () => {
		const result = createResult({ stdout: "/usr/bin/bash\n/bin/bash\n" });
		expect(getCommandPathFromLookup(result)).toBe("/usr/bin/bash");
	});

	it("returns undefined for spawn errors", () => {
		const result = createResult({ status: null, error: new Error("ENOENT") });
		expect(getCommandPathFromLookup(result)).toBeUndefined();
	});

	it("returns undefined for signal exits", () => {
		const result = createResult({ status: null, signal: "SIGTERM" });
		expect(getCommandPathFromLookup(result)).toBeUndefined();
	});

	it("returns undefined for non-zero exits", () => {
		const result = createResult({ status: 1, stderr: "not found" });
		expect(getCommandPathFromLookup(result)).toBeUndefined();
	});

	it("returns first candidate that passes optional validator", () => {
		const result = createResult({ stdout: "C:\\\\bad\\\\bash.exe\nC:\\\\good\\\\bash.exe\n" });
		expect(
			getCommandPathFromLookup(result, {
				validatePath: (candidate) => candidate === "C:\\\\good\\\\bash.exe",
			}),
		).toBe("C:\\\\good\\\\bash.exe");
	});
});
