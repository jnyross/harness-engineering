import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { getThemeExportColors, loadThemeFromPath, setRegisteredThemes } from "../src/modes/interactive/theme/theme.js";

function withTempTheme(mutator: (theme: Record<string, unknown>) => void, run: (themePath: string) => void): void {
	const tempDir = mkdtempSync(join(tmpdir(), "coding-agent-theme-"));
	try {
		const currentDir = dirname(fileURLToPath(import.meta.url));
		const darkThemePath = join(currentDir, "../src/modes/interactive/theme/dark.json");
		const theme = JSON.parse(readFileSync(darkThemePath, "utf-8")) as Record<string, unknown>;
		mutator(theme);
		const tempThemePath = join(tempDir, "theme.json");
		writeFileSync(tempThemePath, JSON.stringify(theme), "utf-8");
		run(tempThemePath);
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
}

afterEach(() => {
	setRegisteredThemes([]);
});

describe("getThemeExportColors", () => {
	it("resolves export color variable references with or without dollar prefix", () => {
		withTempTheme(
			(theme) => {
				theme.name = "export-var-test-theme";
				theme.vars = {
					...(theme.vars as Record<string, unknown>),
					pageColor: "#112233",
					cardIndex: 242,
					nested: "pageColor",
				};
				theme.export = {
					pageBg: "pageColor",
					cardBg: "$cardIndex",
					infoBg: "nested",
				};
			},
			(themePath) => {
				setRegisteredThemes([loadThemeFromPath(themePath)]);
				expect(getThemeExportColors("export-var-test-theme")).toEqual({
					pageBg: "#112233",
					cardBg: "#6c6c6c",
					infoBg: "#112233",
				});
			},
		);
	});

	it("returns undefined for missing dollar-prefixed export variables", () => {
		withTempTheme(
			(theme) => {
				theme.name = "export-missing-var-theme";
				theme.export = {
					pageBg: "$missingVar",
					cardBg: "#112233",
				};
			},
			(themePath) => {
				setRegisteredThemes([loadThemeFromPath(themePath)]);
				expect(getThemeExportColors("export-missing-var-theme")).toEqual({
					pageBg: undefined,
					cardBg: "#112233",
					infoBg: undefined,
				});
			},
		);
	});

	it("returns undefined for missing plain export variable references", () => {
		withTempTheme(
			(theme) => {
				theme.name = "export-missing-plain-var-theme";
				theme.export = {
					pageBg: "missingPlainVar",
					cardBg: "#112233",
				};
			},
			(themePath) => {
				setRegisteredThemes([loadThemeFromPath(themePath)]);
				expect(getThemeExportColors("export-missing-plain-var-theme")).toEqual({
					pageBg: undefined,
					cardBg: "#112233",
					infoBg: undefined,
				});
			},
		);
	});

	it("returns undefined for malformed export hex values", () => {
		withTempTheme(
			(theme) => {
				theme.name = "export-bad-hex-theme";
				theme.vars = {
					...(theme.vars as Record<string, unknown>),
					badHex: "#ff00f-",
				};
				theme.export = {
					pageBg: "#ff00f-",
					cardBg: "badHex",
					infoBg: "#112233",
				};
			},
			(themePath) => {
				setRegisteredThemes([loadThemeFromPath(themePath)]);
				expect(getThemeExportColors("export-bad-hex-theme")).toEqual({
					pageBg: undefined,
					cardBg: undefined,
					infoBg: "#112233",
				});
			},
		);
	});
});
