import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DefaultPackageManager } from "../src/core/package-manager.js";
import type { SettingsManager } from "../src/core/settings-manager.js";

const originalFetch = global.fetch;

function createSettingsManagerStub(): SettingsManager {
	const stub = {
		getGlobalSettings: () => ({}),
		getProjectSettings: () => ({}),
		setPackages: () => {},
		setProjectPackages: () => {},
	} satisfies Partial<SettingsManager>;
	return stub as unknown as SettingsManager;
}

function createPackageManagerForRegistryTests() {
	const tempDir = mkdtempSync(join(tmpdir(), "pi-pm-registry-"));
	const manager = new DefaultPackageManager({
		cwd: tempDir,
		agentDir: tempDir,
		settingsManager: createSettingsManagerStub(),
	});
	return manager as unknown as { getLatestNpmVersion: (packageName: string) => Promise<string> };
}

describe("package manager npm registry version parsing", () => {
	afterEach(() => {
		global.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("accepts strict semver npm registry version values", async () => {
		global.fetch = vi.fn(
			async () => new Response(JSON.stringify({ version: "1.2.3" }), { status: 200 }),
		) as typeof fetch;

		const manager = createPackageManagerForRegistryTests();
		await expect(manager.getLatestNpmVersion("example-pkg")).resolves.toBe("1.2.3");

		global.fetch = vi.fn(
			async () => new Response(JSON.stringify({ version: "1.2.3-beta.1+build.9" }), { status: 200 }),
		) as typeof fetch;
		await expect(manager.getLatestNpmVersion("example-pkg")).resolves.toBe("1.2.3-beta.1+build.9");
	});

	it("rejects malformed npm registry version payload shapes and values", async () => {
		const manager = createPackageManagerForRegistryTests();
		global.fetch = vi.fn(async () => new Response(JSON.stringify({ version: 123 }), { status: 200 })) as typeof fetch;
		await expect(manager.getLatestNpmVersion("example-pkg")).rejects.toThrow(
			"Invalid npm registry response: missing version",
		);

		global.fetch = vi.fn(
			async () => new Response(JSON.stringify({ version: " 1.2.3 " }), { status: 200 }),
		) as typeof fetch;
		await expect(manager.getLatestNpmVersion("example-pkg")).rejects.toThrow(
			"Invalid npm registry response: missing version",
		);

		global.fetch = vi.fn(
			async () => new Response(JSON.stringify({ version: "latest" }), { status: 200 }),
		) as typeof fetch;
		await expect(manager.getLatestNpmVersion("example-pkg")).rejects.toThrow(
			"Invalid npm registry response: missing version",
		);

		global.fetch = vi.fn(
			async () => new Response(JSON.stringify({ version: "v1.2.3" }), { status: 200 }),
		) as typeof fetch;
		await expect(manager.getLatestNpmVersion("example-pkg")).rejects.toThrow(
			"Invalid npm registry response: missing version",
		);

		global.fetch = vi.fn(async () => new Response("null", { status: 200 })) as typeof fetch;
		await expect(manager.getLatestNpmVersion("example-pkg")).rejects.toThrow(
			"Invalid npm registry response: missing version",
		);

		global.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as typeof fetch;
		await expect(manager.getLatestNpmVersion("example-pkg")).rejects.toThrow(
			"Invalid npm registry response: missing version",
		);
	});
});
