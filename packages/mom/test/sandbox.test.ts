import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { parseSandboxArg } from "../src/sandbox.js";

const originalExit = process.exit;
const originalError = console.error;

afterEach(() => {
	process.exit = originalExit;
	console.error = originalError;
});

describe("parseSandboxArg", () => {
	it("accepts host sandbox", () => {
		assert.deepEqual(parseSandboxArg("host"), { type: "host" });
	});

	it("accepts valid docker container names", () => {
		assert.deepEqual(parseSandboxArg("docker:mom-sandbox"), { type: "docker", container: "mom-sandbox" });
		assert.deepEqual(parseSandboxArg("docker:mom_sandbox.v2"), { type: "docker", container: "mom_sandbox.v2" });
	});

	it("rejects invalid docker container names", () => {
		process.exit = ((code?: number) => {
			throw new Error(`EXIT:${code ?? 0}`);
		}) as typeof process.exit;
		console.error = () => {};

		assert.throws(() => parseSandboxArg("docker:mom sandbox"), /EXIT:1/);
		assert.throws(() => parseSandboxArg("docker:mom;sandbox"), /EXIT:1/);
		assert.throws(() => parseSandboxArg("docker:-sandbox"), /EXIT:1/);
	});
});
