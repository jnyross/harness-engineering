/**
 * Outer loop: BRAINSTORM -> PLAN -> WORK -> REVIEW -> COMPOUND -> INTEGRATE.
 * Supports Brooks Loop (--iterations N). Emits ProjectLoopEvent and writes NDJSON to eventsPath.
 */

import { execSync } from "node:child_process";
import { agentLoop } from "./agent-loop.js";
import { greenGate, validateDecomposition } from "./gates.js";
import { createProjectEvent, type ProjectLoopPhase, writeProjectEvent } from "./project-events.js";
import { getSkillPrompt, getWorkflowPrompt, selectAgents } from "./skill-registry.js";
import { spawnParallelAgents, spawnSubAgent } from "./sub-agent.js";
import type { TddTask } from "./tdd-loop.js";
import { tddLoop } from "./tdd-loop.js";
import type { AgentContext, AgentLoopConfig, AgentMessage } from "./types.js";

export interface ProjectLoopOptions {
	goal: string;
	cwd: string;
	config: AgentLoopConfig;
	/** Pre-decomposed tasks; if set, PLAN phase is skipped for task list. */
	tasks?: TddTask[];
	contextExtras?: Partial<Pick<AgentContext, "tools">>;
	iterations?: number;
	maxTasks?: number;
	signal?: AbortSignal;
	eventsPath?: string;
	onEvent?: (phase: ProjectLoopPhase, payload?: Record<string, unknown>) => void;
}

const DEFAULT_ITERATIONS = 1;
const DEFAULT_MAX_TASKS = 20;
const COMPOUND_EVERY_N_TASKS = 5;

