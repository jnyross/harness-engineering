import { describe, expect, it } from "vitest";
import { parseLatestReleaseVersion } from "../src/utils/tools-manager.js";

describe("parseLatestReleaseVersion", () => {
	it("normalizes GitHub release tags with optional v-prefix and whitespace", () => {
		expect(parseLatestReleaseVersion({ tag_name: "v1.2.3" })).toBe("1.2.3");
		expect(parseLatestReleaseVersion({ tag_name: " 1.2.3 " })).toBe("1.2.3");
		expect(parseLatestReleaseVersion({ tag_name: " v1.2.3 " })).toBe("1.2.3");
	});

	it("rejects malformed release payload shapes", () => {
		expect(parseLatestReleaseVersion(null)).toBeUndefined();
		expect(parseLatestReleaseVersion([])).toBeUndefined();
		expect(parseLatestReleaseVersion({})).toBeUndefined();
		expect(parseLatestReleaseVersion({ tag_name: "" })).toBeUndefined();
		expect(parseLatestReleaseVersion({ tag_name: " " })).toBeUndefined();
		expect(parseLatestReleaseVersion({ tag_name: "v" })).toBeUndefined();
		expect(parseLatestReleaseVersion({ tag_name: 123 })).toBeUndefined();
	});
});
