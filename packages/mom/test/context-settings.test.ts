import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { MomSettingsManager } from "../src/context.js";

describe("MomSettingsManager settings normalization", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			if (existsSync(dir)) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	});

	it("falls back to defaults for malformed settings values", () => {
		const workspaceDir = join(tmpdir(), `mom-settings-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
		tempDirs.push(workspaceDir);
		mkdirSync(workspaceDir, { recursive: true });

		writeFileSync(
			join(workspaceDir, "settings.json"),
			JSON.stringify({
				defaultProvider: 123,
				defaultModel: false,
				defaultThinkingLevel: "ultra",
				compaction: { enabled: "yes", reserveTokens: -1, keepRecentTokens: Number.NaN },
				retry: { enabled: 1, maxRetries: 0, baseDelayMs: -10 },
			}),
		);

		const manager = new MomSettingsManager(workspaceDir);
		assert.equal(manager.getDefaultProvider(), undefined);
		assert.equal(manager.getDefaultModel(), undefined);
		assert.equal(manager.getDefaultThinkingLevel(), "off");
		assert.deepEqual(manager.getCompactionSettings(), {
			enabled: true,
			reserveTokens: 16384,
			keepRecentTokens: 20000,
		});
		assert.deepEqual(manager.getRetrySettings(), {
			enabled: true,
			maxRetries: 3,
			baseDelayMs: 2000,
		});
	});

	it("preserves valid settings values", () => {
		const workspaceDir = join(tmpdir(), `mom-settings-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
		tempDirs.push(workspaceDir);
		mkdirSync(workspaceDir, { recursive: true });

		writeFileSync(
			join(workspaceDir, "settings.json"),
			JSON.stringify({
				defaultProvider: " anthropic ",
				defaultModel: " claude-sonnet ",
				defaultThinkingLevel: "high",
				compaction: { enabled: false, reserveTokens: 12000, keepRecentTokens: 25000 },
				retry: { enabled: false, maxRetries: 5, baseDelayMs: 5000 },
			}),
		);

		const manager = new MomSettingsManager(workspaceDir);
		assert.equal(manager.getDefaultProvider(), "anthropic");
		assert.equal(manager.getDefaultModel(), "claude-sonnet");
		assert.equal(manager.getDefaultThinkingLevel(), "high");
		assert.deepEqual(manager.getCompactionSettings(), {
			enabled: false,
			reserveTokens: 12000,
			keepRecentTokens: 25000,
		});
		assert.deepEqual(manager.getRetrySettings(), {
			enabled: false,
			maxRetries: 5,
			baseDelayMs: 5000,
		});
	});

	it("normalizes invalid thinking level updates to off", () => {
		const workspaceDir = join(tmpdir(), `mom-settings-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
		tempDirs.push(workspaceDir);
		mkdirSync(workspaceDir, { recursive: true });

		const manager = new MomSettingsManager(workspaceDir);
		manager.setDefaultThinkingLevel("invalid-level");
		assert.equal(manager.getDefaultThinkingLevel(), "off");
	});
});
