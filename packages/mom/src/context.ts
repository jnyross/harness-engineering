/**
 * Context management for mom.
 *
 * Mom uses two files per channel:
 * - context.jsonl: Structured API messages for LLM context (same format as coding-agent sessions)
 * - log.jsonl: Human-readable channel history for grep (no tool results)
 *
 * This module provides:
 * - syncLogToSessionManager: Syncs messages from log.jsonl to SessionManager
 * - MomSettingsManager: Simple settings for mom (compaction, retry, model preferences)
 */

import type { UserMessage } from "@mariozechner/pi-ai";
import type { SessionManager, SessionMessageEntry } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

// ============================================================================
// Sync log.jsonl to SessionManager
// ============================================================================

interface LogMessage {
	date?: string;
	ts?: string;
	user?: string;
	userName?: string;
	text?: string;
	isBot?: boolean;
}

interface ParsedSyncLogMessage {
	slackTs: string;
	timestampMs: number;
	userLabel: string;
	text: string;
	isBot: boolean;
}

function parseSyncLogMessage(line: string): ParsedSyncLogMessage | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch {
		return undefined;
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return undefined;
	}

	const record = parsed as LogMessage;
	if (typeof record.ts !== "string") {
		return undefined;
	}
	const slackTs = record.ts.trim();
	if (!slackTs || slackTs !== record.ts) {
		return undefined;
	}

	const userLabel =
		(typeof record.userName === "string" && record.userName.trim()) ||
		(typeof record.user === "string" && record.user.trim()) ||
		"unknown";
	const text = typeof record.text === "string" ? record.text : "";
	const parsedTimestamp = typeof record.date === "string" ? Date.parse(record.date) : Number.NaN;
	const timestampMs = Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now();

	return {
		slackTs,
		timestampMs,
		userLabel,
		text,
		isBot: record.isBot === true,
	};
}

/**
 * Sync user messages from log.jsonl to SessionManager.
 *
 * This ensures that messages logged while mom wasn't running (channel chatter,
 * backfilled messages, messages while busy) are added to the LLM context.
 *
 * @param sessionManager - The SessionManager to sync to
 * @param channelDir - Path to channel directory containing log.jsonl
 * @param excludeSlackTs - Slack timestamp of current message (will be added via prompt(), not sync)
 * @returns Number of messages synced
 */
export function syncLogToSessionManager(
	sessionManager: SessionManager,
	channelDir: string,
	excludeSlackTs?: string,
): number {
	const logFile = join(channelDir, "log.jsonl");

	if (!existsSync(logFile)) return 0;

	// Build set of existing message content from session
	const existingMessages = new Set<string>();
	for (const entry of sessionManager.getEntries()) {
		if (entry.type === "message") {
			const msgEntry = entry as SessionMessageEntry;
			const msg = msgEntry.message as { role: string; content?: unknown };
			if (msg.role === "user" && msg.content !== undefined) {
				const content = msg.content;
				if (typeof content === "string") {
					// Strip timestamp prefix for comparison (live messages have it, synced don't)
					// Format: [YYYY-MM-DD HH:MM:SS+HH:MM] [username]: text
					let normalized = content.replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}\] /, "");
					// Strip attachments section
					const attachmentsIdx = normalized.indexOf("\n\n<slack_attachments>\n");
					if (attachmentsIdx !== -1) {
						normalized = normalized.substring(0, attachmentsIdx);
					}
					existingMessages.add(normalized);
				} else if (Array.isArray(content)) {
					for (const part of content) {
						if (
							typeof part === "object" &&
							part !== null &&
							"type" in part &&
							part.type === "text" &&
							"text" in part
						) {
							let normalized = (part as { type: "text"; text: string }).text;
							normalized = normalized.replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}\] /, "");
							const attachmentsIdx = normalized.indexOf("\n\n<slack_attachments>\n");
							if (attachmentsIdx !== -1) {
								normalized = normalized.substring(0, attachmentsIdx);
							}
							existingMessages.add(normalized);
						}
					}
				}
			}
		}
	}

	// Read log.jsonl and find user messages not in context
	const logContent = readFileSync(logFile, "utf-8");
	const logLines = logContent.trim().split("\n").filter(Boolean);

	const newMessages: Array<{ timestamp: number; message: UserMessage }> = [];

	for (const line of logLines) {
		const logMsg = parseSyncLogMessage(line);
		if (!logMsg) continue;

		// Skip the current message being processed (will be added via prompt())
		if (excludeSlackTs && logMsg.slackTs === excludeSlackTs) continue;

		// Skip bot messages - added through agent flow
		if (logMsg.isBot) continue;

		// Build the message text as it would appear in context
		const messageText = `[${logMsg.userLabel}]: ${logMsg.text}`;

		// Skip if this exact message text is already in context
		if (existingMessages.has(messageText)) continue;

		const userMessage: UserMessage = {
			role: "user",
			content: [{ type: "text", text: messageText }],
			timestamp: logMsg.timestampMs,
		};

		newMessages.push({ timestamp: logMsg.timestampMs, message: userMessage });
		existingMessages.add(messageText); // Track to avoid duplicates within this sync
	}

	if (newMessages.length === 0) return 0;

	// Sort by timestamp and add to session
	newMessages.sort((a, b) => a.timestamp - b.timestamp);

	for (const { message } of newMessages) {
		sessionManager.appendMessage(message);
	}

	return newMessages.length;
}

