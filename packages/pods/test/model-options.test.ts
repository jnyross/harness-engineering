import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeContextOption, normalizeMemoryOption } from "../src/model-options.js";

describe("normalizeMemoryOption", () => {
	it("normalizes valid percent values", () => {
		assert.equal(normalizeMemoryOption("50"), "50%");
		assert.equal(normalizeMemoryOption("50%"), "50%");
		assert.equal(normalizeMemoryOption(" 12.5% "), "12.5%");
	});

	it("rejects invalid percent values", () => {
		assert.throws(() => normalizeMemoryOption("0"), /Invalid --memory value/);
		assert.throws(() => normalizeMemoryOption("101"), /Invalid --memory value/);
		assert.throws(() => normalizeMemoryOption("abc"), /Invalid --memory value/);
	});
});

describe("normalizeContextOption", () => {
	it("accepts known context aliases", () => {
		assert.equal(normalizeContextOption("4k"), "4k");
		assert.equal(normalizeContextOption("64K"), "64k");
	});

	it("accepts numeric token counts", () => {
		assert.equal(normalizeContextOption("32768"), "32768");
		assert.equal(normalizeContextOption(" 4096 "), "4096");
	});

	it("rejects invalid context values", () => {
		assert.throws(() => normalizeContextOption("0"), /Invalid --context value/);
		assert.throws(() => normalizeContextOption("-1"), /Invalid --context value/);
		assert.throws(() => normalizeContextOption("none"), /Invalid --context value/);
	});
});
