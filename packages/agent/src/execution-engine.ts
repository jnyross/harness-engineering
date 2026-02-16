import type { AssistantMessage, ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import { readFile as fsReadFile } from "fs/promises";
import { join } from "path";
import { agentLoop } from "./agent-loop.js";
import { DecisionLogger } from "./decision-log.js";
import { createReviewerPrompt, type ReviewInput } from "./reviewer.js";
import type { AgentContext, AgentLoopConfig, AgentMessage } from "./types.js";

export interface ReviewConfig {
	enabled: boolean;
	maxRetries: number;
	planPath: string;
	onReviewResult?: (result: { approved: boolean; reason?: string }) => void;
}

export interface ExecutionEngineOptions {
	cwd: string;
	reviewConfig?: Partial<ReviewConfig>;
}

const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
	enabled: true,
	maxRetries: 3,
	planPath: "EXECUTION_PLAN.md",
};

export class ExecutionEngine {
	private cwd: string;
	private reviewConfig: ReviewConfig;
	private decisionLogger: DecisionLogger;
	private retryCount: number = 0;

	constructor(options: ExecutionEngineOptions) {
		this.cwd = options.cwd;
		this.reviewConfig = { ...DEFAULT_REVIEW_CONFIG, ...options.reviewConfig };
		this.decisionLogger = new DecisionLogger(this.cwd);
	}

	async initialize(): Promise<void> {
		await this.decisionLogger.initialize();
	}

	async runWithReview(
		prompts: AgentMessage[],
		context: AgentContext,
		config: AgentLoopConfig,
		signal?: AbortSignal,
	): Promise<{ messages: AgentMessage[]; approved: boolean }> {
		if (!this.reviewConfig.enabled) {
			const stream = agentLoop(prompts, context, config, signal);
			const messages = await stream.result();
			return { messages, approved: true };
		}

		let lastMessages: AgentMessage[] = [];
		let approved = false;

		while (this.reviewConfig.maxRetries === -1 || this.retryCount < this.reviewConfig.maxRetries) {
			this.retryCount++;

			const stream = agentLoop(prompts, context, config, signal);
			lastMessages = await stream.result();

			const reviewResult = await this.runReview(lastMessages);

			await this.decisionLogger.logDecision({
				approved: reviewResult.approved,
				reason: reviewResult.reason,
			});

			this.reviewConfig.onReviewResult?.(reviewResult);

			if (reviewResult.approved) {
				approved = true;
				break;
			}

			const retryMessage: AgentMessage = {
				role: "user",
				content: [
					{
						type: "text",
						text: `Review feedback: ${reviewResult.reason}\n\nPlease address this feedback and try again.`,
					},
				],
				timestamp: Date.now(),
			};

			prompts = [retryMessage];
			context = {
				...context,
				messages: [...context.messages, retryMessage],
			};
		}

		return { messages: lastMessages, approved };
	}

	private async runReview(messages: AgentMessage[]): Promise<{ approved: boolean; reason?: string }> {
		let planContent = "";
		try {
			planContent = await fsReadFile(join(this.cwd, this.reviewConfig.planPath), "utf-8");
		} catch {
			planContent = "No plan file found.";
		}

		const workSummary = this.summarizeWork(messages);

		const reviewInput: ReviewInput = {
			plan_content: planContent,
			work_summary: workSummary,
		};

		const prompt = createReviewerPrompt(reviewInput);

		return {
			approved: false,
			reason: `Review not implemented - would call LLM with prompt:\n\n${prompt}`,
		};
	}

	private summarizeWork(messages: AgentMessage[]): string {
		const summaries: string[] = [];

		for (const message of messages) {
			if (message.role === "assistant") {
				const assistantMessage = message as unknown as AssistantMessage;
				const toolCalls = assistantMessage.content.filter((c) => c.type === "toolCall") as ToolCall[];
				if (toolCalls.length > 0) {
					for (const tc of toolCalls) {
						summaries.push(`- Called ${tc.name} with ${JSON.stringify(tc.arguments)}`);
					}
				}
			}
			if (message.role === "toolResult") {
				const toolMessage = message as unknown as ToolResultMessage;
				const text = toolMessage.content
					.filter((c) => c.type === "text")
					.map((c: { type: string; text: string }) => (c.type === "text" ? c.text : ""))
					.join("\n");
				if (text.length > 200) {
					summaries.push(`- Tool result: ${text.slice(0, 200)}...`);
				} else if (text.length > 0) {
					summaries.push(`- Tool result: ${text}`);
				}
			}
		}

		return summaries.join("\n") || "No tool calls made.";
	}

	getRetryCount(): number {
		return this.retryCount;
	}

	reset(): void {
		this.retryCount = 0;
		this.decisionLogger.reset();
	}
}