// ============================================================================
// MomSettingsManager - Simple settings for mom
// ============================================================================

export interface MomCompactionSettings {
	enabled: boolean;
	reserveTokens: number;
	keepRecentTokens: number;
}

export interface MomRetrySettings {
	enabled: boolean;
	maxRetries: number;
	baseDelayMs: number;
}

export interface MomSettings {
	defaultProvider?: string;
	defaultModel?: string;
	defaultThinkingLevel?: "off" | "minimal" | "low" | "medium" | "high";
	compaction?: Partial<MomCompactionSettings>;
	retry?: Partial<MomRetrySettings>;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function normalizePositiveSafeInteger(value: unknown, fallback: number): number {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
		return fallback;
	}
	return value;
}

function normalizeOptionalNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeThinkingLevel(value: unknown): MomSettings["defaultThinkingLevel"] | undefined {
	switch (value) {
		case "off":
		case "minimal":
		case "low":
		case "medium":
		case "high":
			return value;
		default:
			return undefined;
	}
}

function normalizeMomSettings(value: unknown): MomSettings {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	const record = value as Record<string, unknown>;
	const normalized: MomSettings = {};

	const defaultProvider = normalizeOptionalNonEmptyString(record.defaultProvider);
	if (defaultProvider) {
		normalized.defaultProvider = defaultProvider;
	}
	const defaultModel = normalizeOptionalNonEmptyString(record.defaultModel);
	if (defaultModel) {
		normalized.defaultModel = defaultModel;
	}

	const thinkingLevel = normalizeThinkingLevel(record.defaultThinkingLevel);
	if (thinkingLevel) {
		normalized.defaultThinkingLevel = thinkingLevel;
	}

	if (record.compaction && typeof record.compaction === "object" && !Array.isArray(record.compaction)) {
		const compactionRecord = record.compaction as Record<string, unknown>;
		const compaction: Partial<MomCompactionSettings> = {};
		if (typeof compactionRecord.enabled === "boolean") {
			compaction.enabled = compactionRecord.enabled;
		}
		if (typeof compactionRecord.reserveTokens === "number") {
			compaction.reserveTokens = compactionRecord.reserveTokens;
		}
		if (typeof compactionRecord.keepRecentTokens === "number") {
			compaction.keepRecentTokens = compactionRecord.keepRecentTokens;
		}
		if (Object.keys(compaction).length > 0) {
			normalized.compaction = compaction;
		}
	}

	if (record.retry && typeof record.retry === "object" && !Array.isArray(record.retry)) {
		const retryRecord = record.retry as Record<string, unknown>;
		const retry: Partial<MomRetrySettings> = {};
		if (typeof retryRecord.enabled === "boolean") {
			retry.enabled = retryRecord.enabled;
		}
		if (typeof retryRecord.maxRetries === "number") {
			retry.maxRetries = retryRecord.maxRetries;
		}
		if (typeof retryRecord.baseDelayMs === "number") {
			retry.baseDelayMs = retryRecord.baseDelayMs;
		}
		if (Object.keys(retry).length > 0) {
			normalized.retry = retry;
		}
	}

	return normalized;
}

