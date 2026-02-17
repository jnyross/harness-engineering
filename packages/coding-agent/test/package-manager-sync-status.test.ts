import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getPackageManagerSyncCommandError } from "../src/core/package-manager-sync-status.js";

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

describe("getPackageManagerSyncCommandError", () => {
	it("returns undefined for successful exits", () => {
		expect(getPackageManagerSyncCommandError(createResult({ status: 0 }), { invokedCommand: "npm --version" })).toBe(
			undefined,
		);
	});

	it("reports startup failures", () => {
		expect(
			getPackageManagerSyncCommandError(createResult({ status: null, error: new Error("spawn ENOENT") }), {
				invokedCommand: "npm root -g",
			}),
		).toBe("Failed to start npm root -g: spawn ENOENT");
	});

	it("reports timeout startup failures", () => {
		const error = new Error("spawnSync npm ETIMEDOUT") as NodeJS.ErrnoException;
		error.code = "ETIMEDOUT";
		expect(
			getPackageManagerSyncCommandError(createResult({ status: null, error }), {
				invokedCommand: "npm root -g",
				timeoutMs: 5000,
			}),
		).toBe("npm root -g timed out after 5000ms");
	});

	it("reports signal exits", () => {
		expect(
			getPackageManagerSyncCommandError(createResult({ status: null, signal: "SIGTERM" }), {
				invokedCommand: "npm root -g",
			}),
		).toBe("npm root -g exited due to signal SIGTERM");
	});

	it("reports unknown null/null exits", () => {
		expect(
			getPackageManagerSyncCommandError(createResult({ status: null, signal: null }), {
				invokedCommand: "npm root -g",
			}),
		).toBe("npm root -g exited with unknown status");
	});

	it("reports non-zero exits with stderr details", () => {
		expect(
			getPackageManagerSyncCommandError(createResult({ status: 2, stderr: "permission denied\n" }), {
				invokedCommand: "npm root -g",
			}),
		).toBe("Failed to run npm root -g: permission denied\n");
	});
});
