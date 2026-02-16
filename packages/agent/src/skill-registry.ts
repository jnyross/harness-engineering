/**
 * Discovers and loads Compound Engineering prompts from the installed Pi plugin
 * directory (~/.pi/agent/), making them invocable programmatically.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PI_AGENT_HOME = process.env.PI_AGENT_HOME ?? join(homedir(), ".pi", "agent");

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
	const match = content.match(FRONTMATTER_REGEX);
	if (!match) {
		return { frontmatter: {}, body: content };
	}
	const [, yamlBlock, body] = match;
	const frontmatter: Record<string, string> = {};
	for (const line of (yamlBlock ?? "").split(/\r?\n/)) {
		const colon = line.indexOf(":");
		if (colon > 0) {
			const key = line.slice(0, colon).trim();
			const value = line
				.slice(colon + 1)
				.trim()
				.replace(/^["']|["']$/g, "");
			frontmatter[key] = value;
		}
	}
	return { frontmatter, body: body ?? content };
}

export interface SkillDefinition {
	name: string;
	category?: string;
	prompt: string;
	description: string;
	skillPath: string;
	applicabilityCheck?: (context: PhaseContext) => boolean;
}

export interface AgentDefinition {
	name: string;
	category: string;
	systemPrompt: string;
	description: string;
	agentPath: string;
}

export interface WorkflowDefinition {
	name: string;
	prompt: string;
	description: string;
	argumentHint?: string;
	workflowPath: string;
}

export interface PhaseContext {
	phase: ProjectPhase;
	fileTypes?: string[];
	hasDbMigrations?: boolean;
	projectLanguage?: string;
}

export type ProjectPhase = "brainstorm" | "plan" | "work" | "review" | "compound" | "integrate";

const AGENTS = new Map<string, AgentDefinition>();
const SKILLS = new Map<string, SkillDefinition>();
const WORKFLOWS = new Map<string, WorkflowDefinition>();

function discoverSkills(basePath: string): void {
	const skillsDir = join(basePath, "skills");
	if (!existsSync(skillsDir)) return;
	const entries = readdirSync(skillsDir, { withFileTypes: true });
	for (const ent of entries) {
		if (!ent.isDirectory()) continue;
		const skillPath = join(skillsDir, ent.name, "SKILL.md");
		if (!existsSync(skillPath)) continue;
		try {
			const content = readFileSync(skillPath, "utf-8");
			const { frontmatter, body } = parseFrontmatter(content);
			const name = (frontmatter.name ?? ent.name).trim();
			const description = (frontmatter.description ?? "").trim();
			SKILLS.set(name, {
				name,
				category: frontmatter.category,
				prompt: body.trim(),
				description,
				skillPath,
			});
			// Also register as agent for reviewer/research agents (same prompt, different usage)
			const category = inferCategory(ent.name);
			AGENTS.set(name, {
				name,
				category,
				systemPrompt: body.trim(),
				description,
				agentPath: skillPath,
			});
		} catch {
			// Skip unreadable skills
		}
	}
}

function inferCategory(dirName: string): string {
	if (
		[
			"security-sentinel",
			"performance-oracle",
			"architecture-strategist",
			"code-simplicity-reviewer",
			"pattern-recognition-specialist",
			"agent-native-reviewer",
			"data-integrity-guardian",
			"data-migration-expert",
			"deployment-verification-agent",
			"dhh-rails-reviewer",
			"julik-frontend-races-reviewer",
			"kieran-python-reviewer",
			"kieran-rails-reviewer",
			"kieran-typescript-reviewer",
			"schema-drift-detector",
		].includes(dirName)
	) {
		return "review";
	}
	if (
		[
			"best-practices-researcher",
			"framework-docs-researcher",
			"git-history-analyzer",
			"learnings-researcher",
			"repo-research-analyst",
		].includes(dirName)
	) {
		return "research";
	}
	if (["design-implementation-reviewer", "design-iterator", "figma-design-sync"].includes(dirName)) {
		return "design";
	}
	if (
		[
			"bug-reproduction-validator",
			"every-style-editor",
			"lint",
			"pr-comment-resolver",
			"spec-flow-analyzer",
		].includes(dirName)
	) {
		return "workflow";
	}
	if (["ankane-readme-writer"].includes(dirName)) return "docs";
	return "skill";
}

function discoverWorkflows(basePath: string): void {
	const promptsDir = join(basePath, "prompts");
	if (!existsSync(promptsDir)) return;
	const entries = readdirSync(promptsDir, { withFileTypes: true });
	for (const ent of entries) {
		if (!ent.isFile() || !ent.name.endsWith(".md")) continue;
		const workflowPath = join(promptsDir, ent.name);
		try {
			const content = readFileSync(workflowPath, "utf-8");
			const { frontmatter, body } = parseFrontmatter(content);
			// Store as workflows:plan for workflows-plan.md so lookup by "workflows:plan" or "workflows-plan" works
			const rawName = ent.name.replace(/\.md$/, "");
			const name = rawName.startsWith("workflows-") ? `workflows:${rawName.slice(10)}` : rawName;
			const description = (frontmatter.description ?? "").trim();
			const argumentHint = frontmatter["argument-hint"];
			WORKFLOWS.set(name, {
				name,
				prompt: body.trim(),
				description,
				argumentHint,
				workflowPath,
			});
		} catch {
			// Skip unreadable prompts
		}
	}
}

/**
 * Load (or reload) the registry from the Pi agent directory.
 * Call at startup; call again to hot-reload after CE plugin updates.
 */
