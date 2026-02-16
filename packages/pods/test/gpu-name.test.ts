import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractGpuType } from "../src/gpu-name.js";

describe("extractGpuType", () => {
	it("extracts first token after vendor prefix", () => {
		assert.equal(extractGpuType("NVIDIA H200 SXM5"), "H200");
		assert.equal(extractGpuType("AMD MI300X"), "MI300X");
	});

	it("handles missing/empty values safely", () => {
		assert.equal(extractGpuType(undefined), "");
		assert.equal(extractGpuType(""), "");
		assert.equal(extractGpuType("NVIDIA   "), "");
	});
});
