import { describe, expect, it } from "vitest";
import { parseTasksFromPlanOutput } from "../src/project-loop.js";

describe("parseTasksFromPlanOutput", () => {
	it("ignores non-task wrapper headings before numbered tasks", () => {
		const tasks = parseTasksFromPlanOutput(`# Plan

### Task 1: Build parser
- handles quoted args

### Task 2: Add tests
- covers empty input
`);

		expect(tasks).toHaveLength(2);
		expect(tasks[0]).toEqual({
			title: "Build parser",
			description: undefined,
			acceptanceCriteria: ["handles quoted args"],
		});
		expect(tasks[1]).toEqual({
			title: "Add tests",
			description: undefined,
			acceptanceCriteria: ["covers empty input"],
		});
	});

	it("keeps non-section headings as tasks even without criteria", () => {
		const tasks = parseTasksFromPlanOutput(`### Implement auth flow`);

		expect(tasks).toHaveLength(1);
		expect(tasks[0]).toEqual({
			title: "Implement auth flow",
			description: undefined,
			acceptanceCriteria: [],
		});
	});

	it("normalizes malformed JSON task fields and filters non-task entries", () => {
		const tasks = parseTasksFromPlanOutput(`[
			{
				"title": "  Build parser  ",
				"description": "  Parse args safely  ",
				"acceptanceCriteria": [" handles quotes ", "", 1, "parses escapes"]
			},
			{
				"title": 123,
				"description": null,
				"acceptanceCriteria": "invalid"
			},
			"not-an-object"
		]`);

		expect(tasks).toEqual([
			{
				title: "Build parser",
				description: "Parse args safely",
				acceptanceCriteria: ["handles quotes", "parses escapes"],
			},
			{
				title: "Untitled",
				description: undefined,
				acceptanceCriteria: [],
			},
		]);
	});
});
