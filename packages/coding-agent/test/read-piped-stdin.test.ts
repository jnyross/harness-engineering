import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { readPipedStdin } from "../src/cli/read-piped-stdin.js";

function createInputStream(isTTY: boolean): NodeJS.ReadStream {
	const stream = new PassThrough();
	Object.defineProperty(stream, "isTTY", {
		value: isTTY,
		configurable: true,
	});
	return stream as unknown as NodeJS.ReadStream;
}

describe("readPipedStdin", () => {
	it("returns undefined when stdin is a TTY", async () => {
		const input = createInputStream(true);
		await expect(readPipedStdin(input)).resolves.toBeUndefined();
	});

	it("reads and trims piped stdin content", async () => {
		const input = createInputStream(false);
		const resultPromise = readPipedStdin(input);
		(input as unknown as PassThrough).end("  hello from pipe  \n");
		await expect(resultPromise).resolves.toBe("hello from pipe");
	});

	it("rejects when stdin emits an error", async () => {
		const input = createInputStream(false);
		const resultPromise = readPipedStdin(input);
		(input as unknown as PassThrough).emit("error", new Error("stdin failed"));
		await expect(resultPromise).rejects.toThrow("stdin failed");
	});

	it("resolves with collected data when stream closes before end", async () => {
		const input = createInputStream(false);
		const resultPromise = readPipedStdin(input);
		(input as unknown as PassThrough).write("  partial ");
		(input as unknown as PassThrough).emit("close");
		await expect(resultPromise).resolves.toBe("partial");
	});

	it("returns undefined when stream is already ended before reading", async () => {
		const input = createInputStream(false);
		(input as unknown as PassThrough).end();
		await expect(readPipedStdin(input)).resolves.toBeUndefined();
	});
});
