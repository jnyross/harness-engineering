import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Message, Model } from "@mariozechner/pi-ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentContext, AgentLoopConfig, AgentMessage } from "../src/types.js";

const { agentLoopMock } = vi.hoisted(() => ({
	agentLoopMock: vi.fn(),
}));

vi.mock("../src/agent-loop.js", () => ({
	agentLoop: agentLoopMock,
}));

import { ExecutionEngine } from "../src/execution-engine.js";

function createUsage() {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

function createModel(): Model<"openai-responses"> {
	return {
		id: "mock",
		name: "mock",
		api: "openai-responses",
		provider: "openai",
		baseUrl: "https://example.invalid",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 8192,
		maxTokens: 2048,
	};
}

function identityConverter(messages: AgentMessage[]): Message[] {
	return messages.filter((m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult") as Message[];
}

function createUserMessage(text: string): AgentMessage {
	return {
		role: "user",
		content: text,
		timestamp: Date.now(),
	};
}

function createAssistantTextMessage(text: string): AgentMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-responses",
		provider: "openai",
		model: "mock",
		usage: createUsage(),
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

function createAssistantToolCallMessage(): AgentMessage {
	return {
		role: "assistant",
		content: [{ type: "toolCall", id: "tool-1", name: "bash", arguments: { command: "echo hi" } }],
		api: "openai-responses",
		provider: "openai",
		model: "mock",
		usage: createUsage(),
		stopReason: "toolUse",
		timestamp: Date.now(),
	};
}

function mockLoopResult(messages: AgentMessage[]): void {
	agentLoopMock.mockReturnValueOnce({
		result: async () => messages,
	});
}

describe("ExecutionEngine review flow", () => {
	let tempDir: string;
	let config: AgentLoopConfig;
	let context: AgentContext;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "execution-engine-test-"));
		writeFileSync(join(tempDir, "EXECUTION_PLAN.md"), "# Plan\n\n- do task\n", "utf-8");
		agentLoopMock.mockReset();

		config = {
			model: createModel(),
			convertToLlm: identityConverter,
		};
		context = {
			systemPrompt: "",
			messages: [],
			tools: [],
		};
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("approves when reviewer returns explicit approved verdict", async () => {
		const engine = new ExecutionEngine({
			cwd: tempDir,
			reviewConfig: { enabled: true, maxRetries: 1 },
		});
		await engine.initialize();

		mockLoopResult([createAssistantToolCallMessage()]);
		mockLoopResult([createAssistantTextMessage("VERDICT: approved")]);

		const result = await engine.runWithReview([createUserMessage("do task")], context, config);

		expect(result.approved).toBe(true);
		expect(result.messages).toHaveLength(1);
		expect(agentLoopMock).toHaveBeenCalledTimes(2);
		expect(engine.getRetryCount()).toBe(1);
	});

	it("retries with reviewer feedback before approving", async () => {
		const engine = new ExecutionEngine({
			cwd: tempDir,
			reviewConfig: { enabled: true, maxRetries: 2 },
		});
		await engine.initialize();

		mockLoopResult([createAssistantToolCallMessage()]);
		mockLoopResult([createAssistantTextMessage("VERDICT: needs_fixes\nReason: missing tests")]);
		mockLoopResult([createAssistantTextMessage("I added tests")]);
		mockLoopResult([createAssistantTextMessage("VERDICT: approved")]);

		const result = await engine.runWithReview([createUserMessage("do task")], context, config);

		expect(result.approved).toBe(true);
		expect(agentLoopMock).toHaveBeenCalledTimes(4);
		expect(engine.getRetryCount()).toBe(2);

		const retryPrompts = agentLoopMock.mock.calls[2]?.[0] as AgentMessage[];
		expect(retryPrompts).toHaveLength(1);
		if (retryPrompts[0]?.role === "user" && Array.isArray(retryPrompts[0].content)) {
			expect(retryPrompts[0].content[0]?.type).toBe("text");
			if (retryPrompts[0].content[0]?.type === "text") {
				expect(retryPrompts[0].content[0].text).toContain("missing tests");
			}
		}
	});

	it("returns rejected result when reviewer produces no assistant text", async () => {
		const engine = new ExecutionEngine({
			cwd: tempDir,
			reviewConfig: { enabled: true, maxRetries: 1 },
		});
		await engine.initialize();

		mockLoopResult([createAssistantToolCallMessage()]);
		mockLoopResult([]);

		const result = await engine.runWithReview([createUserMessage("do task")], context, config);

		expect(result.approved).toBe(false);
		expect(agentLoopMock).toHaveBeenCalledTimes(2);
	});
});
