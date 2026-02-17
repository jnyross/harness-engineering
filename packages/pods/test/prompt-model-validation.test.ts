import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { promptModel } from "../src/commands/prompt.js";

const createdDirs: string[] = [];
const originalConfigDir = process.env.PI_CONFIG_DIR;
const originalApiKey = process.env.PI_API_KEY;
const originalPath = process.env.PATH;

function createConfigDir(config: object): string {
	const dir = mkdtempSync(join(tmpdir(), "pi-pods-prompt-validation-"));
	createdDirs.push(dir);
	writeFileSync(join(dir, "pods.json"), JSON.stringify(config, null, 2), "utf-8");
	return dir;
}

afterEach(() => {
	process.env.PI_CONFIG_DIR = originalConfigDir;
	process.env.PI_API_KEY = originalApiKey;
	process.env.PATH = originalPath;
	for (const dir of createdDirs.splice(0, createdDirs.length)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("promptModel validation", () => {
	it("rejects malformed SSH host config before delegation", async () => {
		const configDir = createConfigDir({
			active: "demo",
			pods: {
				demo: {
					ssh: "ssh -o StrictHostKeyChecking=no",
					gpus: [],
					models: {
						"demo-model": { model: "openai/gpt-oss-20b", port: 8001, pid: 1, gpu: [0] },
					},
				},
			},
		});
		process.env.PI_CONFIG_DIR = configDir;

		await assert.rejects(() => promptModel("demo-model", ["--list-models"]), /invalid ssh command/i);
	});

	it("rejects malformed model port before delegation", async () => {
		const configDir = createConfigDir({
			active: "demo",
			pods: {
				demo: {
					ssh: "ssh root@demo.host",
					gpus: [],
					models: {
						"demo-model": { model: "openai/gpt-oss-20b", port: "bad-port", pid: 1, gpu: [0] },
					},
				},
			},
		});
		process.env.PI_CONFIG_DIR = configDir;

		await assert.rejects(() => promptModel("demo-model", ["--list-models"]), /invalid port/i);
	});

	it("reports delegated agent startup failures clearly", async () => {
		const configDir = createConfigDir({
			active: "demo",
			pods: {
				demo: {
					ssh: "ssh root@demo.host",
					gpus: [],
					models: {
						"demo-model": { model: "openai/gpt-oss-20b", port: 8001, pid: 1, gpu: [0] },
					},
				},
			},
		});
		process.env.PI_CONFIG_DIR = configDir;
		process.env.PI_API_KEY = "test-key";
		process.env.PATH = "";

		await assert.rejects(() => promptModel("demo-model", ["--help"]), /Failed to start agent command 'npx'/i);
	});
});
