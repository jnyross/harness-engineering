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
		const error = new Error("spawn gh ENOENT") as NodeJS.ErrnoException;
		error.code = "ENOENT";
		const result = createResult({ error, status: null });
		expect(getGhAuthStatusError(result)).toBe(GH_CLI_NOT_INSTALLED_MESSAGE);
	});

	it("returns interruption guidance when auth check exits by signal", () => {
		const result = createResult({ status: null, signal: "SIGTERM" });
		expect(getGhAuthStatusError(result)).toBe("GitHub CLI auth check was interrupted (SIGTERM). Try again.");
	});

	it("returns timeout guidance when auth check times out", () => {
		const error = new Error("spawnSync gh ETIMEDOUT") as NodeJS.ErrnoException;
		error.code = "ETIMEDOUT";
		const result = createResult({ status: null, error });
		expect(getGhAuthStatusError(result)).toBe("GitHub CLI auth check timed out. Try again.");
	});

	it("returns generic guidance for non-ENOENT spawn errors", () => {
		const error = new Error("spawnSync gh EACCES") as NodeJS.ErrnoException;
		error.code = "EACCES";
		const result = createResult({ status: null, error });
		expect(getGhAuthStatusError(result)).toBe("GitHub CLI auth check failed: spawnSync gh EACCES");
	});

	it("returns login guidance on non-zero auth status", () => {
		const result = createResult({ status: 1 });
		expect(getGhAuthStatusError(result)).toBe(GH_CLI_NOT_LOGGED_IN_MESSAGE);
	});

	it("returns unknown-status guidance for null status without signal", () => {
		const result = createResult({ status: null, signal: null });
		expect(getGhAuthStatusError(result)).toBe("GitHub CLI auth check exited with unknown status. Try again.");
	});

	it("returns undefined for successful auth status", () => {
		const result = createResult({ status: 0 });
		expect(getGhAuthStatusError(result)).toBeUndefined();
	});
});
