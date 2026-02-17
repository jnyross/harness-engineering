import { describe, expect, it } from "vitest";
import { createUpdateProgressTool } from "../src/core/tools/execution-plan.js";

function createOperations(initialContent: string) {
	let fileContent = initialContent;
	return {
		readFile: async () => fileContent,
		writeFile: async (_path: string, content: string) => {
			fileContent = content;
		},
		fileExists: async () => true,
		getContent: () => fileContent,
	};
}

describe("update_plan_progress tool", () => {
	it("rejects non-integer task indices", async () => {
		const operations = createOperations(
			["# Execution Plan", "", "*Created: 2026-01-01T00:00:00.000Z*", "", "- [ ] Task one", "- [ ] Task two"].join(
				"\n",
			),
		);
		const tool = createUpdateProgressTool("/workspace", { operations });

		await expect(tool.execute("tool-1", { task_index: 1.5, status: "completed" }, undefined)).rejects.toThrow(
			"Invalid task index: 1.5. Task index must be a non-negative integer.",
		);
	});

	it("rejects unsafe task indices", async () => {
		const operations = createOperations(
			["# Execution Plan", "", "*Created: 2026-01-01T00:00:00.000Z*", "", "- [ ] Task one", "- [ ] Task two"].join(
				"\n",
			),
		);
		const tool = createUpdateProgressTool("/workspace", { operations });

		await expect(
			tool.execute("tool-unsafe", { task_index: 9007199254740992, status: "completed" }, undefined),
		).rejects.toThrow("Invalid task index: 9007199254740992. Task index must be a non-negative integer.");
	});

	it("updates plan status for valid indices", async () => {
		const operations = createOperations(
			["# Execution Plan", "", "*Created: 2026-01-01T00:00:00.000Z*", "", "- [ ] Task one", "- [ ] Task two"].join(
				"\n",
			),
		);
		const tool = createUpdateProgressTool("/workspace", { operations });

		const result = await tool.execute("tool-2", { task_index: 1, status: "completed" }, undefined);
		expect(result.content[0]).toEqual({
			type: "text",
			text: 'Updated task 2 to "completed": Task two',
		});
		expect(operations.getContent()).toContain("[x] 2. Task two");
	});
});
