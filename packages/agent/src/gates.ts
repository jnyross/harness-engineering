/**
 * Mechanical gates: deterministic pass/fail checks. No LLM can override a failing gate.
 * Each gate returns a structured GateResult.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseReviewResponse } from "./reviewer.js";

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

const DEFAULT_TEST_COMMAND = "npm test";
const DEFAULT_VALIDATE_COMMAND = "npm run check";

export function parseCommand(command: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: "'" | '"' | null = null;
	let escaping = false;
	let tokenStarted = false;

	for (const char of command) {
		if (escaping) {
			current += char;
			escaping = false;
			tokenStarted = true;
			continue;
		}

		if (quote === "'") {
			if (char === "'") {
				quote = null;
			} else {
				current += char;
			}
			tokenStarted = true;
			continue;
		}

		if (quote === '"') {
			if (char === '"') {
				quote = null;
			} else if (char === "\\") {
				escaping = true;
			} else {
				current += char;
			}
			tokenStarted = true;
			continue;
		}

		if (char === "'" || char === '"') {
			quote = char;
			tokenStarted = true;
			continue;
		}

		if (char === "\\") {
			escaping = true;
			tokenStarted = true;
			continue;
		}

		if (/\s/.test(char)) {
			if (tokenStarted) {
				tokens.push(current);
				current = "";
				tokenStarted = false;
			}
			continue;
		}

		current += char;
		tokenStarted = true;
	}

	if (escaping) {
		throw new Error("Invalid command: trailing escape character.");
	}
	if (quote) {
		throw new Error("Invalid command: unmatched quote.");
	}
	if (tokenStarted) {
		tokens.push(current);
	}
	return tokens;
}

interface CommandExecutionResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	invocationError: boolean;
}

function runInCwd(cwd: string, command: string | string[]): CommandExecutionResult {
	let parsedCommand: string[];
	try {
		parsedCommand = Array.isArray(command) ? command : parseCommand(command);
	} catch (error) {
		return {
			stdout: "",
			stderr: error instanceof Error ? error.message : String(error),
			exitCode: 1,
			invocationError: true,
		};
	}
	if (parsedCommand.length === 0) {
		return { stdout: "", stderr: "Invalid command: command is empty.", exitCode: 1, invocationError: true };
	}
	try {
		const result = execFileSync(parsedCommand[0], parsedCommand.slice(1), {
			cwd,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
			maxBuffer: 4 * 1024 * 1024,
		});
		return { stdout: result.toString(), stderr: "", exitCode: 0, invocationError: false };
	} catch (err: unknown) {
		const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer; message?: string };
		const stderr = e.stderr?.toString() ?? e.message ?? "";
		return {
			stdout: e.stdout?.toString() ?? "",
			stderr,
			exitCode: e.status ?? 1,
			invocationError: e.status === undefined,
		};
	}
}

function getTestCommand(): string {
	return process.env.PI_TEST_COMMAND ?? DEFAULT_TEST_COMMAND;
}

function getValidateCommand(): string {
	return process.env.PI_VALIDATE_COMMAND ?? DEFAULT_VALIDATE_COMMAND;
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
	const { stdout, stderr, exitCode, invocationError } = runInCwd(cwd, getTestCommand());
	const output = [stdout, stderr].filter(Boolean).join("\n");
	const passed = !invocationError && exitCode !== 0;
	return {
		passed,
		output,
		diagnostics: passed
			? undefined
			: invocationError
				? ["Test command failed to execute. Ensure PI_TEST_COMMAND is valid and runnable."]
				: ["Tests passed but must fail at red gate. Write tests that target unimplemented behavior."],
	};
}

/**
 * Green gate: run full validate (tests + lint + arch check). Must pass (exit 0).
 */
export function greenGate(cwd: string): GateResult {
	const { stdout, stderr, exitCode } = runInCwd(cwd, getValidateCommand());
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
	const { stdout, stderr, exitCode } = runInCwd(cwd, ["npx", "tsx", scriptPath]);
	const output = [stdout, stderr].filter(Boolean).join("\n");
	return {
		passed: exitCode === 0,
		output,
	};
}

export type ReviewOutcome = ReturnType<typeof parseReviewResponse>["outcome"];

/**
 * Parse review output into exactly one of: approved | needs_fixes | rejected.
 * Looks for explicit markers (e.g. "VERDICT: approved") or keywords.
 */
export function validateReview(reviewOutput: string): GateResult & { outcome?: ReviewOutcome } {
	const parsed = parseReviewResponse(reviewOutput);
	if (parsed.outcome === "rejected" && parsed.reason === "No clear approval or rejection found in response") {
		return {
			passed: false,
			output: reviewOutput,
			diagnostics: ["Review output could not be parsed to approved | needs_fixes | rejected."],
		};
	}
	return {
		passed: true,
		output: reviewOutput,
		outcome: parsed.outcome,
	};
}
