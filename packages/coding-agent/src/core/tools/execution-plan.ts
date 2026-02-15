import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import { readFile as fsReadFile, writeFile as fsWriteFile } from "fs/promises";
import { join } from "path";

const EXECUTION_PLAN_FILENAME = "EXECUTION_PLAN.md";

const createPlanSchema = Type.Object({
	tasks: Type.Array(Type.String(), { description: "List of tasks to include in the plan" }),
});

const updateProgressSchema = Type.Object({
	task_index: Type.Number({ description: "Index of the task to update (0-based)" }),
	status: Type.Enum(
		{ completed: "completed", in_progress: "in_progress", blocked: "blocked" },
		{
			description: "New status for the task",
		},
	),
});

const getPlanSchema = Type.Object({});

const validatePlanSchema = Type.Object({});

export type CreatePlanInput = Static<typeof createPlanSchema>;
export type UpdateProgressInput = Static<typeof updateProgressSchema>;
export type GetPlanInput = Static<typeof getPlanSchema>;
export type ValidatePlanInput = Static<typeof validatePlanSchema>;

export interface ExecutionPlanDetails {}

export interface ExecutionPlanTask {
	description: string;
	status: "pending" | "in_progress" | "completed" | "blocked";
}

export interface ExecutionPlan {
	created_at: string;
	tasks: ExecutionPlanTask[];
}

export interface PlanToolOptions {
	operations?: PlanOperations;
}

export interface PlanOperations {
	readFile: (absolutePath: string) => Promise<string>;
	writeFile: (absolutePath: string, content: string) => Promise<void>;
	fileExists: (absolutePath: string) => Promise<boolean>;
}

const defaultPlanOperations: PlanOperations = {
	readFile: (path) => fsReadFile(path, "utf-8"),
	writeFile: (path, content) => fsWriteFile(path, content, "utf-8"),
	fileExists: async (path) => {
		try {
			await fsReadFile(path, "utf-8");
			return true;
		} catch {
			return false;
		}
	},
};

function formatPlan(plan: ExecutionPlan): string {
	const lines: string[] = [`# Execution Plan`, ``, `*Created: ${plan.created_at}*`, ``];

	for (let i = 0; i < plan.tasks.length; i++) {
		const task = plan.tasks[i];
		const checkbox = task.status === "completed" ? "[x]" : "[ ]";
		const statusLabel =
			task.status === "in_progress" ? " *(in progress)*" : task.status === "blocked" ? " *(blocked)*" : "";
		lines.push(`${checkbox} ${i + 1}. ${task.description}${statusLabel}`);
	}

	return lines.join("\n");
}

function parsePlan(content: string): ExecutionPlan | null {
	const lines = content.split("\n");
	const tasks: ExecutionPlanTask[] = [];

	const createdMatch = content.match(/\*Created: (.+)\*/);
	const created_at = createdMatch ? createdMatch[1] : new Date().toISOString();

	for (const line of lines) {
		const match = line.match(/^(- \[([ x])\]|\d+\. \[([ x])\])\s+(.+)$/);
		if (match) {
			const checked = match[2] || match[3];
			const description = match[4].replace(/\s*\*(in progress|blocked)\*$/, "").trim();
			let status: ExecutionPlanTask["status"] = "pending";
			if (checked === "x") {
				status = "completed";
			}
			if (line.includes("*(in progress)*")) {
				status = "in_progress";
			}
			if (line.includes("*(blocked)*")) {
				status = "blocked";
			}
			tasks.push({ description, status });
		}
	}

	if (tasks.length === 0) return null;
	return { created_at, tasks };
}

