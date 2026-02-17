#!/usr/bin/env node
/**
 * Single-task TDD runner. Usage:
 *   npx tsx packages/agent/src/runner.ts "Add a hello() function..."
 * Env: PI_TEST_COMMAND, PI_MAX_REDO_ROUNDS, PI_PROVIDER, PI_MODEL (optional).
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Message } from "@mariozechner/pi-ai";
import { getModel } from "@mariozechner/pi-ai";
import { parsePositiveIntegerOption } from "./cli-number.js";
import { tddLoop } from "./tdd-loop.js";
import type { AgentLoopConfig, AgentMessage } from "./types.js";

const provider = process.env.PI_PROVIDER ?? "minimax";
const modelId = process.env.PI_MODEL ?? "MiniMax-M2.5";

function identityConvert(messages: AgentMessage[]): Message[] {
	return messages.filter((m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult");
}

export function parseRunnerArgs(args: string[]): { taskDescription: string } {
	return { taskDescription: args.join(" ").trim() };
}

function main(): void {
	const parsed = parseRunnerArgs(process.argv.slice(2));
	const taskDescription = parsed.taskDescription;
	if (!taskDescription) {
		console.error('Usage: runner.ts "<task description>"');
		process.exit(1);
	}
	let maxRedoRounds = 1;
	try {
		maxRedoRounds = parsePositiveIntegerOption({
			value: process.env.PI_MAX_REDO_ROUNDS,
			fallback: 1,
			optionName: "PI_MAX_REDO_ROUNDS",
		});
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}

	// Provider/model from env; pi-ai expects KnownProvider and model id from registry
	const model = getModel(provider as Parameters<typeof getModel>[0], modelId as Parameters<typeof getModel>[1]);
	if (!model) {
		console.error(`Model not found: ${provider}/${modelId}. Set PI_PROVIDER and PI_MODEL.`);
		process.exit(1);
	}

	const config: AgentLoopConfig = {
		model,
		convertToLlm: identityConvert,
	};

	const task = {
		title: taskDescription.slice(0, 80),
		description: taskDescription,
		acceptanceCriteria: [taskDescription],
	};

	const cwd = process.cwd();

	tddLoop(task, {
		cwd,
		config,
		maxRedoRounds,
		onEvent: (e) => {
			if (e.state === "done" || e.state === "fail") {
				console.log(`TDD loop finished: ${e.state}`);
			}
		},
	})
		.then((result) => {
			if (result.state === "fail") process.exit(1);
		})
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
	main();
}
