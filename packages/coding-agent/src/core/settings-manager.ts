import type { Transport } from "@mariozechner/pi-ai";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { CONFIG_DIR_NAME, getAgentDir } from "../config.js";

export interface CompactionSettings {
	enabled?: boolean; // default: true
	reserveTokens?: number; // default: 16384
	keepRecentTokens?: number; // default: 20000
}

export interface BranchSummarySettings {
	reserveTokens?: number; // default: 16384 (tokens reserved for prompt + LLM response)
}

export interface RetrySettings {
	enabled?: boolean; // default: true
	maxRetries?: number; // default: 3
	baseDelayMs?: number; // default: 2000 (exponential backoff: 2s, 4s, 8s)
	maxDelayMs?: number; // default: 60000 (max server-requested delay before failing)
}

export interface TerminalSettings {
	showImages?: boolean; // default: true (only relevant if terminal supports images)
	clearOnShrink?: boolean; // default: false (clear empty rows when content shrinks)
}

export interface ImageSettings {
	autoResize?: boolean; // default: true (resize images to 2000x2000 max for better model compatibility)
	blockImages?: boolean; // default: false - when true, prevents all images from being sent to LLM providers
}

export interface ThinkingBudgetsSettings {
	minimal?: number;
	low?: number;
	medium?: number;
	high?: number;
}

export interface MarkdownSettings {
	codeBlockIndent?: string; // default: "  "
}

export type TransportSetting = Transport;

/**
 * Package source for npm/git packages.
 * - String form: load all resources from the package
 * - Object form: filter which resources to load
 */
export type PackageSource =
	| string
	| {
			source: string;
			extensions?: string[];
			skills?: string[];
			prompts?: string[];
			themes?: string[];
	  };

export interface Settings {
	lastChangelogVersion?: string;
	defaultProvider?: string;
	defaultModel?: string;
	defaultThinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	transport?: TransportSetting; // default: "sse"
	steeringMode?: "all" | "one-at-a-time";
	followUpMode?: "all" | "one-at-a-time";
	theme?: string;
	compaction?: CompactionSettings;
	branchSummary?: BranchSummarySettings;
	retry?: RetrySettings;
	hideThinkingBlock?: boolean;
	shellPath?: string; // Custom shell path (e.g., for Cygwin users on Windows)
	quietStartup?: boolean;
	shellCommandPrefix?: string; // Prefix prepended to every bash command (e.g., "shopt -s expand_aliases" for alias support)
	collapseChangelog?: boolean; // Show condensed changelog after update (use /changelog for full)
	packages?: PackageSource[]; // Array of npm/git package sources (string or object with filtering)
	extensions?: string[]; // Array of local extension file paths or directories
	skills?: string[]; // Array of local skill file paths or directories
	prompts?: string[]; // Array of local prompt template paths or directories
	themes?: string[]; // Array of local theme file paths or directories
	enableSkillCommands?: boolean; // default: true - register skills as /skill:name commands
	terminal?: TerminalSettings;
	images?: ImageSettings;
	enabledModels?: string[]; // Model patterns for cycling (same format as --models CLI flag)
	doubleEscapeAction?: "fork" | "tree" | "none"; // Action for double-escape with empty editor (default: "tree")
	thinkingBudgets?: ThinkingBudgetsSettings; // Custom token budgets for thinking levels
	editorPaddingX?: number; // Horizontal padding for input editor (default: 0)
	autocompleteMaxVisible?: number; // Max visible items in autocomplete dropdown (default: 5)
	showHardwareCursor?: boolean; // Show terminal cursor while still positioning it for IME
	markdown?: MarkdownSettings;
}

const MAX_TIMEOUT_MS = 2_147_483_647;

function normalizeRetryCount(value: number | undefined, fallback: number): number {
	if (value === undefined) {
		return fallback;
	}
	if (!Number.isSafeInteger(value) || value < 0) {
		return fallback;
	}
	return value;
}

function normalizeRetryDelayMs(value: number | undefined, fallback: number): number {
	if (value === undefined) {
		return fallback;
	}
	if (Number.isNaN(value) || value <= 0) {
		return fallback;
	}
	if (value > MAX_TIMEOUT_MS) {
		return MAX_TIMEOUT_MS;
	}
	if (!Number.isSafeInteger(value)) {
		return fallback;
	}
	return value;
}

