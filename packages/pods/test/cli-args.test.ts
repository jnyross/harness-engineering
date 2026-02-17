import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPodOverride, resolveAppCommand } from "../src/cli-args.js";

describe("resolveAppCommand", () => {
	it("falls back to pi for source entrypoints", () => {
		assert.equal(resolveAppCommand("/workspace/packages/pods/src/cli.ts"), "pi");
		assert.equal(resolveAppCommand("/workspace/packages/pods/dist/cli.js"), "pi");
	});

	it("uses invoked command basename for wrappers", () => {
		assert.equal(resolveAppCommand("/usr/local/bin/pi-pods"), "pi-pods");
		assert.equal(resolveAppCommand("/tmp/pi-custom"), "pi-custom");
	});
});

describe("extractPodOverride", () => {
	it("extracts --pod <name> values", () => {
		const parsed = extractPodOverride(["agent", "model-a", "--pod", "prod", "--json"], true);
		assert.equal(parsed.podOverride, "prod");
		assert.deepEqual(parsed.argsWithoutPod, ["agent", "model-a", "--json"]);
	});

	it("extracts --pod=<name> values", () => {
		const parsed = extractPodOverride(["agent", "model-a", "--pod=prod", "--json"], true);
		assert.equal(parsed.podOverride, "prod");
		assert.deepEqual(parsed.argsWithoutPod, ["agent", "model-a", "--json"]);
	});

	it("rejects --pod for commands that do not support overrides", () => {
		assert.throws(
			() => extractPodOverride(["shell", "--pod", "prod"], false),
			/Option --pod is only supported for model commands/,
		);
	});

	it("rejects missing --pod values", () => {
		assert.throws(() => extractPodOverride(["agent", "model-a", "--pod"], true), /requires a pod name/);
	});

	it("rejects option-like --pod values", () => {
		assert.throws(() => extractPodOverride(["agent", "model-a", "--pod", "-h"], true), /requires a pod name/);
	});

	it("rejects duplicate --pod flags", () => {
		assert.throws(
			() => extractPodOverride(["agent", "model-a", "--pod", "dev", "--pod=prod"], true),
			/may only be provided once/,
		);
	});

	it("stops parsing pod flags after -- terminator", () => {
		const parsed = extractPodOverride(["agent", "model-a", "--", "--pod", "prod"], true);
		assert.equal(parsed.podOverride, undefined);
		assert.deepEqual(parsed.argsWithoutPod, ["agent", "model-a", "--", "--pod", "prod"]);
	});
});
