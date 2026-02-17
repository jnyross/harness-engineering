import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Executor } from "../src/sandbox.js";
import { createBashTool } from "../src/tools/bash.js";

function createMockExecutor(
	execImpl: (command: string, timeout?: number) => Promise<{ stdout: string; stderr: string; code: number }>,
): Executor {
	return {
		exec: (command, options) => execImpl(command, options?.timeout),
		getWorkspacePath: (hostPath) => hostPath,
	};
}

describe("createBashTool timeout parsing", () => {
	it("forwards valid timeout values", async () => {
		let capturedTimeout: number | undefined;
		const executor = createMockExecutor(async (_command, timeout) => {
			capturedTimeout = timeout;
			return { stdout: "ok", stderr: "", code: 0 };
		});
		const tool = createBashTool(executor);

		const result = await tool.execute("tool-1", { label: "run", command: "echo ok", timeout: 1 }, undefined);
		assert.equal(capturedTimeout, 1);
		assert.equal(result.content[0]?.type, "text");
	});

	it("rejects non-positive timeout values", async () => {
		const executor = createMockExecutor(async () => ({ stdout: "", stderr: "", code: 0 }));
		const tool = createBashTool(executor);

		await assert.rejects(
			() => tool.execute("tool-2", { label: "run", command: "echo ok", timeout: 0 }, undefined),
			/Parameter 'timeout' must be a positive number of seconds\./,
		);
		await assert.rejects(
			() => tool.execute("tool-3", { label: "run", command: "echo ok", timeout: -5 }, undefined),
			/Parameter 'timeout' must be a positive number of seconds\./,
		);
		await assert.rejects(
			() => tool.execute("tool-4", { label: "run", command: "echo ok", timeout: 2_147_484 }, undefined),
			/Parameter 'timeout' must be a positive number of seconds\./,
		);
	});
});
