import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
	GH_CLI_NOT_INSTALLED_MESSAGE,
	GH_CLI_NOT_LOGGED_IN_MESSAGE,
	getGhAuthStatusError,
} from "../src/modes/interactive/gh-auth-status.js";

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

describe("getGhAuthStatusError", () => {
	it("returns install guidance when gh cannot be spawned", () => {
		const result = createResult({ error: new Error("spawn gh ENOENT"), status: null });
		expect(getGhAuthStatusError(result)).toBe(GH_CLI_NOT_INSTALLED_MESSAGE);
	});

	it("returns interruption guidance when auth check exits by signal", () => {
		const result = createResult({ status: null, signal: "SIGTERM" });
		expect(getGhAuthStatusError(result)).toBe("GitHub CLI auth check was interrupted (SIGTERM). Try again.");
	});

	it("returns login guidance on non-zero auth status", () => {
		const result = createResult({ status: 1 });
		expect(getGhAuthStatusError(result)).toBe(GH_CLI_NOT_LOGGED_IN_MESSAGE);
	});

	it("returns undefined for successful auth status", () => {
		const result = createResult({ status: 0 });
		expect(getGhAuthStatusError(result)).toBeUndefined();
	});
});
