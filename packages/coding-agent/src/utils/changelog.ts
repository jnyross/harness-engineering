import { existsSync, readFileSync } from "fs";

export interface ChangelogEntry {
	major: number;
	minor: number;
	patch: number;
	content: string;
}

function parseSafeVersionComponent(value: string): number | undefined {
	if (!/^\d+$/.test(value)) {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseVersionString(version: string): { major: number; minor: number; patch: number } | undefined {
	const trimmed = version.trim();
	if (trimmed.length === 0 || trimmed !== version) {
		return undefined;
	}
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
	if (!match) {
		return undefined;
	}
	const major = parseSafeVersionComponent(match[1]);
	const minor = parseSafeVersionComponent(match[2]);
	const patch = parseSafeVersionComponent(match[3]);
	if (major === undefined || minor === undefined || patch === undefined) {
		return undefined;
	}
	return { major, minor, patch };
}

/**
 * Parse changelog entries from CHANGELOG.md
 * Scans for ## lines and collects content until next ## or EOF
 */
export function parseChangelog(changelogPath: string): ChangelogEntry[] {
	if (!existsSync(changelogPath)) {
		return [];
	}

	try {
		const content = readFileSync(changelogPath, "utf-8");
		const lines = content.split("\n");
		const entries: ChangelogEntry[] = [];

		let currentLines: string[] = [];
		let currentVersion: { major: number; minor: number; patch: number } | null = null;

		for (const line of lines) {
			// Check if this is a version header (## [x.y.z] ...)
			if (line.startsWith("## ")) {
				// Save previous entry if exists
				if (currentVersion && currentLines.length > 0) {
					entries.push({
						...currentVersion,
						content: currentLines.join("\n").trim(),
					});
				}

				// Try to parse version from this line
				const versionMatch = line.match(/##\s+\[?(\d+)\.(\d+)\.(\d+)\]?/);
				if (versionMatch) {
					const parsedVersion = parseVersionString(`${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}`);
					if (parsedVersion) {
						currentVersion = parsedVersion;
						currentLines = [line];
					} else {
						// Reset if version components are unsafe integers
						currentVersion = null;
						currentLines = [];
					}
				} else {
					// Reset if we can't parse version
					currentVersion = null;
					currentLines = [];
				}
			} else if (currentVersion) {
				// Collect lines for current version
				currentLines.push(line);
			}
		}

		// Save last entry
		if (currentVersion && currentLines.length > 0) {
			entries.push({
				...currentVersion,
				content: currentLines.join("\n").trim(),
			});
		}

		return entries;
	} catch (error) {
		console.error(`Warning: Could not parse changelog: ${error}`);
		return [];
	}
}

/**
 * Compare versions. Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1: ChangelogEntry, v2: ChangelogEntry): number {
	if (v1.major !== v2.major) return v1.major - v2.major;
	if (v1.minor !== v2.minor) return v1.minor - v2.minor;
	return v1.patch - v2.patch;
}

/**
 * Get entries newer than lastVersion
 */
export function getNewEntries(entries: ChangelogEntry[], lastVersion: string): ChangelogEntry[] {
	// Parse lastVersion
	const parsedLastVersion = parseVersionString(lastVersion);
	const last: ChangelogEntry = {
		major: parsedLastVersion?.major ?? 0,
		minor: parsedLastVersion?.minor ?? 0,
		patch: parsedLastVersion?.patch ?? 0,
		content: "",
	};

	return entries.filter((entry) => compareVersions(entry, last) > 0);
}

// Re-export getChangelogPath from paths.ts for convenience
export { getChangelogPath } from "../config.js";
