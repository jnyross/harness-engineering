/**
 * TDD state machine: PLAN -> WRITE_TESTS -> RED_GATE -> CODE -> GREEN_GATE -> PEER_REVIEW -> DONE.
 * Mechanical gates (red, green, review) are deterministic; LLM states use agentLoop with phase prompts.
 */

import { execSync } from "node:child_process";
import { agentLoop } from "./agent-loop.js";
import type { GateResult, ReviewOutcome } from "./gates.js";
import { greenGate, redTestGate, validateReview } from "./gates.js";
import { getTddPrompt } from "./tdd-prompts.js";
import type { AgentContext, AgentLoopConfig, AgentMessage } from "./types.js";

export type TddState =
	| "plan"
	| "write_tests"
	| "red_gate"
	| "code"
	| "green_gate"
	| "parse_error"
	| "self_correct"
	| "peer_review"
	| "done"
	| "fail";

export interface TddTask {
	title: string;
	description?: string;
	acceptanceCriteria: string[];
}

export interface TddLoopEvent {
	type: "tdd_state";
	state: TddState;
	payload?: { planOutput?: string; gateResult?: GateResult; outcome?: ReviewOutcome };
}

export interface TddLoopOptions {
	cwd: string;
	config: AgentLoopConfig;
	/** Optional context (e.g. tools) for agentLoop. */
	contextExtras?: Partial<Pick<AgentContext, "tools">>;
	signal?: AbortSignal;
	maxRedoRounds?: number;
	onEvent?: (event: TddLoopEvent) => void;
}

export interface TddLoopResult {
	state: TddState;
	planOutput?: string;
	reviewOutcome?: ReviewOutcome;
	redoCount: number;
}

const DEFAULT_MAX_REDO = 1;

function emit(onEvent: TddLoopOptions["onEvent"], state: TddState, payload?: TddLoopEvent["payload"]) {
	onEvent?.({ type: "tdd_state", state, payload });
}

function lastAssistantText(messages: AgentMessage[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (m.role === "assistant" && Array.isArray(m.content)) {
			const parts = (m.content as { type: string; text?: string }[])
				.filter((c) => c.type === "text" && c.text)
				.map((c) => (c as { text: string }).text);
			return parts.join("\n");
		}
	}
	return "";
}

function userMessage(content: string): AgentMessage {
	return {
		role: "user",
		content: [{ type: "text", text: content }],
		timestamp: Date.now(),
	};
}

function runAgentPhase(
	systemPrompt: string,
	userContent: string,
	context: Omit<AgentContext, "systemPrompt" | "messages">,
	config: AgentLoopConfig,
	signal?: AbortSignal,
): Promise<AgentMessage[]> {
	const ctx: AgentContext = { ...context, systemPrompt, messages: [] };
	const stream = agentLoop([userMessage(userContent)], ctx, config, signal);
	return stream.result();
}

/**
 * Run the TDD inner loop for one task. Returns final state and review outcome.
 */