function normalizeEditorPaddingX(value: number | undefined): number {
	if (value === undefined || Number.isNaN(value)) {
		return 0;
	}
	const normalized = Math.floor(value);
	if (!Number.isSafeInteger(normalized)) {
		return 0;
	}
	return Math.max(0, Math.min(3, normalized));
}

function normalizeAutocompleteMaxVisible(value: number | undefined): number {
	if (value === undefined || Number.isNaN(value)) {
		return 5;
	}
	const normalized = Math.floor(value);
	if (!Number.isSafeInteger(normalized)) {
		return 5;
	}
	return Math.max(3, Math.min(20, normalized));
}

function normalizePositiveSafeInteger(value: number | undefined, fallback: number): number {
	if (value === undefined || !Number.isSafeInteger(value) || value <= 0) {
		return fallback;
	}
	return value;
}

function normalizeBoolean(value: boolean | undefined, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function normalizeDefaultThinkingLevel(
	value: Settings["defaultThinkingLevel"] | undefined,
): Settings["defaultThinkingLevel"] | undefined {
	if (value === undefined) {
		return undefined;
	}
	switch (value) {
		case "off":
		case "minimal":
		case "low":
		case "medium":
		case "high":
		case "xhigh":
			return value;
		default:
			return undefined;
	}
}

function normalizeSteeringMode(value: Settings["steeringMode"] | undefined): "all" | "one-at-a-time" {
	return value === "all" || value === "one-at-a-time" ? value : "one-at-a-time";
}

function normalizeFollowUpMode(value: Settings["followUpMode"] | undefined): "all" | "one-at-a-time" {
	return value === "all" || value === "one-at-a-time" ? value : "one-at-a-time";
}

function normalizeTransport(value: Settings["transport"] | undefined): TransportSetting {
	return value === "sse" || value === "websocket" || value === "auto" ? value : "sse";
}

function normalizeDoubleEscapeAction(value: Settings["doubleEscapeAction"] | undefined): "fork" | "tree" | "none" {
	return value === "fork" || value === "tree" || value === "none" ? value : "tree";
}

function normalizeOptionalNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const normalized: string[] = [];
	for (const entry of value) {
		const parsed = normalizeOptionalNonEmptyString(entry);
		if (parsed !== undefined) {
			normalized.push(parsed);
		}
	}
	return normalized;
}

function normalizePackageSourceEntry(value: unknown): PackageSource | undefined {
	if (typeof value === "string") {
		return normalizeOptionalNonEmptyString(value);
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}

	const record = value as Record<string, unknown>;
	const source = normalizeOptionalNonEmptyString(record.source);
	if (!source) {
		return undefined;
	}

	const normalized: Exclude<PackageSource, string> = { source };
	if (Array.isArray(record.extensions)) {
		normalized.extensions = normalizeStringArray(record.extensions);
	}
	if (Array.isArray(record.skills)) {
		normalized.skills = normalizeStringArray(record.skills);
	}
	if (Array.isArray(record.prompts)) {
		normalized.prompts = normalizeStringArray(record.prompts);
	}
	if (Array.isArray(record.themes)) {
		normalized.themes = normalizeStringArray(record.themes);
	}
	return normalized;
}

function normalizePackageSources(value: unknown): PackageSource[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const normalized: PackageSource[] = [];
	for (const entry of value) {
		const parsed = normalizePackageSourceEntry(entry);
		if (parsed !== undefined) {
			normalized.push(parsed);
		}
	}
	return normalized;
}

function normalizeThinkingBudgetValue(value: number | undefined): number | undefined {
	if (value === undefined || Number.isNaN(value)) {
		return undefined;
	}
	if (!Number.isSafeInteger(value) || value < 0) {
		return undefined;
	}
	return value;
}

