import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadThemeFromPath } from "../src/modes/interactive/theme/theme.js";

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

describe("theme hex parsing", () => {
	it("rejects malformed hex color tokens that include invalid trailing characters", () => {
		withTempTheme(
			(theme) => {
				const colors = theme.colors as Record<string, unknown>;
				colors.accent = "#ff00f-";
			},
			(themePath) => {
				expect(() => loadThemeFromPath(themePath, "truecolor")).toThrow("Invalid hex color: #ff00f-");
			},
		);
	});
});
