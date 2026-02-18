import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { Config, GPU, Model, Pod } from "./types.js";

// Get config directory from env or use default
const getConfigDir = (): string => {
	const configDir = process.env.PI_CONFIG_DIR || join(homedir(), ".pi");
	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true });
	}
	return configDir;
};

const getConfigPath = (): string => {
	return join(getConfigDir(), "pods.json");
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	return value as Record<string, unknown>;
}

function parseSafeInteger(value: unknown, minimum: number): number | undefined {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
		return undefined;
	}
	return value;
}

function parseNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function parseStrictNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed !== value) {
		return undefined;
	}
	return value;
}

function parseConfigKey(value: string): string | undefined {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}
	return trimmed === value ? value : undefined;
}

function normalizeGpu(value: unknown): GPU | undefined {
	const record = asRecord(value);
	if (!record) {
		return undefined;
	}

	const id = parseSafeInteger(record.id, 0);
	const name = parseNonEmptyString(record.name);
	const memory = parseNonEmptyString(record.memory);
	if (id === undefined || !name || !memory) {
		return undefined;
	}

	return { id, name, memory };
}

function normalizeModel(value: unknown): Model | undefined {
	const record = asRecord(value);
	if (!record) {
		return undefined;
	}

	const model = parseStrictNonEmptyString(record.model);
	const port = parseSafeInteger(record.port, 1);
	const pid = parseSafeInteger(record.pid, 1);
	if (!model || port === undefined || pid === undefined) {
		return undefined;
	}

	if (!Array.isArray(record.gpu)) {
		return undefined;
	}
	const gpu = record.gpu
		.map((entry) => parseSafeInteger(entry, 0))
		.filter((entry): entry is number => entry !== undefined);
	if (gpu.length === 0) {
		return undefined;
	}

	return { model, port, pid, gpu };
}

function normalizePod(value: unknown): Pod | undefined {
	const record = asRecord(value);
	if (!record) {
		return undefined;
	}

	const ssh = parseNonEmptyString(record.ssh);
	if (!ssh || !Array.isArray(record.gpus)) {
		return undefined;
	}

	const gpus = record.gpus.map((entry) => normalizeGpu(entry)).filter((entry): entry is GPU => entry !== undefined);
	const modelsRecord = asRecord(record.models);
	if (!modelsRecord) {
		return undefined;
	}
	const models: Record<string, Model> = {};
	for (const [name, modelValue] of Object.entries(modelsRecord)) {
		const modelName = parseConfigKey(name);
		if (!modelName) {
			continue;
		}
		const model = normalizeModel(modelValue);
		if (model) {
			models[modelName] = model;
		}
	}

	const normalized: Pod = { ssh, gpus, models };
	const modelsPath = parseStrictNonEmptyString(record.modelsPath);
	if (modelsPath) {
		normalized.modelsPath = modelsPath;
	}

	if (record.vllmVersion === "release" || record.vllmVersion === "nightly" || record.vllmVersion === "gpt-oss") {
		normalized.vllmVersion = record.vllmVersion;
	}

	return normalized;
}

function normalizeConfig(value: unknown): Config {
	const record = asRecord(value);
	if (!record) {
		return { pods: {} };
	}

	const podsRecord = asRecord(record.pods);
	if (!podsRecord) {
		return { pods: {} };
	}

	const pods: Record<string, Pod> = {};
	for (const [name, podValue] of Object.entries(podsRecord)) {
		const podName = parseConfigKey(name);
		if (!podName) {
			continue;
		}
		const pod = normalizePod(podValue);
		if (pod) {
			pods[podName] = pod;
		}
	}

	const active = typeof record.active === "string" ? parseConfigKey(record.active) : undefined;
	return active && pods[active] ? { pods, active } : { pods };
}

export const loadConfig = (): Config => {
	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		// Return empty config if file doesn't exist
		return { pods: {} };
	}
	try {
		const data = readFileSync(configPath, "utf-8");
		return normalizeConfig(JSON.parse(data));
	} catch (e) {
		console.error(`Error reading config: ${e}`);
		return { pods: {} };
	}
};

export const saveConfig = (config: Config): void => {
	const configPath = getConfigPath();
	try {
		writeFileSync(configPath, JSON.stringify(config, null, 2));
	} catch (e) {
		console.error(`Error saving config: ${e}`);
		process.exit(1);
	}
};

export const getActivePod = (): { name: string; pod: Pod } | null => {
	const config = loadConfig();
	if (!config.active || !config.pods[config.active]) {
		return null;
	}
	return { name: config.active, pod: config.pods[config.active] };
};

export const addPod = (name: string, pod: Pod): void => {
	const config = loadConfig();
	config.pods[name] = pod;
	// If no active pod, make this one active
	if (!config.active) {
		config.active = name;
	}
	saveConfig(config);
};

export const removePod = (name: string): void => {
	const config = loadConfig();
	delete config.pods[name];
	// If this was the active pod, clear active
	if (config.active === name) {
		config.active = undefined;
	}
	saveConfig(config);
};

export const setActivePod = (name: string): void => {
	const config = loadConfig();
	if (!config.pods[name]) {
		console.error(`Pod '${name}' not found`);
		process.exit(1);
	}
	config.active = name;
	saveConfig(config);
};
