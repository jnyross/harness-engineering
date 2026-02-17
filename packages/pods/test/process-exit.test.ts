import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";
import { waitForProcessExit } from "../src/process-exit.js";

describe("waitForProcessExit", () => {
	it("returns subprocess exit code", async () => {
		const child = spawn(process.execPath, ["-e", "process.exit(3)"], { stdio: "ignore" });
		const result = await waitForProcessExit(child);

		assert.equal(result.code, 3);
		assert.equal(result.error, undefined);
	});

	it("returns startup errors for missing binaries", async () => {
		const child = spawn("definitely-missing-binary-12345", [], { stdio: "ignore" });
		const result = await waitForProcessExit(child);

		assert.equal(result.code, 1);
		assert.ok(result.error instanceof Error);
	});

	it("captures signal when process is terminated", async () => {
		const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], { stdio: "ignore" });
		child.kill("SIGTERM");

		const result = await waitForProcessExit(child);
		assert.equal(result.code, 1);
		assert.equal(result.signal, "SIGTERM");
	});
});
