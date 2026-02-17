import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { buildDockerExecArgs, createExecutor, parseSandboxArg, validateSandbox } from "../src/sandbox.js";

const originalExit = process.exit;
const originalError = console.error;
const originalPath = process.env.PATH;

afterEach(() => {
	process.exit = originalExit;
	console.error = originalError;
	process.env.PATH = originalPath;
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

describe("buildDockerExecArgs", () => {
	it("builds argv docker exec invocation without shell interpolation", () => {
		assert.deepEqual(buildDockerExecArgs("mom-sandbox", "echo 'hello'; ls /workspace"), [
			"exec",
			"mom-sandbox",
			"sh",
			"-c",
			"echo 'hello'; ls /workspace",
		]);
	});
});

describe("validateSandbox", () => {
	it("exits gracefully when docker binary is unavailable", async () => {
		process.exit = ((code?: number) => {
			throw new Error(`EXIT:${code ?? 0}`);
		}) as typeof process.exit;
		console.error = () => {};
		process.env.PATH = "";

		await assert.rejects(() => validateSandbox({ type: "docker", container: "mom-sandbox" }), /EXIT:1/);
	});
});

describe("createExecutor", () => {
	it("rejects immediately for pre-aborted host execution signals", async () => {
		const markerPath = join(tmpdir(), `mom-host-exec-${Date.now()}.txt`);
		if (existsSync(markerPath)) {
			rmSync(markerPath);
		}

		const controller = new AbortController();
		controller.abort();

		const executor = createExecutor({ type: "host" });
		await assert.rejects(
			() =>
				executor.exec(
					`${process.execPath} -e "require('fs').writeFileSync(${JSON.stringify(markerPath)}, 'created')"`,
					{ signal: controller.signal },
				),
			/Command aborted/,
		);
		assert.equal(existsSync(markerPath), false);
	});

	it("returns non-zero exit code for signal-terminated host commands", async () => {
		const executor = createExecutor({ type: "host" });
		const result = await executor.exec("kill -TERM $$");
		assert.equal(result.code, 1);
	});
});
