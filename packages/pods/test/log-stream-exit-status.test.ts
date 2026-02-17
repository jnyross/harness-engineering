import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLogStreamExitError } from "../src/log-stream-exit-status.js";

describe("getLogStreamExitError", () => {
	it("ignores interrupted streams", () => {
		assert.equal(
			getLogStreamExitError({
				processLabel: "model log stream",
				interrupted: true,
				result: { code: 1, signal: "SIGTERM" },
			}),
			undefined,
		);
	});

	it("reports explicit stream spawn/runtime errors", () => {
		assert.equal(
			getLogStreamExitError({
				processLabel: "startup log stream",
				interrupted: false,
				result: { code: 1, error: new Error("spawn ssh ENOENT") },
			}),
			"Failed to stream startup log stream: spawn ssh ENOENT",
		);
	});

	it("returns undefined for successful exits", () => {
		assert.equal(
			getLogStreamExitError({
				processLabel: "model log stream",
				interrupted: false,
				result: { code: 0 },
			}),
			undefined,
		);
	});

	it("reports signal-terminated streams", () => {
		assert.equal(
			getLogStreamExitError({
				processLabel: "startup log stream",
				interrupted: false,
				result: { code: 1, signal: "SIGTERM" },
			}),
			"startup log stream process terminated by signal SIGTERM",
		);
	});

	it("reports non-zero code streams without signals", () => {
		assert.equal(
			getLogStreamExitError({
				processLabel: "model log stream",
				interrupted: false,
				result: { code: 255, signal: null },
			}),
			"model log stream process exited with code 255",
		);
	});
});
