import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertValidPodName, isValidPodName } from "../src/pod-name.js";

describe("pod name validation", () => {
	it("accepts valid pod names", () => {
		const valid = ["dc1", "runpod-prod", "pod_01", "a", "pod.name"];
		for (const podName of valid) {
			assert.equal(isValidPodName(podName), true);
			assert.doesNotThrow(() => assertValidPodName(podName));
		}
	});

	it("rejects invalid pod names", () => {
		const invalid = ["", "-starts-with-dash", "has space", "slash/name", "semi;colon"];
		for (const podName of invalid) {
			assert.equal(isValidPodName(podName), false);
			assert.throws(() => assertValidPodName(podName), /Invalid pod name/);
		}
	});
});
