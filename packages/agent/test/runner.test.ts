import { describe, expect, it } from "vitest";
import { parseRunnerArgs } from "../src/runner.js";

describe("parseRunnerArgs", () => {
	it("joins all arguments into task description", () => {
		expect(parseRunnerArgs(["implement", "retry", "logic"])).toEqual({
			taskDescription: "implement retry logic",
		});
	});

	it("returns empty task description for blank args", () => {
		expect(parseRunnerArgs([])).toEqual({ taskDescription: "" });
		expect(parseRunnerArgs([" ", "   "])).toEqual({ taskDescription: "" });
	});
});
