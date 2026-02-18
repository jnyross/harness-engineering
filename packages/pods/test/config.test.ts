import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { getActivePod, loadConfig } from "../src/config.js";

describe("pods config normalization", () => {
	const configDir = join(process.cwd(), "test-pods-config-tmp");
	const configPath = join(configDir, "pods.json");
	const previousConfigDir = process.env.PI_CONFIG_DIR;

	beforeEach(() => {
		if (existsSync(configDir)) {
			rmSync(configDir, { recursive: true, force: true });
		}
		mkdirSync(configDir, { recursive: true });
		process.env.PI_CONFIG_DIR = configDir;
	});

	afterEach(() => {
		if (previousConfigDir === undefined) {
			delete process.env.PI_CONFIG_DIR;
		} else {
			process.env.PI_CONFIG_DIR = previousConfigDir;
		}
		if (existsSync(configDir)) {
			rmSync(configDir, { recursive: true, force: true });
		}
	});

	it("returns empty config when parsed root shape is invalid", () => {
		writeFileSync(configPath, JSON.stringify(["not-an-object"]));
		assert.deepEqual(loadConfig(), { pods: {} });
		assert.equal(getActivePod(), null);
	});

	it("normalizes pod/model/gpu entries while rejecting whitespace-padded key names", () => {
		writeFileSync(
			configPath,
			JSON.stringify({
				pods: {
					" good-pod ": {
						ssh: " ssh host ",
						gpus: [
							{ id: 0, name: "GPU 0", memory: "80GiB" },
							{ id: "bad", name: "GPU 1", memory: "80GiB" },
						],
						models: {
							" model-a ": { model: "llama", port: 8001, gpu: [0], pid: 1234 },
							"model-b": { model: "bad", port: 8002, gpu: [], pid: 5678 },
							"model-c": { model: " llama ", port: 8003, gpu: [0], pid: 9012 },
						},
						modelsPath: " /models ",
						vllmVersion: "release",
					},
					"good-pod": {
						ssh: "ssh host",
						gpus: [
							{ id: 0, name: "GPU 0", memory: "80GiB" },
							{ id: 1, name: " GPU 1 ", memory: "80GiB" },
							{ id: 2, name: "GPU 2", memory: " 80GiB " },
						],
						models: {
							" model-a ": { model: "llama", port: 8001, gpu: [0], pid: 1234 },
							"model-a": { model: "llama", port: 8001, gpu: [0], pid: 1234 },
						},
						modelsPath: " /models ",
						vllmVersion: "release",
					},
					"ssh-padded": {
						ssh: " ssh host ",
						gpus: [{ id: 1, name: "GPU 1", memory: "80GiB" }],
						models: {},
					},
					"bad-pod": {
						ssh: 123,
						gpus: [],
						models: {},
					},
				},
				active: "good-pod",
			}),
		);

		const config = loadConfig();
		assert.deepEqual(Object.keys(config.pods), ["good-pod"]);
		assert.equal(config.pods["good-pod"]?.ssh, "ssh host");
		assert.deepEqual(config.pods["good-pod"]?.gpus, [{ id: 0, name: "GPU 0", memory: "80GiB" }]);
		assert.deepEqual(config.pods["good-pod"]?.models, {
			"model-a": { model: "llama", port: 8001, gpu: [0], pid: 1234 },
		});
		assert.equal(config.pods["good-pod"]?.modelsPath, undefined);
		assert.equal(config.pods["good-pod"]?.vllmVersion, "release");
		assert.equal(config.active, "good-pod");
		assert.deepEqual(getActivePod(), { name: "good-pod", pod: config.pods["good-pod"]! });
	});

	it("drops active pod when active key has surrounding whitespace", () => {
		writeFileSync(
			configPath,
			JSON.stringify({
				pods: {
					valid: {
						ssh: "ssh host",
						gpus: [{ id: 0, name: "GPU", memory: "80GiB" }],
						models: {},
					},
				},
				active: " valid ",
			}),
		);

		const config = loadConfig();
		assert.equal(config.active, undefined);
		assert.equal(getActivePod(), null);
	});

	it("drops active pod when referenced pod is invalid", () => {
		writeFileSync(
			configPath,
			JSON.stringify({
				pods: {
					valid: {
						ssh: "ssh host",
						gpus: [{ id: 0, name: "GPU", memory: "80GiB" }],
						models: {},
					},
				},
				active: "missing",
			}),
		);

		const config = loadConfig();
		assert.equal(config.active, undefined);
		assert.equal(getActivePod(), null);
	});
});
