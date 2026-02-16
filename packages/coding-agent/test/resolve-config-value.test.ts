import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { clearConfigValueCache, resolveConfigValue, resolveHeaders } from "../src/core/resolve-config-value.js";

const tempDirs: string[] = [];

function createTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "pi-resolve-config-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	clearConfigValueCache();
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("resolveConfigValue", () => {
	test("returns undefined for blank shell commands", () => {
		expect(resolveConfigValue("!")).toBeUndefined();
		expect(resolveConfigValue("!    ")).toBeUndefined();
	});

	test("resolves trimmed shell commands", () => {
		expect(resolveConfigValue("!   echo key-from-command   ")).toBe("key-from-command");
	});

	test("normalizes command cache keys by trimmed shell command", () => {
		const tempDir = createTempDir();
		const counterFile = join(tempDir, "counter");
		writeFileSync(counterFile, "0", "utf-8");

		const command = `!sh -c 'count=$(cat ${counterFile}); echo $((count + 1)) > ${counterFile}; echo command-value'`;
		const first = resolveConfigValue(command);
		const second = resolveConfigValue(`!   ${command.slice(1)}   `);

		expect(first).toBe("command-value");
		expect(second).toBe("command-value");
		expect(readFileSync(counterFile, "utf-8").trim()).toBe("1");
	});

	test("returns undefined for empty environment variable values", () => {
		const key = "PI_TEST_EMPTY_ENV_VALUE";
		const original = process.env[key];
		process.env[key] = "";
		try {
			expect(resolveConfigValue(key)).toBeUndefined();
		} finally {
			if (original === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = original;
			}
		}
	});

	test("returns literal when environment variable is not defined", () => {
		const key = "PI_TEST_LITERAL_ENV_FALLBACK";
		const original = process.env[key];
		delete process.env[key];
		try {
			expect(resolveConfigValue(key)).toBe(key);
		} finally {
			if (original !== undefined) {
				process.env[key] = original;
			}
		}
	});
});

describe("resolveHeaders", () => {
	test("drops headers when value resolution is empty", () => {
		const headers = resolveHeaders({
			"x-empty-command": "! ",
			"x-literal": "fixed-value",
		});
		expect(headers).toEqual({ "x-literal": "fixed-value" });
	});
});
