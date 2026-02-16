import { appendFile as fsAppendFile, readFile as fsReadFile, writeFile as fsWriteFile } from "fs/promises";
import { join } from "path";

const DECISION_LOG_FILENAME = "DECISION_LOG.md";

export interface DecisionLogEntry {
	timestamp: string;
	attempt: number;
	status: "APPROVED" | "REJECTED";
	reason?: string;
	work_summary?: string;
}

export interface DecisionLogOptions {
	operations?: DecisionLogOperations;
}

export interface DecisionLogOperations {
	readFile: (absolutePath: string) => Promise<string>;
	writeFile: (absolutePath: string, content: string) => Promise<void>;
	appendFile: (absolutePath: string, content: string) => Promise<void>;
	fileExists: (absolutePath: string) => Promise<boolean>;
}

const defaultDecisionLogOperations: DecisionLogOperations = {
	readFile: (path) => fsReadFile(path, "utf-8"),
	writeFile: (path, content) => fsWriteFile(path, content, "utf-8"),
	appendFile: (path, content) => fsAppendFile(path, content, "utf-8"),
	fileExists: async (path) => {
		try {
			await fsReadFile(path, "utf-8");
			return true;
		} catch {
			return false;
		}
	},
};

function formatDecisionEntry(entry: DecisionLogEntry): string {
	const lines = [`## ${entry.timestamp}`, ``, `### Attempt ${entry.attempt} - ${entry.status}`];

	if (entry.reason) {
		lines.push(`**Reason**: ${entry.reason}`);
	}

	if (entry.work_summary) {
		lines.push(``, `**Work Summary**:`, entry.work_summary);
	}

	return lines.join("\n");
}

export class DecisionLogger {
	private ops: DecisionLogOperations;
	private decisionPath: string;
	private currentAttempt: number = 0;

	constructor(cwd: string, options?: DecisionLogOptions) {
		this.ops = options?.operations ?? defaultDecisionLogOperations;
		this.decisionPath = join(cwd, DECISION_LOG_FILENAME);
	}

	async initialize(): Promise<void> {
		const exists = await this.ops.fileExists(this.decisionPath);
		if (!exists) {
			await this.ops.writeFile(
				this.decisionPath,
				`# Decision Log

*This log tracks review decisions for execution plan validation*

`,
			);
		}
	}

	async logDecision(result: { approved: boolean; reason?: string; work_summary?: string }): Promise<void> {
		this.currentAttempt++;

		const entry: DecisionLogEntry = {
			timestamp: new Date().toISOString(),
			attempt: this.currentAttempt,
			status: result.approved ? "APPROVED" : "REJECTED",
			reason: result.reason,
			work_summary: result.work_summary,
		};

		const content = formatDecisionEntry(entry);
		await this.ops.appendFile(this.decisionPath, `${content}\n\n`);
	}

	async getLog(): Promise<string> {
		const exists = await this.ops.fileExists(this.decisionPath);
		if (!exists) {
			return "No decision log found.";
		}
		return this.ops.readFile(this.decisionPath);
	}

	getAttemptCount(): number {
		return this.currentAttempt;
	}

	reset(): void {
		this.currentAttempt = 0;
	}
}
