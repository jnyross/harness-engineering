import { PassThrough } from "node:stream";
import { createInterface } from "readline";
import { describe, expect, it } from "vitest";
import { promptWithCloseFallback } from "../src/utils/readline-prompt.js";

describe("promptWithCloseFallback", () => {
	it("resolves with provided answer", async () => {
		const input = new PassThrough();
		const output = new PassThrough();
		const rl = createInterface({ input, output });

		const resultPromise = promptWithCloseFallback(rl, "question? ");
		input.write("answer\n");

		await expect(resultPromise).resolves.toBe("answer");
		rl.close();
	});

	it("resolves with fallback when interface closes before answer", async () => {
		const input = new PassThrough();
		const output = new PassThrough();
		const rl = createInterface({ input, output });

		const resultPromise = promptWithCloseFallback(rl, "question? ", "fallback");
		rl.close();

		await expect(resultPromise).resolves.toBe("fallback");
	});

	it("does not override answered value after close", async () => {
		const input = new PassThrough();
		const output = new PassThrough();
		const rl = createInterface({ input, output });

		const resultPromise = promptWithCloseFallback(rl, "question? ", "fallback");
		input.write("yes\n");

		await expect(resultPromise).resolves.toBe("yes");
		rl.close();
	});
});
