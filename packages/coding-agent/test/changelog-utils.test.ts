import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getNewEntries, parseChangelog } from "../src/utils/changelog.js";

function withTempChangelog(content: string, run: (path: string) => void): void {
	const dir = mkdtempSync(join(tmpdir(), "pi-changelog-test-"));
	const changelogPath = join(dir, "CHANGELOG.md");
	try {
		writeFileSync(changelogPath, content, "utf-8");
		run(changelogPath);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe("changelog version parsing", () => {
	it("parses valid semantic versions and preserves content", () => {
		withTempChangelog(
			`# Changelog

## [1.2.3] - 2026-02-16

### Added
- Feature
`,
			(changelogPath) => {
				const entries = parseChangelog(changelogPath);
				expect(entries).toHaveLength(1);
				expect(entries[0]).toMatchObject({
					major: 1,
					minor: 2,
					patch: 3,
				});
				expect(entries[0]?.content).toContain("Feature");
			},
		);
	});

	it("ignores changelog headers with unsafe integer version components", () => {
		withTempChangelog(
			`# Changelog

## [9007199254740993.2.3] - 2026-02-16
### Added
- Unsafe entry

## [1.0.0] - 2026-02-16
### Added
- Safe entry
`,
			(changelogPath) => {
				const entries = parseChangelog(changelogPath);
				expect(entries).toHaveLength(1);
				expect(entries[0]).toMatchObject({
					major: 1,
					minor: 0,
					patch: 0,
				});
				expect(entries[0]?.content).toContain("Safe entry");
			},
		);
	});

	it("treats unsafe lastVersion input as 0.0.0 fallback", () => {
		const entries = [
			{ major: 1, minor: 0, patch: 0, content: "one" },
			{ major: 2, minor: 0, patch: 0, content: "two" },
		];

		const newEntries = getNewEntries(entries, "9007199254740993.0.0");
		expect(newEntries).toHaveLength(2);
	});
});
