/**
 * Mechanical gates: deterministic pass/fail checks. No LLM can override a failing gate.
 * Each gate returns a structured GateResult.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface GateResult {
	passed: boolean;
	output: string;
	diagnostics?: string[];
}

/** Task shape for decomposition validation: must have title and acceptance criteria. */
export interface DecompositionTask {
	title?: string;
	acceptanceCriteria?: string | string[];
}

const TEST_COMMAND = process.env.PI_TEST_COMMAND ?? "npm test";
const VALIDATE_COMMAND = process.env.PI_VALIDATE_COMMAND ?? "npm run check";

function runInCwd(cwd: string, command: string): { stdout: string; stderr: string; exitCode: number } {
	try {
		const result = execSync(command, {
			cwd,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
			maxBuffer: 4 * 1024 * 1024,
		});
		return { stdout: result.toString(), stderr: "", exitCode: 0 };
	} catch (err: unknown) {
		const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer };
		return {
			stdout: e.stdout?.toString() ?? "",
			stderr: e.stderr?.toString() ?? "",
			exitCode: e.status ?? 1,
		};
	}
}

/**
 * Verify plan is parseable and every task has acceptance criteria.
 * Returns pass if tasks array is non-empty and each task has at least one acceptance criterion.
 */
export function validateDecomposition(tasks: DecompositionTask[]): GateResult {
	const diagnostics: string[] = [];
	if (!Array.isArray(tasks) || tasks.length === 0) {
		return {
			passed: false,
			output: "No tasks or invalid plan",
			diagnostics: ["Plan must contain at least one task."],
		};
	}
	for (let i = 0; i < tasks.length; i++) {
		const t = tasks[i];
		const criteria = t.acceptanceCriteria;
		const hasCriteria =
			typeof criteria === "string" ? criteria.trim().length > 0 : Array.isArray(criteria) && criteria.length > 0;
		if (!hasCriteria) {
			diagnostics.push(`Task ${i + 1} (${t.title ?? "untitled"}) has no acceptance criteria.`);
		}
	}
	const passed = diagnostics.length === 0;
	return {
		passed,
		output: passed ? `Valid decomposition: ${tasks.length} task(s).` : diagnostics.join("\n"),
		diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
	};
}

/**
 * Red gate: run tests; they MUST fail (proving tests target unimplemented code).
 * Pass if exit code !== 0.
 */
export function redTestGate(cwd: string): GateResult {
	const { stdout, stderr, exitCode } = runInCwd(cwd, TEST_COMMAND);
	const output = [stdout, stderr].filter(Boolean).join("\n");
	const passed = exitCode !== 0;
	return {
		passed,
		output,
		diagnostics: passed
			? undefined
			: ["Tests passed but must fail at red gate. Write tests that target unimplemented behavior."],
	};
}

/**
 * Green gate: run full validate (tests + lint + arch check). Must pass (exit 0).
 */
export function greenGate(cwd: string): GateResult {
	const { stdout, stderr, exitCode } = runInCwd(cwd, VALIDATE_COMMAND);
	const output = [stdout, stderr].filter(Boolean).join("\n");
	return {
		passed: exitCode === 0,
		output,
	};
}

/**
 * Architecture gate: run dependency/architecture check.
 * Uses scripts/check-architecture.ts when present; otherwise no-op that passes.
 */
export function validateArchitecture(cwd: string): GateResult {
	const scriptPath = join(cwd, "scripts", "check-architecture.ts");
	if (!existsSync(scriptPath)) {
		return { passed: true, output: "No architecture script; skip." };
	}
	const { stdout, stderr, exitCode } = runInCwd(cwd, `npx tsx ${scriptPath}`);
	const output = [stdout, stderr].filter(Boolean).join("\n");
	return {
		passed: exitCode === 0,
		output,
	};
}

export type ReviewOutcome = "approved" | "needs_fixes" | "rejected";

/**
 * Parse review output into exactly one of: approved | needs_fixes | rejected.
 * Looks for explicit markers (e.g. "VERDICT: approved") or keywords.
 */
export function validateReview(reviewOutput: string): GateResult & { outcome?: ReviewOutcome } {
	const lower = reviewOutput.toLowerCase().trim();
	// Explicit verdict block
	const verdictMatch = lower.match(/(?:verdict|outcome|result)\s*:\s*(approved|needs_fixes|rejected)/);
	if (verdictMatch) {
		const outcome = verdictMatch[1] as ReviewOutcome;
		return { passed: true, output: reviewOutput, outcome };
	}
	// Line that is only one of the three
	if (/^\s*(approved|needs_fixes|rejected)\s*$/m.test(lower)) {
		const m = lower.match(/^\s*(approved|needs_fixes|rejected)\s*$/m);
		const outcome = (m ? m[1] : "rejected") as ReviewOutcome;
		return { passed: true, output: reviewOutput, outcome };
	}
	// Keyword fallback: reject if "reject", else "needs fixes" if "fix" or "change", else approved
	if (/\breject\b/.test(lower) || /\bnot\s+approved\b/.test(lower)) {
		return { passed: true, output: reviewOutput, outcome: "rejected" };
	}
	if (/\bneeds?\s*fix(es)?\b/.test(lower) || /\b(fix|change|address)\s+(the\s+)?/i.test(lower)) {
		return { passed: true, output: reviewOutput, outcome: "needs_fixes" };
	}
	if (/\bapprov(e|ed)\b/.test(lower) || /\blgtm\b/.test(lower) || /\blooks\s+good\b/.test(lower)) {
		return { passed: true, output: reviewOutput, outcome: "approved" };
	}
	// Unparseable
	return {
		passed: false,
		output: reviewOutput,
		diagnostics: ["Review output could not be parsed to approved | needs_fixes | rejected."],
	};
}
