import { describe, expect, it } from "vitest";
import { createFindTool } from "../src/core/tools/find.js";
import { createGrepTool } from "../src/core/tools/grep.js";
import { createLsTool } from "../src/core/tools/ls.js";

describe("tool numeric parameter safety", () => {
	it("rejects unsafe ls limit values", async () => {
		const tool = createLsTool("/workspace");
		await expect(tool.execute("ls-unsafe", { limit: 9007199254740992 }, undefined)).rejects.toThrow(
			"Parameter 'limit' must be a positive integer.",
		);
	});

	it("rejects unsafe find limit values", async () => {
		const tool = createFindTool("/workspace");
		await expect(
			tool.execute("find-unsafe", { pattern: "*.ts", limit: 9007199254740992 }, undefined),
		).rejects.toThrow("Parameter 'limit' must be a positive integer.");
	});

	it("rejects unsafe grep context and limit values", async () => {
		const tool = createGrepTool("/workspace");
		await expect(
			tool.execute("grep-unsafe-context", { pattern: "needle", path: ".", context: 9007199254740992 }, undefined),
		).rejects.toThrow("Parameter 'context' must be a non-negative integer.");
		await expect(
			tool.execute("grep-unsafe-limit", { pattern: "needle", path: ".", limit: 9007199254740992 }, undefined),
		).rejects.toThrow("Parameter 'limit' must be a positive integer.");
	});
});
