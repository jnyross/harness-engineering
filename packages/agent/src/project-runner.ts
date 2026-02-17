#!/usr/bin/env node
/**
 * Project runner with Brooks Loop. Usage:
 *   npx tsx packages/agent/src/project-runner.ts [--iterations N] [--max-tasks N] [--provider <name>] "<goal>"
 * Env: PI_PROVIDER, PI_MODEL (optional). Default provider: minimax.
 */

import type { Message } from "@mariozechner/pi-ai";
import { getModel } from "@mariozechner/pi-ai";
import { parsePositiveIntegerOption } from "./cli-number.js";
import { projectLoop } from "./project-loop.js";
import type { AgentLoopConfig, AgentMessage } from "./types.js";

const provider = process.env.PI_PROVIDER ?? "minimax";
const modelId = process.env.PI_MODEL ?? "MiniMax-M2.5";

function identityConvert(messages: AgentMessage[]): Message[] {
	return messages.filter((m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult");
}

function parseArgs(): { goal: string; iterations: number; maxTasks: number; providerOverride?: string } {
	const args = process.argv.slice(2);
	let iterations = 1;
	let maxTasks = 20;
	let providerOverride: string | undefined;
	const rest: string[] = [];
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--iterations") {
			const optionValue = args[i + 1];
			if (optionValue === undefined) {
				throw new Error("--iterations requires a value");
			}
			iterations = parsePositiveIntegerOption({
				value: optionValue,
				fallback: 1,
				optionName: "--iterations",
			});
			i++;
		} else if (args[i] === "--max-tasks") {
			const optionValue = args[i + 1];
			if (optionValue === undefined) {
				throw new Error("--max-tasks requires a value");
			}
			maxTasks = parsePositiveIntegerOption({
				value: optionValue,
				fallback: 20,
				optionName: "--max-tasks",
			});
			i++;
		} else if (args[i] === "--provider") {
			const optionValue = args[i + 1];
			if (optionValue === undefined) {
				throw new Error("--provider requires a value");
			}
			providerOverride = optionValue;
			i++;
		} else {
			rest.push(args[i]);
		}
	}
	const goal = rest.join(" ").trim();
	return { goal, iterations, maxTasks, providerOverride };
}

function main(): void {
	let goal = "";
	let iterations = 1;
	let maxTasks = 20;
	let providerOverride: string | undefined;
	try {
		const parsed = parseArgs();
		goal = parsed.goal;
		iterations = parsed.iterations;
		maxTasks = parsed.maxTasks;
		providerOverride = parsed.providerOverride;
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
	if (!goal) {
		console.error('Usage: project-runner.ts [--iterations N] [--max-tasks N] [--provider <name>] "<goal>"');
		process.exit(1);
	}

	const p = providerOverride ?? provider;
	// Provider/model from env; pi-ai expects KnownProvider and model id from registry
	const model = getModel(p as Parameters<typeof getModel>[0], modelId as Parameters<typeof getModel>[1]);
	if (!model) {
		console.error(`Model not found: ${p}/${modelId}. Set PI_PROVIDER and PI_MODEL.`);
		process.exit(1);
	}

	const config: AgentLoopConfig = {
		model,
		convertToLlm: identityConvert,
	};

	const cwd = process.cwd();

	projectLoop({
		goal,
		cwd,
		config,
		iterations,
		maxTasks,
		onEvent: (phase) => {
			console.log(`Project phase: ${phase}`);
		},
	})
		.then(() => {
			console.log("Project loop done.");
		})
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}

main();