const DEFAULT_COMPACTION: MomCompactionSettings = {
	enabled: true,
	reserveTokens: 16384,
	keepRecentTokens: 20000,
};

const DEFAULT_RETRY: MomRetrySettings = {
	enabled: true,
	maxRetries: 3,
	baseDelayMs: 2000,
};

/**
 * Settings manager for mom.
 * Stores settings in the workspace root directory.
 */
export class MomSettingsManager {
	private settingsPath: string;
	private settings: MomSettings;

	constructor(workspaceDir: string) {
		this.settingsPath = join(workspaceDir, "settings.json");
		this.settings = this.load();
	}

	private load(): MomSettings {
		if (!existsSync(this.settingsPath)) {
			return {};
		}

		try {
			const content = readFileSync(this.settingsPath, "utf-8");
			return normalizeMomSettings(JSON.parse(content));
		} catch {
			return {};
		}
	}

	private save(): void {
		try {
			const dir = dirname(this.settingsPath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), "utf-8");
		} catch (error) {
			console.error(`Warning: Could not save settings file: ${error}`);
		}
	}

	getCompactionSettings(): MomCompactionSettings {
		const compaction = this.settings.compaction;
		return {
			enabled: normalizeBoolean(compaction?.enabled, DEFAULT_COMPACTION.enabled),
			reserveTokens: normalizePositiveSafeInteger(compaction?.reserveTokens, DEFAULT_COMPACTION.reserveTokens),
			keepRecentTokens: normalizePositiveSafeInteger(
				compaction?.keepRecentTokens,
				DEFAULT_COMPACTION.keepRecentTokens,
			),
		};
	}

	getCompactionEnabled(): boolean {
		return this.settings.compaction?.enabled ?? DEFAULT_COMPACTION.enabled;
	}

	setCompactionEnabled(enabled: boolean): void {
		this.settings.compaction = { ...this.settings.compaction, enabled };
		this.save();
	}

	getRetrySettings(): MomRetrySettings {
		const retry = this.settings.retry;
		return {
			enabled: normalizeBoolean(retry?.enabled, DEFAULT_RETRY.enabled),
			maxRetries: normalizePositiveSafeInteger(retry?.maxRetries, DEFAULT_RETRY.maxRetries),
			baseDelayMs: normalizePositiveSafeInteger(retry?.baseDelayMs, DEFAULT_RETRY.baseDelayMs),
		};
	}

	getRetryEnabled(): boolean {
		return this.settings.retry?.enabled ?? DEFAULT_RETRY.enabled;
	}

	setRetryEnabled(enabled: boolean): void {
		this.settings.retry = { ...this.settings.retry, enabled };
		this.save();
	}

	getDefaultModel(): string | undefined {
		return normalizeOptionalNonEmptyString(this.settings.defaultModel);
	}

	getDefaultProvider(): string | undefined {
		return normalizeOptionalNonEmptyString(this.settings.defaultProvider);
	}

	setDefaultModelAndProvider(provider: string, modelId: string): void {
		this.settings.defaultProvider = provider;
		this.settings.defaultModel = modelId;
		this.save();
	}

	getDefaultThinkingLevel(): string {
		return normalizeThinkingLevel(this.settings.defaultThinkingLevel) ?? "off";
	}

	setDefaultThinkingLevel(level: string): void {
		this.settings.defaultThinkingLevel = normalizeThinkingLevel(level) ?? "off";
		this.save();
	}

	// Compatibility methods for AgentSession
	getSteeringMode(): "all" | "one-at-a-time" {
		return "one-at-a-time"; // Mom processes one message at a time
	}

	setSteeringMode(_mode: "all" | "one-at-a-time"): void {
		// No-op for mom
	}

	getFollowUpMode(): "all" | "one-at-a-time" {
		return "one-at-a-time"; // Mom processes one message at a time
	}

	setFollowUpMode(_mode: "all" | "one-at-a-time"): void {
		// No-op for mom
	}

	getHookPaths(): string[] {
		return []; // Mom doesn't use hooks
	}

	getHookTimeout(): number {
		return 30000;
	}
}
