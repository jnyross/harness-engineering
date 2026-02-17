import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertValidPid, assertValidPort, isValidPid, isValidPort } from "../src/process-identifiers.js";

describe("process identifier validation", () => {
	it("accepts valid pids and ports", () => {
		assert.equal(isValidPid(1), true);
		assert.equal(isValidPid(12345), true);
		assert.equal(isValidPort(1), true);
		assert.equal(isValidPort(65535), true);

		assert.doesNotThrow(() => assertValidPid(12345, "test"));
		assert.doesNotThrow(() => assertValidPort(8080, "test"));
	});

	it("rejects invalid pids", () => {
		for (const pid of [0, -1, 1.5, 3_000_000_000, 9_007_199_254_740_992]) {
			assert.equal(isValidPid(pid), false);
			assert.throws(() => assertValidPid(pid, "test"), /Invalid test pid/);
		}
	});

	it("rejects invalid ports", () => {
		for (const port of [0, -1, 65536, 8080.5, 9_007_199_254_740_992]) {
			assert.equal(isValidPort(port), false);
			assert.throws(() => assertValidPort(port, "test"), /Invalid test port/);
		}
	});
});
