import { afterEach, describe, expect, it } from "vitest";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.js";

const originalColorFgbg = process.env.COLORFGBG;

afterEach(() => {
	process.env.COLORFGBG = originalColorFgbg;
});

describe("initTheme COLORFGBG auto-detection", () => {
	it("uses light theme for valid high background index", () => {
		process.env.COLORFGBG = "0;15";
		initTheme(undefined, false);
		expect(theme.name).toBe("light");
	});

	it("ignores unsafe integer background index and falls back to dark", () => {
		process.env.COLORFGBG = "0;9007199254740993";
		initTheme(undefined, false);
		expect(theme.name).toBe("dark");
	});

	it("ignores out-of-range background index and falls back to dark", () => {
		process.env.COLORFGBG = "0;999";
		initTheme(undefined, false);
		expect(theme.name).toBe("dark");
	});

	it("ignores whitespace-padded background index and falls back to dark", () => {
		process.env.COLORFGBG = "0; 15 ";
		initTheme(undefined, false);
		expect(theme.name).toBe("dark");
	});
});