export function createExecutionPlanTool(cwd: string, options?: PlanToolOptions): AgentTool {
	const ops = options?.operations ?? defaultPlanOperations;
	const planPath = join(cwd, EXECUTION_PLAN_FILENAME);

	return {
		name: "create_execution_plan",
		label: "create_execution_plan",
		description:
			"Create a new execution plan as a markdown checklist. Use this when starting a complex task to track progress.",
		parameters: createPlanSchema,
		execute: async (_toolCallId: string, params: unknown, _signal?: AbortSignal) => {
			const { tasks } = params as CreatePlanInput;
			const plan: ExecutionPlan = {
				created_at: new Date().toISOString(),
				tasks: tasks.map((description) => ({ description, status: "pending" })),
			};

			await ops.writeFile(planPath, formatPlan(plan));

			const content: TextContent[] = [
				{
					type: "text",
					text: `Created execution plan with ${tasks.length} tasks:\n\n${tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
				},
			];

			return { content, details: {} as ExecutionPlanDetails };
		},
	};
}

export function createUpdateProgressTool(cwd: string, options?: PlanToolOptions): AgentTool {
	const ops = options?.operations ?? defaultPlanOperations;
	const planPath = join(cwd, EXECUTION_PLAN_FILENAME);

	return {
		name: "update_plan_progress",
		label: "update_plan_progress",
		description: "Update the progress of a task in the execution plan. Use the 0-based index.",
		parameters: updateProgressSchema,
		execute: async (_toolCallId: string, params: unknown, _signal?: AbortSignal) => {
			const { task_index, status } = params as UpdateProgressInput;
			const exists = await ops.fileExists(planPath);
			if (!exists) {
				throw new Error("No execution plan found. Create one first with create_execution_plan.");
			}

			const fileContent = await ops.readFile(planPath);
			const plan = parsePlan(fileContent);
			if (!plan) {
				throw new Error("Failed to parse execution plan");
			}

			if (task_index < 0 || task_index >= plan.tasks.length) {
				throw new Error(`Invalid task index: ${task_index}. Plan has ${plan.tasks.length} tasks.`);
			}

			plan.tasks[task_index].status = status as ExecutionPlanTask["status"];
			await ops.writeFile(planPath, formatPlan(plan));

			const task = plan.tasks[task_index];
			const statusText = status === "completed" ? "completed" : status === "in_progress" ? "in progress" : "blocked";

			const outputContent: TextContent[] = [
				{
					type: "text",
					text: `Updated task ${task_index + 1} to "${statusText}": ${task.description}`,
				},
			];

			return { content: outputContent, details: {} as ExecutionPlanDetails };
		},
	};
}

export function createGetPlanTool(cwd: string, options?: PlanToolOptions): AgentTool {
	const ops = options?.operations ?? defaultPlanOperations;
	const planPath = join(cwd, EXECUTION_PLAN_FILENAME);

	return {
		name: "get_execution_plan",
		label: "get_execution_plan",
		description: "Get the current execution plan with all tasks and their status.",
		parameters: getPlanSchema,
		execute: async () => {
			const exists = await ops.fileExists(planPath);
			if (!exists) {
				const content: TextContent[] = [
					{
						type: "text",
						text: "No execution plan found. Create one first with create_execution_plan.",
					},
				];
				return { content, details: {} };
			}

			const content = await ops.readFile(planPath);
			const outputContent: TextContent[] = [
				{
					type: "text",
					text: content,
				},
			];

			return { content: outputContent, details: {} };
		},
	};
}

export function createValidatePlanTool(cwd: string, options?: PlanToolOptions): AgentTool {
	const ops = options?.operations ?? defaultPlanOperations;
	const planPath = join(cwd, EXECUTION_PLAN_FILENAME);

	return {
		name: "validate_execution_plan",
		label: "validate_execution_plan",
		description: "Validate that the execution plan is well-formed and check for any issues.",
		parameters: validatePlanSchema,
		execute: async () => {
			const exists = await ops.fileExists(planPath);
			if (!exists) {
				const content: TextContent[] = [
					{
						type: "text",
						text: "No execution plan found. Create one first with create_execution_plan.",
					},
				];
				return { content, details: {} };
			}

			const content = await ops.readFile(planPath);
			const plan = parsePlan(content);

			if (!plan) {
				const errorContent: TextContent[] = [
					{
						type: "text",
						text: "Execution plan is invalid: could not parse any tasks.",
					},
				];
				return { content: errorContent, details: {} };
			}

			const completedCount = plan.tasks.filter((t) => t.status === "completed").length;
			const blockedCount = plan.tasks.filter((t) => t.status === "blocked").length;

			const outputContent: TextContent[] = [
				{
					type: "text",
					text: `Execution plan is valid.\n\nTotal tasks: ${plan.tasks.length}\nCompleted: ${completedCount}\nIn progress: ${plan.tasks.filter((t) => t.status === "in_progress").length}\nBlocked: ${blockedCount}\nPending: ${plan.tasks.filter((t) => t.status === "pending").length}`,
				},
			];

			return { content: outputContent, details: {} };
		},
	};
}

export type ExecutionPlanTool = AgentTool;

export interface ExecutionPlanTools {
	create: AgentTool;
	updateProgress: AgentTool;
	getPlan: AgentTool;
	validatePlan: AgentTool;
}

export function createExecutionPlanTools(cwd: string, options?: PlanToolOptions): ExecutionPlanTools {
	return {
		create: createExecutionPlanTool(cwd, options),
		updateProgress: createUpdateProgressTool(cwd, options),
		getPlan: createGetPlanTool(cwd, options),
		validatePlan: createValidatePlanTool(cwd, options),
	};
}
