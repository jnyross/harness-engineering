import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Executor } from "../src/sandbox.js";
import { createReadTool } from "../src/tools/read.js";

function createMockExecutor(
	execImpl: (command: string) => Promise<{ stdout: string; stderr: string; code: number }>,
): Executor {
	return {
		exec: (command) => execImpl(command),
		getWorkspacePath: (hostPath) => hostPath,
	};
}

describe("createReadTool line count parsing", () => {
	it("rejects malformed wc -l output", async () => {
		const executor = createMockExecutor(async (command) => {
			if (command.startsWith("wc -l <")) {
				return { stdout: "12oops\n", stderr: "", code: 0 };
			}
			return { stdout: "hello", stderr: "", code: 0 };
		});
		const tool = createReadTool(executor);

		await assert.rejects(
			() => tool.execute("tool-1", { label: "read", path: "file.txt" }, undefined),
			/Failed to parse line count for file 'file.txt': 12oops/,
		);
	});

	it("accepts valid wc -l output and returns content", async () => {
		const executor = createMockExecutor(async (command) => {
			if (command.startsWith("wc -l <")) {
				return { stdout: "0\n", stderr: "", code: 0 };
			}
			if (command.startsWith("cat ")) {
				return { stdout: "hello world\n", stderr: "", code: 0 };
			}
			return { stdout: "", stderr: `Unexpected command: ${command}`, code: 1 };
		});
		const tool = createReadTool(executor);

		const result = await tool.execute("tool-2", { label: "read", path: "file.txt" }, undefined);
		assert.equal(result.content.length, 1);
		assert.equal(result.content[0]?.type, "text");
		if (result.content[0]?.type === "text") {
			assert.match(result.content[0].text, /hello world/);
		}
	});
});
