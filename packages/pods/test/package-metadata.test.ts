import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePackageVersion } from "../src/package-metadata.js";

describe("parsePackageVersion", () => {
	it("returns version for valid package metadata", () => {
		assert.equal(parsePackageVersion(JSON.stringify({ version: "1.2.3" })), "1.2.3");
		assert.equal(parsePackageVersion(JSON.stringify({ version: " 2.0.0 " })), "2.0.0");
	});

	it("returns fallback for malformed package metadata", () => {
		assert.equal(parsePackageVersion("{"), "unknown");
		assert.equal(parsePackageVersion("[]"), "unknown");
		assert.equal(parsePackageVersion(JSON.stringify({ version: "" })), "unknown");
		assert.equal(parsePackageVersion(JSON.stringify({ version: 123 })), "unknown");
		assert.equal(parsePackageVersion("{}", "0.0.0"), "0.0.0");
	});
});
