import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.js";

describe("KeybindingsManager config normalization", () => {
	const testDir = join(process.cwd(), "test-keybindings-tmp");

	beforeEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	it("falls back to defaults when keybindings file is not an object", () => {
		const keybindingsPath = join(testDir, "keybindings.json");
		writeFileSync(keybindingsPath, JSON.stringify(["ctrl+x"]));

		const manager = KeybindingsManager.create(testDir);
		expect(manager.getKeys("interrupt")).toEqual(["escape"]);
		expect(manager.getKeys("toggleThinking")).toEqual(["ctrl+t"]);
	});

	it("ignores malformed values while preserving valid keybinding overrides", () => {
		const keybindingsPath = join(testDir, "keybindings.json");
		writeFileSync(
			keybindingsPath,
			JSON.stringify({
				interrupt: 123,
				toggleThinking: ["", " ctrl+t ", null],
				exit: ["   "],
				newSession: [],
				unknownAction: "ctrl+x",
			}),
		);

		const manager = KeybindingsManager.create(testDir);
		expect(manager.getKeys("interrupt")).toEqual(["escape"]);
		expect(manager.getKeys("toggleThinking")).toEqual(["ctrl+t"]);
		expect(manager.getKeys("exit")).toEqual(["ctrl+d"]);
		expect(manager.getKeys("newSession")).toEqual([]);
	});
});
