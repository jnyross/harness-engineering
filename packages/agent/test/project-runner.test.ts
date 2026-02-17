import { describe, expect, it } from "vitest";
import { parseProjectRunnerArgs } from "../src/project-runner.js";

describe("parseProjectRunnerArgs", () => {
	it("parses iterations, max-tasks, provider and goal", () => {
		const parsed = parseProjectRunnerArgs([
			"--iterations",
			"3",
			"--max-tasks",
			"11",
			"--provider",
			"openai",
			"improve",
			"tests",
		]);
		expect(parsed).toEqual({
			goal: "improve tests",
			iterations: 3,
			maxTasks: 11,
			providerOverride: "openai",
		});
	});

	it("rejects missing and option-like flag values", () => {
		expect(() => parseProjectRunnerArgs(["--iterations"])).toThrow("--iterations requires a value");
		expect(() => parseProjectRunnerArgs(["--provider", "--max-tasks"])).toThrow("--provider requires a value");
		expect(() => parseProjectRunnerArgs(["--max-tasks", "-2"])).toThrow("--max-tasks requires a value");
	});
});
