/**
 * Sub-agent spawning: run an agent with a specific system prompt and task,
 * optionally in parallel with other agents. Supports inline (awaited) and
 * background (fire-and-forget with result collection) modes.
 */

import { spawn as nodeSpawn } from "node:child_process";
import { agentLoop } from "./agent-loop.js";
import type { AgentDefinition } from "./skill-registry.js";
import type { AgentContext, AgentLoopConfig, AgentMessage } from "./types.js";

export interface SpawnSubAgentOptions {
	signal?: AbortSignal;
	/** If true, do not await; return a promise that resolves when done. */
	background?: boolean;
}

export interface SpawnParallelAgentsOptions {
	signal?: AbortSignal;
	/** Max concurrency; default 5. */
	concurrency?: number;
}

/**
 * Build a user message from a string prompt (text content).
 */
function promptToMessage(prompt: string): AgentMessage {
	return {
		role: "user",
		content: [{ type: "text", text: prompt }],
		timestamp: Date.now(),
	};
}

/**
 * Run a single sub-agent: agentLoop with the agent's system prompt and the given task.
 * Returns the final messages from the stream.
 */
export async function spawnSubAgent(
	agentDef: AgentDefinition,
	userPrompt: string,
	baseContext: Omit<AgentContext, "systemPrompt" | "messages">,
	config: AgentLoopConfig,
	options: SpawnSubAgentOptions = {},
): Promise<AgentMessage[]> {
	const context: AgentContext = {
		...baseContext,
		systemPrompt: agentDef.systemPrompt,
		messages: [],
	};
	const prompts: AgentMessage[] = [promptToMessage(userPrompt)];
	const stream = agentLoop(prompts, context, config, options.signal);
	const messages = await stream.result();
	return messages;
}

/**
 * Run multiple sub-agents in parallel. Each agent gets the corresponding prompt.
 * Returns an array of final message arrays in the same order as agentDefs.
 */
export async function spawnParallelAgents(
	agentDefs: AgentDefinition[],
	userPrompts: string[],
	baseContext: Omit<AgentContext, "systemPrompt" | "messages">,
	config: AgentLoopConfig,
	options: SpawnParallelAgentsOptions = {},
): Promise<AgentMessage[][]> {
	const concurrency = options.concurrency ?? 5;
	const results: AgentMessage[][] = [];
	const signal = options.signal;

	// Run in batches of concurrency
	for (let i = 0; i < agentDefs.length; i += concurrency) {
		const batch = agentDefs.slice(i, i + concurrency);
		const batchPrompts = userPrompts.slice(i, i + concurrency);
		const batchResults = await Promise.all(
			batch.map((def, j) => spawnSubAgent(def, batchPrompts[j] ?? "", baseContext, config, { signal })),
		);
		results.push(...batchResults);
	}
	return results;
}

/**
 * Spawn a subprocess to run an arbitrary script (e.g. npx tsx some-script.ts).
 * Use when a dedicated process is more appropriate than an LLM call.
 * Returns stdout + stderr and exit code.
 */
export function spawnScript(
	command: string,
	args: string[] = [],
	options: { cwd?: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
	if (options.signal?.aborted) {
		return Promise.reject(new DOMException("Aborted", "AbortError"));
	}

	return new Promise((resolve, reject) => {
		const child = nodeSpawn(command, args, {
			cwd: options.cwd ?? process.cwd(),
			env: { ...process.env, ...options.env },
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let settled = false;
		child.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		const timeoutMs = options.timeoutMs;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const onAbort = () => {
			child.kill("SIGTERM");
			rejectOnce(new DOMException("Aborted", "AbortError"));
		};

		const cleanup = () => {
			if (timeoutId) clearTimeout(timeoutId);
			options.signal?.removeEventListener("abort", onAbort);
		};

		const resolveOnce = (value: { stdout: string; stderr: string; exitCode: number | null }) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve(value);
		};

		const rejectOnce = (error: unknown) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			reject(error);
		};

		if (timeoutMs) {
			timeoutId = setTimeout(() => {
				child.kill("SIGTERM");
				rejectOnce(new Error(`Script timed out after ${timeoutMs}ms`));
			}, timeoutMs);
		}
		options.signal?.addEventListener("abort", onAbort, { once: true });
		child.on("error", (err) => {
			rejectOnce(err);
		});
		child.on("close", (code, _sig) => {
			resolveOnce({ stdout, stderr, exitCode: code });
		});
	});
}