function normalizeThinkingBudgets(budgets: ThinkingBudgetsSettings | undefined): ThinkingBudgetsSettings | undefined {
	if (!budgets) {
		return undefined;
	}
	const normalized: ThinkingBudgetsSettings = {};
	const minimal = normalizeThinkingBudgetValue(budgets.minimal);
	if (minimal !== undefined) {
		normalized.minimal = minimal;
	}
	const low = normalizeThinkingBudgetValue(budgets.low);
	if (low !== undefined) {
		normalized.low = low;
	}
	const medium = normalizeThinkingBudgetValue(budgets.medium);
	if (medium !== undefined) {
		normalized.medium = medium;
	}
	const high = normalizeThinkingBudgetValue(budgets.high);
	if (high !== undefined) {
		normalized.high = high;
	}

	return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/** Deep merge settings: project/overrides take precedence, nested objects merge recursively */
function deepMergeSettings(base: Settings, overrides: Settings): Settings {
	const result: Settings = { ...base };

	for (const key of Object.keys(overrides) as (keyof Settings)[]) {
		const overrideValue = overrides[key];
		const baseValue = base[key];

		if (overrideValue === undefined) {
			continue;
		}

		// For nested objects, merge recursively
		if (
			typeof overrideValue === "object" &&
			overrideValue !== null &&
			!Array.isArray(overrideValue) &&
			typeof baseValue === "object" &&
			baseValue !== null &&
			!Array.isArray(baseValue)
		) {
			(result as Record<string, unknown>)[key] = { ...baseValue, ...overrideValue };
		} else {
			// For primitives and arrays, override value wins
			(result as Record<string, unknown>)[key] = overrideValue;
		}
	}

	return result;
}

export class SettingsManager {
	private settingsPath: string | null;
	private projectSettingsPath: string | null;
	private globalSettings: Settings;
	private inMemoryProjectSettings: Settings; // For in-memory mode
	private settings: Settings;
	private persist: boolean;
	private modifiedFields = new Set<keyof Settings>(); // Track fields modified during session
	private modifiedNestedFields = new Map<keyof Settings, Set<string>>(); // Track nested field modifications
	private globalSettingsLoadError: Error | null = null; // Track if settings file had parse errors

	private constructor(
		settingsPath: string | null,
		projectSettingsPath: string | null,
		initialSettings: Settings,
		persist: boolean,
		loadError: Error | null = null,
	) {
		this.settingsPath = settingsPath;
		this.projectSettingsPath = projectSettingsPath;
		this.persist = persist;
		this.globalSettings = initialSettings;
		this.inMemoryProjectSettings = {};
		this.globalSettingsLoadError = loadError;
		const projectSettings = this.loadProjectSettings();
		this.settings = deepMergeSettings(this.globalSettings, projectSettings);
	}

	/** Create a SettingsManager that loads from files */
	static create(cwd: string = process.cwd(), agentDir: string = getAgentDir()): SettingsManager {
		const settingsPath = join(agentDir, "settings.json");
		const projectSettingsPath = join(cwd, CONFIG_DIR_NAME, "settings.json");

		let globalSettings: Settings = {};
		let loadError: Error | null = null;

		try {
			globalSettings = SettingsManager.loadFromFile(settingsPath);
		} catch (error) {
			loadError = error as Error;
			console.error(`Warning: Invalid JSON in ${settingsPath}: ${error}`);
			console.error(`Fix the syntax error to enable settings persistence.`);
		}

		return new SettingsManager(settingsPath, projectSettingsPath, globalSettings, true, loadError);
	}

	/** Create an in-memory SettingsManager (no file I/O) */
	static inMemory(settings: Partial<Settings> = {}): SettingsManager {
		return new SettingsManager(null, null, settings, false);
	}

	private static loadFromFile(path: string): Settings {
		if (!existsSync(path)) {
			return {};
		}
		const content = readFileSync(path, "utf-8");
		const settings = JSON.parse(content);
		return SettingsManager.migrateSettings(settings);
	}

	/** Migrate old settings format to new format */
	private static migrateSettings(settings: Record<string, unknown>): Settings {
		// Migrate queueMode -> steeringMode
		if ("queueMode" in settings && !("steeringMode" in settings)) {
			settings.steeringMode = settings.queueMode;
			delete settings.queueMode;
		}

		// Migrate legacy websockets boolean -> transport enum
		if (!("transport" in settings) && typeof settings.websockets === "boolean") {
			settings.transport = settings.websockets ? "websocket" : "sse";
			delete settings.websockets;
		}

		// Migrate old skills object format to new array format
		if (
			"skills" in settings &&
			typeof settings.skills === "object" &&
			settings.skills !== null &&
			!Array.isArray(settings.skills)
		) {
			const skillsSettings = settings.skills as {
				enableSkillCommands?: boolean;
				customDirectories?: unknown;
			};
			if (skillsSettings.enableSkillCommands !== undefined && settings.enableSkillCommands === undefined) {
				settings.enableSkillCommands = skillsSettings.enableSkillCommands;
			}
			if (Array.isArray(skillsSettings.customDirectories) && skillsSettings.customDirectories.length > 0) {
				settings.skills = skillsSettings.customDirectories;
			} else {
				delete settings.skills;
			}
		}

		return settings as Settings;
	}

	private loadProjectSettings(): Settings {
		// In-memory mode: return stored in-memory project settings
		if (!this.persist) {
			return structuredClone(this.inMemoryProjectSettings);
		}

		if (!this.projectSettingsPath || !existsSync(this.projectSettingsPath)) {
			return {};
		}

		try {
			const content = readFileSync(this.projectSettingsPath, "utf-8");
			const settings = JSON.parse(content);
			return SettingsManager.migrateSettings(settings);
		} catch (error) {
			console.error(`Warning: Could not read project settings file: ${error}`);
			return {};
		}
	}

	getGlobalSettings(): Settings {
		return structuredClone(this.globalSettings);
	}

	getProjectSettings(): Settings {
		return this.loadProjectSettings();
	}

	reload(): void {
		let nextGlobalSettings: Settings | null = null;

		if (this.persist && this.settingsPath) {
			try {
				nextGlobalSettings = SettingsManager.loadFromFile(this.settingsPath);
				this.globalSettingsLoadError = null;
			} catch (error) {
				this.globalSettingsLoadError = error as Error;
			}
		}

		if (nextGlobalSettings) {
			this.globalSettings = nextGlobalSettings;
		}

		this.modifiedFields.clear();
		this.modifiedNestedFields.clear();

		const projectSettings = this.loadProjectSettings();
		this.settings = deepMergeSettings(this.globalSettings, projectSettings);
	}

	/** Apply additional overrides on top of current settings */
	applyOverrides(overrides: Partial<Settings>): void {
		this.settings = deepMergeSettings(this.settings, overrides);
	}

	/** Mark a field as modified during this session */
	private markModified(field: keyof Settings, nestedKey?: string): void {
		this.modifiedFields.add(field);
		if (nestedKey) {
			if (!this.modifiedNestedFields.has(field)) {
				this.modifiedNestedFields.set(field, new Set());
			}
			this.modifiedNestedFields.get(field)!.add(nestedKey);
		}
	}

	private save(): void {
		if (this.persist && this.settingsPath) {
			// Don't overwrite if the file had parse errors on initial load
			if (this.globalSettingsLoadError) {
				// Re-merge to update active settings even though we can't persist
				const projectSettings = this.loadProjectSettings();
				this.settings = deepMergeSettings(this.globalSettings, projectSettings);
				return;
			}

			try {
				const dir = dirname(this.settingsPath);
				if (!existsSync(dir)) {
					mkdirSync(dir, { recursive: true });
				}

				// Re-read current file to get latest external changes
				const currentFileSettings = SettingsManager.loadFromFile(this.settingsPath);

				// Start with file settings as base - preserves external edits
				const mergedSettings: Settings = { ...currentFileSettings };

				// Only override with in-memory values for fields that were explicitly modified during this session
				for (const field of this.modifiedFields) {
					const value = this.globalSettings[field];

					// Handle nested objects specially - merge at nested level to preserve unmodified nested keys
					if (this.modifiedNestedFields.has(field) && typeof value === "object" && value !== null) {
						const nestedModified = this.modifiedNestedFields.get(field)!;
						const baseNested = (currentFileSettings[field] as Record<string, unknown>) ?? {};
						const inMemoryNested = value as Record<string, unknown>;
						const mergedNested = { ...baseNested };
						for (const nestedKey of nestedModified) {
							mergedNested[nestedKey] = inMemoryNested[nestedKey];
						}
						(mergedSettings as Record<string, unknown>)[field] = mergedNested;
					} else {
						// For top-level primitives and arrays, use the modified value directly
						(mergedSettings as Record<string, unknown>)[field] = value;
					}
				}

				this.globalSettings = mergedSettings;
				writeFileSync(this.settingsPath, JSON.stringify(this.globalSettings, null, 2), "utf-8");
			} catch (error) {
				// File may have been externally modified with invalid JSON - don't overwrite
				console.error(`Warning: Could not save settings file: ${error}`);
			}
		}

		// Always re-merge to update active settings (needed for both file and inMemory modes)
		const projectSettings = this.loadProjectSettings();
		this.settings = deepMergeSettings(this.globalSettings, projectSettings);
	}

	private saveProjectSettings(settings: Settings): void {
		// In-memory mode: store in memory
		if (!this.persist) {
			this.inMemoryProjectSettings = structuredClone(settings);
			return;
		}

		if (!this.projectSettingsPath) {
			return;
		}
		try {
			const dir = dirname(this.projectSettingsPath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			writeFileSync(this.projectSettingsPath, JSON.stringify(settings, null, 2), "utf-8");
		} catch (error) {
			console.error(`Warning: Could not save project settings file: ${error}`);
		}
	}

	getLastChangelogVersion(): string | undefined {
		return this.settings.lastChangelogVersion;
	}

	setLastChangelogVersion(version: string): void {
		this.globalSettings.lastChangelogVersion = version;
		this.markModified("lastChangelogVersion");
		this.save();
	}

	getDefaultProvider(): string | undefined {
		return normalizeOptionalNonEmptyString(this.settings.defaultProvider);
	}

	getDefaultModel(): string | undefined {
		return normalizeOptionalNonEmptyString(this.settings.defaultModel);
	}

	setDefaultProvider(provider: string): void {
		this.globalSettings.defaultProvider = provider;
		this.markModified("defaultProvider");
		this.save();
	}

	setDefaultModel(modelId: string): void {
		this.globalSettings.defaultModel = modelId;
		this.markModified("defaultModel");
		this.save();
	}

	setDefaultModelAndProvider(provider: string, modelId: string): void {
		this.globalSettings.defaultProvider = provider;
		this.globalSettings.defaultModel = modelId;
		this.markModified("defaultProvider");
		this.markModified("defaultModel");
		this.save();
	}

	getSteeringMode(): "all" | "one-at-a-time" {
		return normalizeSteeringMode(this.settings.steeringMode);
	}

	setSteeringMode(mode: "all" | "one-at-a-time"): void {
		this.globalSettings.steeringMode = mode;
		this.markModified("steeringMode");
		this.save();
	}

	getFollowUpMode(): "all" | "one-at-a-time" {
		return normalizeFollowUpMode(this.settings.followUpMode);
	}

	setFollowUpMode(mode: "all" | "one-at-a-time"): void {
		this.globalSettings.followUpMode = mode;
		this.markModified("followUpMode");
		this.save();
	}

	getTheme(): string | undefined {
		return normalizeOptionalNonEmptyString(this.settings.theme);
	}

	setTheme(theme: string): void {
		this.globalSettings.theme = theme;
		this.markModified("theme");
		this.save();
	}

	getDefaultThinkingLevel(): "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | undefined {
		return normalizeDefaultThinkingLevel(this.settings.defaultThinkingLevel);
	}

	setDefaultThinkingLevel(level: "off" | "minimal" | "low" | "medium" | "high" | "xhigh"): void {
		this.globalSettings.defaultThinkingLevel = level;
		this.markModified("defaultThinkingLevel");
		this.save();
	}

	getTransport(): TransportSetting {
		return normalizeTransport(this.settings.transport);
	}

	setTransport(transport: TransportSetting): void {
		this.globalSettings.transport = transport;
		this.markModified("transport");
		this.save();
	}

	getCompactionEnabled(): boolean {
		return normalizeBoolean(this.settings.compaction?.enabled, true);
	}

	setCompactionEnabled(enabled: boolean): void {
		if (!this.globalSettings.compaction) {
			this.globalSettings.compaction = {};
		}
		this.globalSettings.compaction.enabled = enabled;
		this.markModified("compaction", "enabled");
		this.save();
	}

	getCompactionReserveTokens(): number {
		return normalizePositiveSafeInteger(this.settings.compaction?.reserveTokens, 16384);
	}

	getCompactionKeepRecentTokens(): number {
		return normalizePositiveSafeInteger(this.settings.compaction?.keepRecentTokens, 20000);
	}

	getCompactionSettings(): { enabled: boolean; reserveTokens: number; keepRecentTokens: number } {
		return {
			enabled: this.getCompactionEnabled(),
			reserveTokens: this.getCompactionReserveTokens(),
			keepRecentTokens: this.getCompactionKeepRecentTokens(),
		};
	}

	getBranchSummarySettings(): { reserveTokens: number } {
		return {
			reserveTokens: normalizePositiveSafeInteger(this.settings.branchSummary?.reserveTokens, 16384),
		};
	}

	getRetryEnabled(): boolean {
		return normalizeBoolean(this.settings.retry?.enabled, true);
	}

	setRetryEnabled(enabled: boolean): void {
		if (!this.globalSettings.retry) {
			this.globalSettings.retry = {};
		}
		this.globalSettings.retry.enabled = enabled;
		this.markModified("retry", "enabled");
		this.save();
	}

	getRetrySettings(): { enabled: boolean; maxRetries: number; baseDelayMs: number; maxDelayMs: number } {
		return {
			enabled: this.getRetryEnabled(),
			maxRetries: normalizeRetryCount(this.settings.retry?.maxRetries, 3),
			baseDelayMs: normalizeRetryDelayMs(this.settings.retry?.baseDelayMs, 2000),
			maxDelayMs: normalizeRetryDelayMs(this.settings.retry?.maxDelayMs, 60000),
		};
	}

	getHideThinkingBlock(): boolean {
		return normalizeBoolean(this.settings.hideThinkingBlock, false);
	}

	setHideThinkingBlock(hide: boolean): void {
		this.globalSettings.hideThinkingBlock = hide;
		this.markModified("hideThinkingBlock");
		this.save();
	}

	getShellPath(): string | undefined {
		return normalizeOptionalNonEmptyString(this.settings.shellPath);
	}

	setShellPath(path: string | undefined): void {
		this.globalSettings.shellPath = path;
		this.markModified("shellPath");
		this.save();
	}

	getQuietStartup(): boolean {
		return normalizeBoolean(this.settings.quietStartup, false);
	}

	setQuietStartup(quiet: boolean): void {
		this.globalSettings.quietStartup = quiet;
		this.markModified("quietStartup");
		this.save();
	}

	getShellCommandPrefix(): string | undefined {
		return normalizeOptionalNonEmptyString(this.settings.shellCommandPrefix);
	}

	setShellCommandPrefix(prefix: string | undefined): void {
		this.globalSettings.shellCommandPrefix = prefix;
		this.markModified("shellCommandPrefix");
		this.save();
	}

	getCollapseChangelog(): boolean {
		return normalizeBoolean(this.settings.collapseChangelog, false);
	}

	setCollapseChangelog(collapse: boolean): void {
		this.globalSettings.collapseChangelog = collapse;
		this.markModified("collapseChangelog");
		this.save();
	}

	getPackages(): PackageSource[] {
		return normalizePackageSources(this.settings.packages);
	}

	setPackages(packages: PackageSource[]): void {
		this.globalSettings.packages = packages;
		this.markModified("packages");
		this.save();
	}

	setProjectPackages(packages: PackageSource[]): void {
		const projectSettings = this.loadProjectSettings();
		projectSettings.packages = packages;
		this.saveProjectSettings(projectSettings);
		this.settings = deepMergeSettings(this.globalSettings, projectSettings);
	}

	getExtensionPaths(): string[] {
		return normalizeStringArray(this.settings.extensions);
	}

	setExtensionPaths(paths: string[]): void {
		this.globalSettings.extensions = paths;
		this.markModified("extensions");
		this.save();
	}

	setProjectExtensionPaths(paths: string[]): void {
		const projectSettings = this.loadProjectSettings();
		projectSettings.extensions = paths;
		this.saveProjectSettings(projectSettings);
		this.settings = deepMergeSettings(this.globalSettings, projectSettings);
	}

	getSkillPaths(): string[] {
		return normalizeStringArray(this.settings.skills);
	}

	setSkillPaths(paths: string[]): void {
		this.globalSettings.skills = paths;
		this.markModified("skills");
		this.save();
	}

	setProjectSkillPaths(paths: string[]): void {
		const projectSettings = this.loadProjectSettings();
		projectSettings.skills = paths;
		this.saveProjectSettings(projectSettings);
		this.settings = deepMergeSettings(this.globalSettings, projectSettings);
	}

	getPromptTemplatePaths(): string[] {
		return normalizeStringArray(this.settings.prompts);
	}

	setPromptTemplatePaths(paths: string[]): void {
		this.globalSettings.prompts = paths;
		this.markModified("prompts");
		this.save();
	}

	setProjectPromptTemplatePaths(paths: string[]): void {
		const projectSettings = this.loadProjectSettings();
		projectSettings.prompts = paths;
		this.saveProjectSettings(projectSettings);
		this.settings = deepMergeSettings(this.globalSettings, projectSettings);
	}

	getThemePaths(): string[] {
		return normalizeStringArray(this.settings.themes);
	}

	setThemePaths(paths: string[]): void {
		this.globalSettings.themes = paths;
		this.markModified("themes");
		this.save();
	}

	setProjectThemePaths(paths: string[]): void {
		const projectSettings = this.loadProjectSettings();
		projectSettings.themes = paths;
		this.saveProjectSettings(projectSettings);
		this.settings = deepMergeSettings(this.globalSettings, projectSettings);
	}

	getEnableSkillCommands(): boolean {
		return normalizeBoolean(this.settings.enableSkillCommands, true);
	}

	setEnableSkillCommands(enabled: boolean): void {
		this.globalSettings.enableSkillCommands = enabled;
		this.markModified("enableSkillCommands");
		this.save();
	}

	getThinkingBudgets(): ThinkingBudgetsSettings | undefined {
		return normalizeThinkingBudgets(this.settings.thinkingBudgets);
	}

	getShowImages(): boolean {
		return normalizeBoolean(this.settings.terminal?.showImages, true);
	}

	setShowImages(show: boolean): void {
		if (!this.globalSettings.terminal) {
			this.globalSettings.terminal = {};
		}
		this.globalSettings.terminal.showImages = show;
		this.markModified("terminal", "showImages");
		this.save();
	}

	getClearOnShrink(): boolean {
		// Settings takes precedence, then env var, then default false
		if (typeof this.settings.terminal?.clearOnShrink === "boolean") {
			return this.settings.terminal.clearOnShrink;
		}
		return process.env.PI_CLEAR_ON_SHRINK === "1";
	}

	setClearOnShrink(enabled: boolean): void {
		if (!this.globalSettings.terminal) {
			this.globalSettings.terminal = {};
		}
		this.globalSettings.terminal.clearOnShrink = enabled;
		this.markModified("terminal", "clearOnShrink");
		this.save();
	}

	getImageAutoResize(): boolean {
		return normalizeBoolean(this.settings.images?.autoResize, true);
	}

	setImageAutoResize(enabled: boolean): void {
		if (!this.globalSettings.images) {
			this.globalSettings.images = {};
		}
		this.globalSettings.images.autoResize = enabled;
		this.markModified("images", "autoResize");
		this.save();
	}

	getBlockImages(): boolean {
		return normalizeBoolean(this.settings.images?.blockImages, false);
	}

	setBlockImages(blocked: boolean): void {
		if (!this.globalSettings.images) {
			this.globalSettings.images = {};
		}
		this.globalSettings.images.blockImages = blocked;
		this.markModified("images", "blockImages");
		this.save();
	}

	getEnabledModels(): string[] | undefined {
		const normalized = normalizeStringArray(this.settings.enabledModels);
		return normalized.length > 0 ? normalized : undefined;
	}

	setEnabledModels(patterns: string[] | undefined): void {
		this.globalSettings.enabledModels = patterns;
		this.markModified("enabledModels");
		this.save();
	}

	getDoubleEscapeAction(): "fork" | "tree" | "none" {
		return normalizeDoubleEscapeAction(this.settings.doubleEscapeAction);
	}

	setDoubleEscapeAction(action: "fork" | "tree" | "none"): void {
		this.globalSettings.doubleEscapeAction = action;
		this.markModified("doubleEscapeAction");
		this.save();
	}

	getShowHardwareCursor(): boolean {
		if (typeof this.settings.showHardwareCursor === "boolean") {
			return this.settings.showHardwareCursor;
		}
		return process.env.PI_HARDWARE_CURSOR === "1";
	}

	setShowHardwareCursor(enabled: boolean): void {
		this.globalSettings.showHardwareCursor = enabled;
		this.markModified("showHardwareCursor");
		this.save();
	}

	getEditorPaddingX(): number {
		return normalizeEditorPaddingX(this.settings.editorPaddingX);
	}

	setEditorPaddingX(padding: number): void {
		this.globalSettings.editorPaddingX = normalizeEditorPaddingX(padding);
		this.markModified("editorPaddingX");
		this.save();
	}

	getAutocompleteMaxVisible(): number {
		return normalizeAutocompleteMaxVisible(this.settings.autocompleteMaxVisible);
	}

	setAutocompleteMaxVisible(maxVisible: number): void {
		this.globalSettings.autocompleteMaxVisible = normalizeAutocompleteMaxVisible(maxVisible);
		this.markModified("autocompleteMaxVisible");
		this.save();
	}

	getCodeBlockIndent(): string {
		return this.settings.markdown?.codeBlockIndent ?? "  ";
	}
}
