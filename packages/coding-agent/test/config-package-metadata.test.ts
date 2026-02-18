import { describe, expect, test } from "vitest";
import { parsePackageMetadata } from "../src/config.js";

describe("parsePackageMetadata", () => {
	test("preserves valid app metadata", () => {
		expect(
			parsePackageMetadata(
				JSON.stringify({
					version: "1.2.3",
					piConfig: {
						name: "my-agent",
						configDir: ".my-agent",
					},
				}),
			),
		).toEqual({
			appName: "my-agent",
			configDirName: ".my-agent",
			version: "1.2.3",
		});
	});

	test("falls back for malformed metadata", () => {
		expect(parsePackageMetadata("{")).toEqual({
			appName: "pi",
			configDirName: ".pi",
			version: "0.0.0",
		});
		expect(parsePackageMetadata("[]")).toEqual({
			appName: "pi",
			configDirName: ".pi",
			version: "0.0.0",
		});
		expect(
			parsePackageMetadata(
				JSON.stringify({
					version: "",
					piConfig: {
						name: " ",
						configDir: 123,
					},
				}),
			),
		).toEqual({
			appName: "pi",
			configDirName: ".pi",
			version: "0.0.0",
		});
		expect(
			parsePackageMetadata(
				JSON.stringify({
					version: " 1.2.3 ",
					piConfig: {
						name: " my-agent ",
						configDir: " .my-agent ",
					},
				}),
			),
		).toEqual({
			appName: "pi",
			configDirName: ".pi",
			version: "0.0.0",
		});
	});
});