function userMessage(text: string): AgentMessage {
	return {
		role: "user",
		content: [{ type: "text", text }],
		timestamp: Date.now(),
	};
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

/**
 * Naive parse of plan output for task list. Looks for "- Title" / "Acceptance criteria:" blocks or JSON.
 */
function parseTasksFromPlanOutput(planText: string): TddTask[] {
	const tasks: TddTask[] = [];
	// Try JSON array first
	const jsonMatch = planText.match(/\[[\s\S]*?\{[\s\S]*?"title"[\s\S]*?\}[\s\S]*?\]/);
	if (jsonMatch) {
		try {
			const arr = JSON.parse(jsonMatch[0]) as {
				title: string;
				acceptanceCriteria?: string[];
				description?: string;
			}[];
			for (const t of arr) {
				tasks.push({
					title: t.title ?? "Untitled",
					description: t.description,
					acceptanceCriteria: Array.isArray(t.acceptanceCriteria) ? t.acceptanceCriteria : [],
				});
			}
			return tasks;
		} catch {
			// fall through
		}
	}
	// Markdown list: "### Task N: Title" or "- **Title**" followed by acceptance criteria
	const lines = planText.split(/\r?\n/);
	let current: Partial<TddTask> = {};
	for (const line of lines) {
		const titleMatch = line.match(/^#+\s*(?:Task\s+\d+:\s*)?(.+)$/) || line.match(/^[-*]\s+\*\*(.+)\*\*/);
		if (titleMatch) {
			if (current.title) {
				tasks.push({
					title: current.title,
					description: current.description,
					acceptanceCriteria: current.acceptanceCriteria ?? [],
				});
			}
			current = { title: titleMatch[1].trim(), acceptanceCriteria: [] };
			continue;
		}
		if (current.title && /acceptance\s+criteria/i.test(line)) {
			// next lines until blank or next heading are criteria
			continue;
		}
		if (current.title && line.trim().startsWith("-")) {
			if (!current.acceptanceCriteria) current.acceptanceCriteria = [];
			current.acceptanceCriteria.push(line.replace(/^\s*-\s*/, "").trim());
		}
	}
	if (current.title) {
		tasks.push({
			title: current.title,
			description: current.description,
			acceptanceCriteria: current.acceptanceCriteria ?? [],
		});
	}
	return tasks;
}

function runPhaseWithPrompt(
	systemPrompt: string,
	userText: string,
	baseContext: Omit<AgentContext, "systemPrompt" | "messages">,
	config: AgentLoopConfig,
	signal?: AbortSignal,
): Promise<AgentMessage[]> {
	const ctx: AgentContext = { ...baseContext, systemPrompt, messages: [] };
	const stream = agentLoop([userMessage(userText)], ctx, config, signal);
	return stream.result();
}

/**
 * Run the full project loop for a goal. Returns when done or failed.
 */
export async function projectLoop(options: ProjectLoopOptions): Promise<void> {
	const { goal, cwd, config, tasks: preDecomposedTasks, contextExtras, signal, onEvent } = options;
	const iterations = options.iterations ?? DEFAULT_ITERATIONS;
	const maxTasks = options.maxTasks ?? DEFAULT_MAX_TASKS;
	const eventsPath = options.eventsPath ?? `${cwd}/events.jsonl`;
	const baseContext: Omit<AgentContext, "systemPrompt" | "messages"> = { ...contextExtras };

	const emit = (phase: ProjectLoopPhase, payload?: Record<string, unknown>) => {
		writeProjectEvent(eventsPath, createProjectEvent(phase, { payload }));
		onEvent?.(phase, payload);
	};

	for (let iteration = 1; iteration <= iterations; iteration++) {
		emit("brooks_iteration", { iteration });

		// BRAINSTORM
		emit("brainstorm");
		const brainstormPrompt =
			getSkillPrompt("brainstorming") ?? "Explore the problem space and propose 2–3 approaches. Apply YAGNI.";
		await runPhaseWithPrompt(brainstormPrompt, goal, baseContext, config, signal);

		// PLAN
		emit("plan");
		let tasks: TddTask[] = preDecomposedTasks ?? [];
		if (tasks.length === 0) {
			const planPrompt =
				getWorkflowPrompt("workflows:plan") ??
				getWorkflowPrompt("workflows-plan") ??
				"Decompose the goal into up to 20 tasks with explicit acceptance criteria. Output a structured list (markdown or JSON).";
			const planMessages = await runPhaseWithPrompt(planPrompt, goal, baseContext, config, signal);
			const planText = lastAssistantText(planMessages);
			tasks = parseTasksFromPlanOutput(planText);
			const decompResult = validateDecomposition(tasks);
			if (!decompResult.passed) {
				emit("fail", { diagnostics: decompResult.diagnostics });
				return;
			}
		}
		tasks = tasks.slice(0, maxTasks);

		// WORK + REVIEW + COMPOUND (every N tasks)
		for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
			emit("work", { taskIndex });
			const task = tasks[taskIndex];
			if (!task) continue;
			const tddResult = await tddLoop(task, {
				cwd,
				config,
				contextExtras,
				signal,
				maxRedoRounds: 1,
			});
			if (tddResult.state === "fail") {
				emit("fail", { taskIndex, reviewOutcome: tddResult.reviewOutcome });
				return;
			}
			if (tddResult.state === "done") {
				try {
					execSync("git add -A", { cwd, encoding: "utf-8" });
					execSync(`git commit -m ${JSON.stringify(`task: ${task.title}`)}`, { cwd, encoding: "utf-8" });
				} catch {
					// ignore commit failures
				}
			}
			// REVIEW (after each task approved)
			emit("review", { taskIndex });
			const reviewAgents = selectAgents({ phase: "review" });
			if (reviewAgents.length > 0) {
				const prompts = reviewAgents.map(
					() => `Review the recent change for task: ${task.title}. Focus on correctness and clarity.`,
				);
				await spawnParallelAgents(reviewAgents, prompts, baseContext, config, { signal, concurrency: 5 });
			}
			// COMPOUND every N tasks
			if ((taskIndex + 1) % COMPOUND_EVERY_N_TASKS === 0) {
				emit("compound", { taskIndex });
				const compoundPrompt = getSkillPrompt("compound-docs") ?? "Deduplicate and index learnings.";
				await runPhaseWithPrompt(compoundPrompt, "Compact recent learnings.", baseContext, config, signal);
			}
		}

		// INTEGRATE
		emit("integrate");
		const greenResult = greenGate(cwd);
		if (!greenResult.passed) {
			emit("fail", { output: greenResult.output });
			return;
		}
		const integrateAgents = selectAgents({ phase: "integrate" });
		for (const agentDef of integrateAgents.slice(0, 2)) {
			await spawnSubAgent(agentDef, "Final holistic review of the project.", baseContext, config, { signal });
		}

		if (iteration < iterations) {
			try {
				execSync(`git tag iteration-${iteration}-complete`, { cwd, encoding: "utf-8" });
				execSync("git checkout .", { cwd, encoding: "utf-8" });
			} catch {
				// ignore
			}
		}
	}

	emit("done");
}
