/**
 * Progressive disclosure and learnings: compact, query, and append.
 * Uses docs/solutions/ category structure (build-errors/, performance-issues/, etc.).
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface LearningEntry {
	category: string;
	title: string;
	content: string;
	/** Optional YAML frontmatter for compound-docs schema */
	metadata?: Record<string, string>;
}

const DEFAULT_LEARNINGS_FILE = "LEARNINGS.md";
const SOLUTIONS_DIR = "docs/solutions";

const CE_CATEGORIES = [
	"build-errors",
	"performance-issues",
	"security",
	"data-integrity",
	"architecture",
	"testing",
	"workflow",
	"other",
];

/**
 * Resolve learnings path (file path to LEARNINGS.md). If relative, resolve against cwd.
 */
export function resolveLearningsPath(learningsPath: string, cwd: string): string {
	return learningsPath.startsWith("/") ? learningsPath : join(cwd, learningsPath || DEFAULT_LEARNINGS_FILE);
}

/**
 * Append a structured learning entry to LEARNINGS.md and optionally write to docs/solutions/<category>/.
 */
export function addLearning(entry: LearningEntry, learningsPath: string, cwd: string = process.cwd()): void {
	const resolved = resolveLearningsPath(learningsPath, cwd);
	const line = `\n## ${entry.title}\n**Category:** ${entry.category}\n\n${entry.content}\n`;
	appendFileSync(resolved, line, "utf-8");
	const category = CE_CATEGORIES.includes(entry.category) ? entry.category : "other";
	const solutionsDir = join(cwd, SOLUTIONS_DIR, category);
	if (!existsSync(solutionsDir)) {
		mkdirSync(solutionsDir, { recursive: true });
	}
	const slug = entry.title.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
	const filePath = join(solutionsDir, `${slug}.md`);
	const frontmatter = entry.metadata
		? "---\n" +
			Object.entries(entry.metadata)
				.map(([k, v]) => `${k}: ${v}`)
				.join("\n") +
			"\n---\n\n"
		: "";
	writeFileSync(filePath, frontmatter + entry.content, "utf-8");
}

/**
 * Read LEARNINGS.md and return raw content (for compaction input).
 */
export function readLearnings(learningsPath: string, cwd: string = process.cwd()): string {
	const resolved = resolveLearningsPath(learningsPath, cwd);
	if (!existsSync(resolved)) return "";
	return readFileSync(resolved, "utf-8");
}

/**
 * Compact learnings: deduplicate by title and normalize sections.
 * Non-LLM version: parse ## sections, dedupe by title, write back.
 * For LLM-powered compaction the caller can pass content to an LLM and then write result.
 */
export function compactLearnings(
	learningsPath: string,
	cwd: string = process.cwd(),
): { deduplicated: number; outputPath: string } {
	const resolved = resolveLearningsPath(learningsPath, cwd);
	const raw = readLearnings(learningsPath, cwd);
	const sections = raw.split(/\n##\s+/).filter(Boolean);
	const seen = new Set<string>();
	const kept: string[] = [];
	for (const section of sections) {
		const firstLine = section.split(/\r?\n/)[0]?.trim() ?? "";
		const title = firstLine.replace(/^\s*#*\s*/, "");
		if (seen.has(title.toLowerCase())) continue;
		seen.add(title.toLowerCase());
		kept.push(`## ${section.trim()}`);
	}
	const newContent = `${kept.join("\n\n").trim()}\n`;
	writeFileSync(resolved, newContent, "utf-8");
	return { deduplicated: sections.length - kept.length, outputPath: resolved };
}

/**
 * Query learnings by topic: search LEARNINGS.md and docs/solutions/ for matching snippets.
 * Returns relevant snippets (not the entire file).
 */
export function queryLearnings(topic: string, learningsPath: string, cwd: string = process.cwd()): string[] {
	const _resolved = resolveLearningsPath(learningsPath, cwd);
	const results: string[] = [];
	const raw = readLearnings(learningsPath, cwd);
	const lowerTopic = topic.toLowerCase();
	const sections = raw.split(/\n##\s+/).filter(Boolean);
	for (const section of sections) {
		if (section.toLowerCase().includes(lowerTopic)) {
			results.push(section.trim().slice(0, 2000));
		}
	}
	const solutionsRoot = join(cwd, SOLUTIONS_DIR);
	if (existsSync(solutionsRoot)) {
		for (const cat of readdirSync(solutionsRoot, { withFileTypes: true })) {
			if (!cat.isDirectory()) continue;
			const dir = join(solutionsRoot, cat.name);
			for (const ent of readdirSync(dir, { withFileTypes: true })) {
				if (!ent.isFile() || !ent.name.endsWith(".md")) continue;
				const content = readFileSync(join(dir, ent.name), "utf-8");
				if (content.toLowerCase().includes(lowerTopic)) {
					results.push(content.trim().slice(0, 2000));
				}
			}
		}
	}
	return results;
}
