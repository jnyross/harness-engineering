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
});