export function loadRegistry(basePath: string = PI_AGENT_HOME): void {
	AGENTS.clear();
	SKILLS.clear();
	WORKFLOWS.clear();
	discoverSkills(basePath);
	discoverWorkflows(basePath);
}

// Load on first import
loadRegistry();

export function getAgentPrompt(name: string): string | undefined {
	return AGENTS.get(name)?.systemPrompt;
}

export function getSkillPrompt(name: string): string | undefined {
	return SKILLS.get(name)?.prompt;
}

export function getWorkflowPrompt(name: string): string | undefined {
	// Allow "workflows:plan" or "workflows-plan"
	const key = name.includes(":") ? name : name.replace(/^workflows-/, "workflows:");
	return WORKFLOWS.get(key)?.prompt ?? WORKFLOWS.get(name)?.prompt;
}

export function getAgent(name: string): AgentDefinition | undefined {
	return AGENTS.get(name);
}

export function getSkill(name: string): SkillDefinition | undefined {
	return SKILLS.get(name);
}

export function getWorkflow(name: string): WorkflowDefinition | undefined {
	const key = name.includes(":") ? name : name.replace(/^workflows-/, "workflows:");
	return WORKFLOWS.get(key) ?? WORKFLOWS.get(name);
}

/**
 * Returns the right agents/skills for a given phase based on context.
 */
export function selectAgents(phase: PhaseContext): AgentDefinition[] {
	const selected: AgentDefinition[] = [];
	const ctx = phase;

	switch (phase.phase) {
		case "brainstorm": {
			const repo = AGENTS.get("repo-research-analyst");
			const learnings = AGENTS.get("learnings-researcher");
			if (repo) selected.push(repo);
			if (learnings) selected.push(learnings);
			break;
		}
		case "plan": {
			const specFlow = AGENTS.get("spec-flow-analyzer");
			const bestPractices = AGENTS.get("best-practices-researcher");
			const frameworkDocs = AGENTS.get("framework-docs-researcher");
			if (specFlow) selected.push(specFlow);
			if (bestPractices) selected.push(bestPractices);
			if (frameworkDocs) selected.push(frameworkDocs);
			break;
		}
		case "review": {
			const reviewAgents = [
				"security-sentinel",
				"performance-oracle",
				"architecture-strategist",
				"kieran-typescript-reviewer",
				"pattern-recognition-specialist",
				"code-simplicity-reviewer",
				"agent-native-reviewer",
			];
			for (const n of reviewAgents) {
				const a = AGENTS.get(n);
				if (a) selected.push(a);
			}
			if (ctx.hasDbMigrations) {
				const dataMigration = AGENTS.get("data-migration-expert");
				const deployment = AGENTS.get("deployment-verification-agent");
				if (dataMigration) selected.push(dataMigration);
				if (deployment) selected.push(deployment);
			}
			const dataGuardian = AGENTS.get("data-integrity-guardian");
			if (dataGuardian) selected.push(dataGuardian);
			break;
		}
		case "compound": {
			const learnings = AGENTS.get("learnings-researcher");
			if (learnings) selected.push(learnings);
			break;
		}
		case "integrate": {
			const arch = AGENTS.get("architecture-strategist");
			const simplicity = AGENTS.get("code-simplicity-reviewer");
			if (arch) selected.push(arch);
			if (simplicity) selected.push(simplicity);
			break;
		}
		default:
			break;
	}
	return selected;
}

export function getAllAgents(): Map<string, AgentDefinition> {
	return new Map(AGENTS);
}

export function getAllSkills(): Map<string, SkillDefinition> {
	return new Map(SKILLS);
}

export function getAllWorkflows(): Map<string, WorkflowDefinition> {
	return new Map(WORKFLOWS);
}

export { PI_AGENT_HOME };
