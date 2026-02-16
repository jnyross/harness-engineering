#!/usr/bin/env node
/**
 * Single-task TDD runner. Usage:
 *   npx tsx packages/agent/src/runner.ts "Add a hello() function..."
 * Env: PI_TEST_COMMAND, PI_MAX_REDO_ROUNDS, PI_PROVIDER, PI_MODEL (optional).
 */

import type { Message } from "@mariozechner/pi-ai";
import { getModel } from "@mariozechner/pi-ai";
import { tddLoop } from "./tdd-loop.js";
import type { AgentLoopConfig, AgentMessage } from "./types.js";

const provider = process.env.PI_PROVIDER ?? "minimax";
const modelId = process.env.PI_MODEL ?? "MiniMax-M2.5";
const maxRedoRounds = parseInt(process.env.PI_MAX_REDO_ROUNDS ?? "1", 10);

function identityConvert(messages: AgentMessage[]): Message[] {
	return messages.filter((m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult");
}

function main(): void {
	const args = process.argv.slice(2);
	const taskDescription = args.join(" ").trim();
	if (!taskDescription) {
		console.error('Usage: runner.ts "<task description>"');
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

main();
