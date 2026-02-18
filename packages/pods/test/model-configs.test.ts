import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseModelsData } from "../src/model-configs.js";

describe("parseModelsData", () => {
	it("returns an empty model map for malformed JSON", () => {
		assert.deepEqual(parseModelsData("{"), { models: {} });
		assert.deepEqual(parseModelsData("[]"), { models: {} });
	});

	it("normalizes model entries, rejects whitespace-padded keys, and drops malformed configs", () => {
		const parsed = parseModelsData(
			JSON.stringify({
				models: {
					" model-a ": {
						name: " Should Drop Due To Whitespace Key ",
						configs: [{ gpuCount: 1, args: ["--bad"] }],
					},
					"model-a": {
						name: " Demo Model ",
						notes: " Notes ",
						configs: [
							{
								gpuCount: 1,
								args: [" --tensor-parallel-size ", "", "--dtype=bfloat16"],
								gpuTypes: ["H100", "", " H200 "],
								env: { CUDA_VISIBLE_DEVICES: "0", " BAD ": "1", BAD_VALUE: " 1 " },
								notes: " config-note ",
							},
							{ gpuCount: 0, args: ["--bad"] },
						],
					},
					"bad-model": {
						name: "Bad",
						configs: [{ gpuCount: 1, args: [1] }],
					},
				},
			}),
		);

		assert.deepEqual(parsed, {
			models: {
				"model-a": {
					name: "Demo Model",
					notes: "Notes",
					configs: [
						{
							gpuCount: 1,
							args: ["--tensor-parallel-size", "--dtype=bfloat16"],
							gpuTypes: ["H100", "H200"],
							env: { CUDA_VISIBLE_DEVICES: "0", BAD_VALUE: "1" },
							notes: "config-note",
						},
					],
				},
			},
		});
	});
});
