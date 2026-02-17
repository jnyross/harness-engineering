import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsManager } from "../src/core/settings-manager.js";

describe("SettingsManager", () => {
	const testDir = join(process.cwd(), "test-settings-tmp");
	const agentDir = join(testDir, "agent");
	const projectDir = join(testDir, "project");

	beforeEach(() => {
		// Clean up and create fresh directories
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	describe("preserves externally added settings", () => {
		it("should preserve enabledModels when changing thinking level", () => {
			// Create initial settings file
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					theme: "dark",
					defaultModel: "claude-sonnet",
				}),
			);

			// Create SettingsManager (simulates pi starting up)
			const manager = SettingsManager.create(projectDir, agentDir);

			// Simulate user editing settings.json externally to add enabledModels
			const currentSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			currentSettings.enabledModels = ["claude-opus-4-5", "gpt-5.2-codex"];
			writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));

			// User changes thinking level via Shift+Tab
			manager.setDefaultThinkingLevel("high");

			// Verify enabledModels is preserved
			const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			expect(savedSettings.enabledModels).toEqual(["claude-opus-4-5", "gpt-5.2-codex"]);
			expect(savedSettings.defaultThinkingLevel).toBe("high");
			expect(savedSettings.theme).toBe("dark");
			expect(savedSettings.defaultModel).toBe("claude-sonnet");
		});

		it("should preserve custom settings when changing theme", () => {
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					defaultModel: "claude-sonnet",
				}),
			);

			const manager = SettingsManager.create(projectDir, agentDir);

			// User adds custom settings externally
			const currentSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			currentSettings.shellPath = "/bin/zsh";
			currentSettings.extensions = ["/path/to/extension.ts"];
			writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));

			// User changes theme
			manager.setTheme("light");

			// Verify all settings preserved
			const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			expect(savedSettings.shellPath).toBe("/bin/zsh");
			expect(savedSettings.extensions).toEqual(["/path/to/extension.ts"]);
			expect(savedSettings.theme).toBe("light");
		});

		it("should let in-memory changes override file changes for same key", () => {
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					theme: "dark",
				}),
			);

			const manager = SettingsManager.create(projectDir, agentDir);

			// User externally sets thinking level to "low"
			const currentSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			currentSettings.defaultThinkingLevel = "low";
			writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));

			// But then changes it via UI to "high"
			manager.setDefaultThinkingLevel("high");

			// In-memory change should win
			const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			expect(savedSettings.defaultThinkingLevel).toBe("high");
		});
	});

	describe("packages migration", () => {
		it("should keep local-only extensions in extensions array", () => {
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					extensions: ["/local/ext.ts", "./relative/ext.ts"],
				}),
			);

			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getPackages()).toEqual([]);
			expect(manager.getExtensionPaths()).toEqual(["/local/ext.ts", "./relative/ext.ts"]);
		});

		it("should handle packages with filtering objects", () => {
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					packages: [
						"npm:simple-pkg",
						{
							source: "npm:shitty-extensions",
							extensions: ["extensions/oracle.ts"],
							skills: [],
						},
					],
				}),
			);

			const manager = SettingsManager.create(projectDir, agentDir);

			const packages = manager.getPackages();
			expect(packages).toHaveLength(2);
			expect(packages[0]).toBe("npm:simple-pkg");
			expect(packages[1]).toEqual({
				source: "npm:shitty-extensions",
				extensions: ["extensions/oracle.ts"],
				skills: [],
			});
		});
	});

	describe("reload", () => {
		it("should reload global settings from disk", () => {
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					theme: "dark",
					extensions: ["/before.ts"],
				}),
			);

			const manager = SettingsManager.create(projectDir, agentDir);

			writeFileSync(
				settingsPath,
				JSON.stringify({
					theme: "light",
					extensions: ["/after.ts"],
					defaultModel: "claude-sonnet",
				}),
			);

			manager.reload();

			expect(manager.getTheme()).toBe("light");
			expect(manager.getExtensionPaths()).toEqual(["/after.ts"]);
			expect(manager.getDefaultModel()).toBe("claude-sonnet");
		});

		it("should keep previous settings when file is invalid", () => {
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ theme: "dark" }));

			const manager = SettingsManager.create(projectDir, agentDir);

			writeFileSync(settingsPath, "{ invalid json");
			manager.reload();

			expect(manager.getTheme()).toBe("dark");
		});
	});

	describe("shellCommandPrefix", () => {
		it("should load shellCommandPrefix from settings", () => {
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ shellCommandPrefix: "shopt -s expand_aliases" }));

			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getShellCommandPrefix()).toBe("shopt -s expand_aliases");
		});

		it("should return undefined when shellCommandPrefix is not set", () => {
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ theme: "dark" }));

			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getShellCommandPrefix()).toBeUndefined();
		});

		it("should preserve shellCommandPrefix when saving unrelated settings", () => {
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ shellCommandPrefix: "shopt -s expand_aliases" }));

			const manager = SettingsManager.create(projectDir, agentDir);
			manager.setTheme("light");

			const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			expect(savedSettings.shellCommandPrefix).toBe("shopt -s expand_aliases");
			expect(savedSettings.theme).toBe("light");
		});
	});

	describe("retry settings normalization", () => {
		it("falls back to defaults for invalid retry values", () => {
			const manager = SettingsManager.inMemory({
				retry: {
					enabled: true,
					maxRetries: -1,
					baseDelayMs: Number.NaN,
					maxDelayMs: 0,
				},
			});

			expect(manager.getRetrySettings()).toEqual({
				enabled: true,
				maxRetries: 3,
				baseDelayMs: 2000,
				maxDelayMs: 60000,
			});
		});

		it("clamps oversized retry delays and preserves valid retry counts", () => {
			const manager = SettingsManager.inMemory({
				retry: {
					enabled: true,
					maxRetries: 7,
					baseDelayMs: Number.POSITIVE_INFINITY,
					maxDelayMs: Number.MAX_SAFE_INTEGER,
				},
			});

			expect(manager.getRetrySettings()).toEqual({
				enabled: true,
				maxRetries: 7,
				baseDelayMs: 2_147_483_647,
				maxDelayMs: 2_147_483_647,
			});
		});
	});

	describe("editor numeric settings normalization", () => {
		it("clamps oversized values to supported ranges", () => {
			const manager = SettingsManager.inMemory({
				editorPaddingX: 99,
				autocompleteMaxVisible: 999,
			});

			expect(manager.getEditorPaddingX()).toBe(3);
			expect(manager.getAutocompleteMaxVisible()).toBe(20);
		});

		it("normalizes decimals and negative values consistently", () => {
			const manager = SettingsManager.inMemory({
				editorPaddingX: -1.2,
				autocompleteMaxVisible: 2.8,
			});

			expect(manager.getEditorPaddingX()).toBe(0);
			expect(manager.getAutocompleteMaxVisible()).toBe(3);
		});

		it("falls back to defaults for malformed non-finite values", () => {
			const manager = SettingsManager.inMemory({
				editorPaddingX: Number.POSITIVE_INFINITY,
				autocompleteMaxVisible: Number.NaN,
			});

			expect(manager.getEditorPaddingX()).toBe(0);
			expect(manager.getAutocompleteMaxVisible()).toBe(5);
		});

		it("normalizes malformed non-finite values passed through setters", () => {
			const manager = SettingsManager.inMemory();

			manager.setEditorPaddingX(Number.NaN);
			manager.setAutocompleteMaxVisible(Number.NaN);

			expect(manager.getEditorPaddingX()).toBe(0);
			expect(manager.getAutocompleteMaxVisible()).toBe(5);
		});
	});

	describe("token budget settings normalization", () => {
		it("falls back to defaults for invalid compaction and branch summary token settings", () => {
			const manager = SettingsManager.inMemory({
				compaction: {
					reserveTokens: -1,
					keepRecentTokens: Number.NaN,
				},
				branchSummary: {
					reserveTokens: 0,
				},
			});

			expect(manager.getCompactionReserveTokens()).toBe(16384);
			expect(manager.getCompactionKeepRecentTokens()).toBe(20000);
			expect(manager.getBranchSummarySettings()).toEqual({ reserveTokens: 16384 });
		});

		it("preserves valid positive safe integer token settings", () => {
			const manager = SettingsManager.inMemory({
				compaction: {
					reserveTokens: 12000,
					keepRecentTokens: 25000,
				},
				branchSummary: {
					reserveTokens: 9000,
				},
			});

			expect(manager.getCompactionReserveTokens()).toBe(12000);
			expect(manager.getCompactionKeepRecentTokens()).toBe(25000);
			expect(manager.getBranchSummarySettings()).toEqual({ reserveTokens: 9000 });
		});
	});

	describe("thinking budget settings normalization", () => {
		it("drops malformed thinking budget values from settings", () => {
			const manager = SettingsManager.inMemory({
				thinkingBudgets: {
					minimal: Number.NaN,
					low: -1,
					medium: Number.POSITIVE_INFINITY,
					high: Number.MAX_SAFE_INTEGER + 1,
				},
			});

			expect(manager.getThinkingBudgets()).toBeUndefined();
		});

		it("preserves valid non-negative safe integer thinking budget values", () => {
			const manager = SettingsManager.inMemory({
				thinkingBudgets: {
					minimal: 0,
					low: 1024,
					medium: 2048,
					high: 4096,
				},
			});

			expect(manager.getThinkingBudgets()).toEqual({
				minimal: 0,
				low: 1024,
				medium: 2048,
				high: 4096,
			});
		});
	});
});