export async function tddLoop(task: TddTask, options: TddLoopOptions): Promise<TddLoopResult> {
	const { cwd, config, signal, onEvent, contextExtras } = options;
	const maxRedoRounds = options.maxRedoRounds ?? DEFAULT_MAX_REDO;
	const baseContext: Omit<AgentContext, "systemPrompt" | "messages"> = {
		...contextExtras,
	};
	let redoCount = 0;
	let planOutput = "";
	let state: TddState = "plan";

	const taskBlurb = `Task: ${task.title}\n${task.description ?? ""}\nAcceptance criteria:\n${task.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}`;

	// PLAN
	emit(onEvent, "plan");
	const planMessages = await runAgentPhase(getTddPrompt("plan"), taskBlurb, baseContext, config, signal);
	planOutput = lastAssistantText(planMessages);

	// Inner loop: write_tests -> red_gate -> code -> green_gate -> (self_correct | peer_review)
	while (true) {
		// WRITE_TESTS
		state = "write_tests";
		emit(onEvent, state);
		const writeTestsContent = `${taskBlurb}\n\nPlan:\n${planOutput}\n\nWrite tests based ONLY on the acceptance criteria above. Do NOT look at any implementation code.`;
		await runAgentPhase(getTddPrompt("write_tests"), writeTestsContent, baseContext, config, signal);

		// RED_GATE
		state = "red_gate";
		const redResult = redTestGate(cwd);
		emit(onEvent, state, { gateResult: redResult });
		if (!redResult.passed) {
			// Tests passed when they should fail -> bad tests, retry write_tests (we already did one loop)
			continue;
		}

		// CODE
		state = "code";
		emit(onEvent, state);
		const codeContent = `${taskBlurb}\n\nPlan:\n${planOutput}\n\nImplement the minimum code to make the tests pass.`;
		await runAgentPhase(getTddPrompt("code"), codeContent, baseContext, config, signal);

		// GREEN_GATE (may loop with self_correct)
		for (;;) {
			state = "green_gate";
			const greenResult = greenGate(cwd);
			emit(onEvent, state, { gateResult: greenResult });
			if (greenResult.passed) break;
			// SELF_CORRECT
			state = "self_correct";
			emit(onEvent, state);
			const selfCorrectContent = `The validate run failed. Fix the code or tests.\n\nOutput:\n${greenResult.output}`;
			await runAgentPhase(getTddPrompt("self_correct"), selfCorrectContent, baseContext, config, signal);
		}

		// PEER_REVIEW
		state = "peer_review";
		emit(onEvent, state);
		let diff = "";
		try {
			diff = execSync("git diff", { cwd, encoding: "utf-8", maxBuffer: 2 * 1024 * 1024 });
		} catch {
			// not a git repo or no diff
		}
		const reviewContent = `Clean context for review (no coding conversation):\n\nTask:\n${taskBlurb}\n\nPlan:\n${planOutput}\n\nDiff:\n${diff}\n\nReview and output VERDICT: approved | needs_fixes | rejected.`;
		const reviewMessages = await runAgentPhase(
			getTddPrompt("peer_review"),
			reviewContent,
			baseContext,
			config,
			signal,
		);
		const reviewText = lastAssistantText(reviewMessages);
		const reviewResult = validateReview(reviewText);

		if (!reviewResult.passed) {
			emit(onEvent, "fail", { gateResult: reviewResult });
			return { state: "fail", planOutput, redoCount };
		}

		const outcome = (reviewResult as GateResult & { outcome?: ReviewOutcome }).outcome;

		if (outcome === "approved") {
			emit(onEvent, "done");
			return { state: "done", planOutput, reviewOutcome: outcome, redoCount };
		}

		if (outcome === "rejected") {
			emit(onEvent, "fail", { outcome });
			return { state: "fail", planOutput, reviewOutcome: outcome, redoCount };
		}

		// needs_fixes
		if (redoCount < maxRedoRounds) {
			try {
				execSync("git checkout .", { cwd, encoding: "utf-8" });
			} catch {
				// ignore
			}
			redoCount++;
			// Re-enter from write_tests with learnings (we could append reviewText to next prompt)
			continue;
		}

		// needs_fixes but no redo left: treat as self_correct then re-run green gate (simplified: fail or one more fix)
		state = "self_correct";
		emit(onEvent, state);
		const fixContent = `Peer review requested fixes. Address them:\n\n${reviewText}`;
		await runAgentPhase(getTddPrompt("self_correct"), fixContent, baseContext, config, signal);
		// One more green gate
		const finalGreen = greenGate(cwd);
		if (finalGreen.passed) {
			emit(onEvent, "done");
			return { state: "done", planOutput, reviewOutcome: "needs_fixes", redoCount };
		}
		emit(onEvent, "fail", { gateResult: finalGreen });
		return { state: "fail", planOutput, redoCount };
	}
}
