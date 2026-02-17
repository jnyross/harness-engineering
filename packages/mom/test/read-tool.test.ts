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
	it("rejects malformed line-count output", async () => {
		const executor = createMockExecutor(async (command) => {
			if (command.startsWith("sed -n '$=' ")) {
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

	it("accepts valid line-count output and returns content", async () => {
		const executor = createMockExecutor(async (command) => {
			if (command.startsWith("sed -n '$=' ")) {
				return { stdout: "1\n", stderr: "", code: 0 };
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

	it("allows empty file reads when no offset is provided", async () => {
		const executor = createMockExecutor(async (command) => {
			if (command.startsWith("sed -n '$=' ")) {
				return { stdout: "", stderr: "", code: 0 };
			}
			if (command.startsWith("cat ")) {
				return { stdout: "", stderr: "", code: 0 };
			}
			return { stdout: "", stderr: `Unexpected command: ${command}`, code: 1 };
		});
		const tool = createReadTool(executor);

		const result = await tool.execute("tool-3", { label: "read", path: "empty.txt" }, undefined);
		assert.equal(result.content.length, 1);
		assert.equal(result.content[0]?.type, "text");
		if (result.content[0]?.type === "text") {
			assert.equal(result.content[0].text, "");
		}
	});

	it("rejects offset beyond exact line count", async () => {
		const executor = createMockExecutor(async (command) => {
			if (command.startsWith("sed -n '$=' ")) {
				return { stdout: "1\n", stderr: "", code: 0 };
			}
			if (command.startsWith("tail -n +")) {
				return { stdout: "", stderr: "", code: 0 };
			}
			return { stdout: "", stderr: `Unexpected command: ${command}`, code: 1 };
		});
		const tool = createReadTool(executor);

		await assert.rejects(
			() => tool.execute("tool-4", { label: "read", path: "single-line.txt", offset: 2 }, undefined),
			/Offset 2 is beyond end of file \(1 lines total\)/,
		);
	});
});
