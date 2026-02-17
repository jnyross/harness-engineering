import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGpuQueryOutput } from "../src/commands/pods.js";

describe("parseGpuQueryOutput", () => {
	it("parses valid nvidia-smi CSV lines", () => {
		const parsed = parseGpuQueryOutput("0, NVIDIA H100, 81559 MiB\n1, NVIDIA H100, 81559 MiB\n");

		assert.deepEqual(parsed.gpus, [
			{ id: 0, name: "NVIDIA H100", memory: "81559 MiB" },
			{ id: 1, name: "NVIDIA H100", memory: "81559 MiB" },
		]);
		assert.deepEqual(parsed.skippedLines, []);
	});

	it("skips malformed GPU lines and continues parsing valid ones", () => {
		const parsed = parseGpuQueryOutput("abc, NVIDIA H100, 81559 MiB\n2, NVIDIA H200, 141312 MiB\n, no id\n");

		assert.deepEqual(parsed.gpus, [{ id: 2, name: "NVIDIA H200", memory: "141312 MiB" }]);
		assert.deepEqual(parsed.skippedLines, ["abc, NVIDIA H100, 81559 MiB", ", no id"]);
	});

	it("parses gpu names that contain commas", () => {
		const parsed = parseGpuQueryOutput("0, NVIDIA RTX, 6000 Ada Generation, 49140 MiB\n");
		assert.deepEqual(parsed.gpus, [{ id: 0, name: "NVIDIA RTX, 6000 Ada Generation", memory: "49140 MiB" }]);
		assert.deepEqual(parsed.skippedLines, []);
	});

	it("parses memory fields that contain thousands separators", () => {
		const parsed = parseGpuQueryOutput("0, NVIDIA H100, 80,000 MiB\n");
		assert.deepEqual(parsed.gpus, [{ id: 0, name: "NVIDIA H100", memory: "80,000 MiB" }]);
		assert.deepEqual(parsed.skippedLines, []);
	});

	it("rejects unsafe integer gpu ids", () => {
		const parsed = parseGpuQueryOutput("9007199254740993, NVIDIA H100, 81559 MiB\n");
		assert.deepEqual(parsed.gpus, []);
		assert.deepEqual(parsed.skippedLines, ["9007199254740993, NVIDIA H100, 81559 MiB"]);
	});
});
