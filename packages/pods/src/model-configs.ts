import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { extractGpuType } from "./gpu-name.js";
import type { GPU } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ModelConfig {
	gpuCount: number;
	gpuTypes?: string[];
	args: string[];
	env?: Record<string, string>;
	notes?: string;
}

interface ModelInfo {
	name: string;
	configs: ModelConfig[];
	notes?: string;
}

interface ModelsData {
	models: Record<string, ModelInfo>;
}

function parseNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function parseConfigKey(value: string): string | undefined {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}
	return trimmed === value ? value : undefined;
}

function parsePositiveSafeInteger(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
		return undefined;
	}
	return value;
}

function normalizeModelConfig(value: unknown): ModelConfig | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	const record = value as Record<string, unknown>;
	const gpuCount = parsePositiveSafeInteger(record.gpuCount);
	if (gpuCount === undefined) {
		return undefined;
	}
	if (!Array.isArray(record.args) || record.args.length === 0) {
		return undefined;
	}
	const args = record.args
		.filter((entry): entry is string => typeof entry === "string")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	if (args.length === 0) {
		return undefined;
	}

	const normalized: ModelConfig = {
		gpuCount,
		args,
	};

	if (Array.isArray(record.gpuTypes)) {
		const gpuTypes = record.gpuTypes
			.filter((entry): entry is string => typeof entry === "string")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);
		if (gpuTypes.length > 0) {
			normalized.gpuTypes = gpuTypes;
		}
	}

	if (record.env && typeof record.env === "object" && !Array.isArray(record.env)) {
		const env: Record<string, string> = {};
		for (const [key, rawValue] of Object.entries(record.env as Record<string, unknown>)) {
			const parsedKey = parseConfigKey(key);
			const parsedValue = parseNonEmptyString(rawValue);
			if (parsedKey && parsedValue !== undefined) {
				env[parsedKey] = parsedValue;
			}
		}
		if (Object.keys(env).length > 0) {
			normalized.env = env;
		}
	}

	const notes = parseNonEmptyString(record.notes);
	if (notes) {
		normalized.notes = notes;
	}

	return normalized;
}

export function parseModelsData(content: string): ModelsData {
	let rawData: unknown;
	try {
		rawData = JSON.parse(content);
	} catch {
		return { models: {} };
	}

	if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
		return { models: {} };
	}
	const modelsRecord = (rawData as { models?: unknown }).models;
	if (!modelsRecord || typeof modelsRecord !== "object" || Array.isArray(modelsRecord)) {
		return { models: {} };
	}

	const models: Record<string, ModelInfo> = {};
	for (const [modelId, rawModelInfo] of Object.entries(modelsRecord as Record<string, unknown>)) {
		const parsedModelId = parseConfigKey(modelId);
		if (!parsedModelId || !rawModelInfo || typeof rawModelInfo !== "object" || Array.isArray(rawModelInfo)) {
			continue;
		}

		const record = rawModelInfo as Record<string, unknown>;
		const name = parseNonEmptyString(record.name);
		if (!name || !Array.isArray(record.configs)) {
			continue;
		}
		const configs = record.configs
			.map((entry) => normalizeModelConfig(entry))
			.filter((entry): entry is ModelConfig => entry !== undefined);
		if (configs.length === 0) {
			continue;
		}

		const modelInfo: ModelInfo = { name, configs };
		const notes = parseNonEmptyString(record.notes);
		if (notes) {
			modelInfo.notes = notes;
		}
		models[parsedModelId] = modelInfo;
	}

	return { models };
}

// Load models configuration - resolve relative to this file
const modelsJsonPath = join(__dirname, "models.json");
const modelsData: ModelsData = parseModelsData(readFileSync(modelsJsonPath, "utf-8"));

/**
 * Get the best configuration for a model based on available GPUs
 */
export const getModelConfig = (
	modelId: string,
	gpus: GPU[],
	requestedGpuCount: number,
): { args: string[]; env?: Record<string, string>; notes?: string } | null => {
	const modelInfo = modelsData.models[modelId];
	if (!modelInfo) {
		// Unknown model, no default config
		return null;
	}

	// Extract GPU type from the first GPU name (e.g., "NVIDIA H200" -> "H200")
	const gpuType = extractGpuType(gpus[0]?.name);

	// Find best matching config
	let bestConfig: ModelConfig | null = null;

	for (const config of modelInfo.configs) {
		// Check GPU count
		if (config.gpuCount !== requestedGpuCount) {
			continue;
		}

		// Check GPU type if specified
		if (config.gpuTypes && config.gpuTypes.length > 0) {
			const typeMatches = config.gpuTypes.some((type) => gpuType.includes(type) || type.includes(gpuType));
			if (!typeMatches) {
				continue;
			}
		}

		// This config matches
		bestConfig = config;
		break;
	}

	// If no exact match, try to find a config with just the right GPU count
	if (!bestConfig) {
		for (const config of modelInfo.configs) {
			if (config.gpuCount === requestedGpuCount) {
				bestConfig = config;
				break;
			}
		}
	}

	if (!bestConfig) {
		// No suitable config found
		return null;
	}

	return {
		args: [...bestConfig.args],
		env: bestConfig.env ? { ...bestConfig.env } : undefined,
		notes: bestConfig.notes || modelInfo.notes,
	};
};

/**
 * Check if a model is known
 */
export const isKnownModel = (modelId: string): boolean => {
	return modelId in modelsData.models;
};

/**
 * Get all known models
 */
export const getKnownModels = (): string[] => {
	return Object.keys(modelsData.models);
};

/**
 * Get model display name
 */
export const getModelName = (modelId: string): string => {
	return modelsData.models[modelId]?.name || modelId;
};
