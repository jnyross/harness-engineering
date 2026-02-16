import { describe, expect, test } from "vitest";
import { clearConfigValueCache, resolveConfigValue, resolveHeaders } from "../src/core/resolve-config-value.js";

describe("resolveConfigValue", () => {
	test("returns undefined for blank shell commands", () => {
		clearConfigValueCache();
		expect(resolveConfigValue("!")).toBeUndefined();
		expect(resolveConfigValue("!    ")).toBeUndefined();
	});

	test("resolves trimmed shell commands", () => {
		clearConfigValueCache();
		expect(resolveConfigValue("!   echo key-from-command   ")).toBe("key-from-command");
	});
});

describe("resolveHeaders", () => {
	test("drops headers when value resolution is empty", () => {
		clearConfigValueCache();
		const headers = resolveHeaders({
			"x-empty-command": "! ",
			"x-literal": "fixed-value",
		});
		expect(headers).toEqual({ "x-literal": "fixed-value" });
	});
});
