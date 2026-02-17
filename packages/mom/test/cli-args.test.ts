import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolve } from "path";
import { parseCliArgs } from "../src/cli-args.js";

describe("parseCliArgs", () => {
	it("parses working directory and default sandbox", () => {
		const parsed = parseCliArgs(["./workspace"]);
		assert.equal(parsed.workingDir, resolve("./workspace"));
		assert.deepEqual(parsed.sandbox, { type: "host" });
		assert.equal(parsed.downloadChannel, undefined);
	});

	it("parses sandbox and download options", () => {
		const parsed = parseCliArgs(["--sandbox=docker:test", "--download", "C12345"]);
		assert.deepEqual(parsed.sandbox, { type: "docker", container: "test" });
		assert.equal(parsed.downloadChannel, "C12345");
	});

	it("rejects missing sandbox value", () => {
		assert.throws(() => parseCliArgs(["--sandbox"]), /Option --sandbox requires a value\./);
	});

	it("rejects missing download value", () => {
		assert.throws(() => parseCliArgs(["--download"]), /Option --download requires a value\./);
	});

	it("rejects option-like token as option value", () => {
		assert.throws(() => parseCliArgs(["--download", "--sandbox=host"]), /Option --download requires a value\./);
	});

	it("rejects single-dash option-like token as option value", () => {
		assert.throws(() => parseCliArgs(["--sandbox", "-h"]), /Option --sandbox requires a value\./);
	});
});
