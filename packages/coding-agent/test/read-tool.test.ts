import { describe, expect, it } from "vitest";
import type { ReadOperations } from "../src/core/tools/read.js";
import { createReadTool } from "../src/core/tools/read.js";

function createTextReadTool(text: string) {
	const operations: ReadOperations = {
		access: async () => {},
		readFile: async () => Buffer.from(text, "utf-8"),
		detectImageMimeType: async () => null,
	};
	return createReadTool("/workspace", { operations, autoResizeImages: false });
}

describe("createReadTool text line counting", () => {
	it("rejects offsets beyond one-line files ending with trailing newline", async () => {
		const tool = createTextReadTool("hello\n");
		await expect(tool.execute("tool-1", { path: "demo.txt", offset: 2 }, undefined)).rejects.toThrow(
			"Offset 2 is beyond end of file (1 lines total)",
		);
	});

	it("allows empty file reads when no offset is specified", async () => {
		const tool = createTextReadTool("");
		const result = await tool.execute("tool-2", { path: "empty.txt" }, undefined);
		expect(result.content).toEqual([{ type: "text", text: "" }]);
	});

	it("rejects offset reads on empty files", async () => {
		const tool = createTextReadTool("");
		await expect(tool.execute("tool-3", { path: "empty.txt", offset: 1 }, undefined)).rejects.toThrow(
			"Offset 1 is beyond end of file (0 lines total)",
		);
	});

	it("rejects non-positive and non-integer offset/limit values", async () => {
		const tool = createTextReadTool("line one\nline two");
		await expect(tool.execute("tool-4", { path: "demo.txt", offset: 0 }, undefined)).rejects.toThrow(
			"Parameter 'offset' must be a positive integer.",
		);
		await expect(tool.execute("tool-5", { path: "demo.txt", offset: 1.2 }, undefined)).rejects.toThrow(
			"Parameter 'offset' must be a positive integer.",
		);
		await expect(tool.execute("tool-6", { path: "demo.txt", limit: 0 }, undefined)).rejects.toThrow(
			"Parameter 'limit' must be a positive integer.",
		);
		await expect(tool.execute("tool-7", { path: "demo.txt", offset: 9007199254740992 }, undefined)).rejects.toThrow(
			"Parameter 'offset' must be a positive integer.",
		);
		await expect(tool.execute("tool-8", { path: "demo.txt", limit: 9007199254740992 }, undefined)).rejects.toThrow(
			"Parameter 'limit' must be a positive integer.",
		);
	});
});
