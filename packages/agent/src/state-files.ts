/**
 * Git-bound state file management: PROJECT_STATUS.md, LEARNINGS.md,
 * ITERATION_N_LEARNINGS.md, ARCHITECTURE.md, EXECUTION_PLAN.md.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const STATE_FILES = {
	PROJECT_STATUS: "PROJECT_STATUS.md",
	LEARNINGS: "LEARNINGS.md",
	EXECUTION_PLAN: "EXECUTION_PLAN.md",
	ARCHITECTURE: "ARCHITECTURE.md",
} as const;

export function iterationLearningsPath(iteration: number): string {
	return `ITERATION_${iteration}_LEARNINGS.md`;
}

/**
 * Read a state file under cwd. Returns empty string if missing.
 */
export function readState(fileName: keyof typeof STATE_FILES | string, cwd: string = process.cwd()): string {
	const path = join(cwd, typeof fileName === "string" ? fileName : STATE_FILES[fileName]);
	if (!existsSync(path)) return "";
	return readFileSync(path, "utf-8");
}

/**
 * Write content to a state file. Creates parent dirs if needed.
 */
export function writeState(
	fileName: keyof typeof STATE_FILES | string,
	content: string,
	cwd: string = process.cwd(),
): void {
	const path = join(cwd, typeof fileName === "string" ? fileName : STATE_FILES[fileName]);
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, content, "utf-8");
}

/**
 * Update PROJECT_STATUS.md with task checkmarks and attempt trackers.
 * Merges new lines into existing content by section (e.g. "## Tasks").
 */
export function updateProjectStatus(updates: { section?: string; lines: string[] }, cwd: string = process.cwd()): void {
	const path = join(cwd, STATE_FILES.PROJECT_STATUS);
	let content = existsSync(path) ? readFileSync(path, "utf-8") : "";
	const section = updates.section ?? "## Tasks";
	const sectionHeader = section.startsWith("#") ? section : `## ${section}`;
	const newBlock = updates.lines.join("\n");
	if (content.includes(sectionHeader)) {
		const before = content.slice(0, content.indexOf(sectionHeader));
		const afterMatch = content.slice(content.indexOf(sectionHeader)).match(/\n(?=##\s|$)/);
		const after = afterMatch ? content.slice(content.indexOf(sectionHeader) + (afterMatch.index ?? 0)) : "";
		content = `${before + sectionHeader}\n${newBlock}${after}`;
	} else {
		content = `${content.trimEnd()}\n\n${sectionHeader}\n${newBlock}\n`;
	}
	writeFileSync(path, content, "utf-8");
}

/**
 * Commit state files to git. Caller may run after each task.
 */
export function commitState(
	message: string,
	cwd: string = process.cwd(),
	files: string[] = [
		STATE_FILES.PROJECT_STATUS,
		STATE_FILES.LEARNINGS,
		STATE_FILES.EXECUTION_PLAN,
		STATE_FILES.ARCHITECTURE,
	],
): void {
	for (const f of files) {
		const p = join(cwd, f);
		if (existsSync(p)) execFileSync("git", ["add", "--", p], { cwd, encoding: "utf-8" });
	}
	try {
		execFileSync("git", ["commit", "-m", message], { cwd, encoding: "utf-8" });
	} catch {
		// nothing to commit
	}
}
