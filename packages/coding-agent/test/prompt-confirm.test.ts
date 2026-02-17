import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { promptConfirm } from "../src/cli/prompt-confirm.js";

function createPromptStreams() {
	const input = new PassThrough();
	const output = new PassThrough();
	return { input, output };
}

describe("promptConfirm", () => {
	it("returns true for yes answers", async () => {
		const { input, output } = createPromptStreams();
		const resultPromise = promptConfirm("Continue?", input, output);
		input.write("yes\n");
		await expect(resultPromise).resolves.toBe(true);
	});

	it("returns false for non-yes answers", async () => {
		const { input, output } = createPromptStreams();
		const resultPromise = promptConfirm("Continue?", input, output);
		input.write("nope\n");
		await expect(resultPromise).resolves.toBe(false);
	});

	it("returns false when input closes before answering", async () => {
		const { input, output } = createPromptStreams();
		const resultPromise = promptConfirm("Continue?", input, output);
		input.end();
		await expect(resultPromise).resolves.toBe(false);
	});
});
