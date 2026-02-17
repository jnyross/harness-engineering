import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getToolExtractionError } from "../src/utils/tool-extraction-status.js";

function createResult(overrides: Partial<SpawnSyncReturns<Buffer>>): SpawnSyncReturns<Buffer> {
	return {
		pid: 1,
		output: [Buffer.alloc(0), Buffer.alloc(0), Buffer.alloc(0)],
		stdout: Buffer.alloc(0),
		stderr: Buffer.alloc(0),
		status: 0,
		signal: null,
		error: undefined,
		...overrides,
	};
}

describe("getToolExtractionError", () => {
	it("returns undefined for successful extraction", () => {
		expect(
			getToolExtractionError(createResult({ status: 0 }), {
				archiveName: "fd-v10.0.0-x86_64-unknown-linux-musl.tar.gz",
			}),
		).toBeUndefined();
	});

	it("reports timed out extraction errors", () => {
		const error = new Error("spawnSync tar ETIMEDOUT") as NodeJS.ErrnoException;
		error.code = "ETIMEDOUT";
		expect(
			getToolExtractionError(createResult({ status: null, error }), {
				archiveName: "archive.tar.gz",
			}),
		).toBe("Failed to extract archive.tar.gz: extraction timed out");
	});

	it("reports signal-terminated extraction errors", () => {
		expect(
			getToolExtractionError(createResult({ status: null, signal: "SIGTERM" }), {
				archiveName: "archive.tar.gz",
			}),
		).toBe("Failed to extract archive.tar.gz: terminated by signal SIGTERM");
	});

	it("reports unknown null/null extraction exits", () => {
		expect(
			getToolExtractionError(createResult({ status: null, signal: null }), {
				archiveName: "archive.tar.gz",
			}),
		).toBe("Failed to extract archive.tar.gz: exited with unknown status");
	});

	it("reports non-zero extraction exits with stderr fallback", () => {
		expect(
			getToolExtractionError(createResult({ status: 2, stderr: Buffer.from("gzip: invalid header\n") }), {
				archiveName: "archive.tar.gz",
			}),
		).toBe("Failed to extract archive.tar.gz: gzip: invalid header");
	});
});
