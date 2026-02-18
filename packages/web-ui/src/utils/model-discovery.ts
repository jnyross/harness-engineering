import { LMStudioClient } from "@lmstudio/sdk";
import type { Api, Model } from "@mariozechner/pi-ai";
import { Ollama } from "ollama/browser";

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	return value as Record<string, unknown>;
}

function parseNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed !== value) {
		return undefined;
	}
	return value;
}

function parsePositiveInteger(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
		return value;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (/^\d+$/.test(trimmed)) {
			const parsed = Number.parseInt(trimmed, 10);
			if (Number.isSafeInteger(parsed) && parsed > 0) {
				return parsed;
			}
		}
	}
	return undefined;
}

function parsePositiveIntegerOrFallback(value: unknown, fallback: number): number {
	return parsePositiveInteger(value) ?? fallback;
}

function parseDiscoveredModelsResponse(data: unknown, providerLabel: string): unknown[] {
	const payload = asRecord(data);
	const models = payload?.data;
	if (!Array.isArray(models)) {
		throw new Error(`Invalid response format from ${providerLabel} server`);
	}
	return models;
}

/**
 * Discover models from an Ollama server.
 * @param baseUrl - Base URL of the Ollama server (e.g., "http://localhost:11434")
 * @param apiKey - Optional API key (currently unused by Ollama)
 * @returns Array of discovered models
 */
export async function discoverOllamaModels(baseUrl: string, _apiKey?: string): Promise<Model<Api>[]> {
	try {
		// Create Ollama client
		const ollama = new Ollama({ host: baseUrl });

		// Get list of available models
		const { models } = await ollama.list();

		// Fetch details for each model and convert to Model format
		// biome-ignore lint/suspicious/noExplicitAny: migration
		const ollamaModelPromises: Promise<Model<Api> | null>[] = models.map(async (model: any) => {
			try {
				// Get model details
				const details = await ollama.show({
					model: model.name,
				});

				// Check capabilities - filter out models that don't support tools
				// biome-ignore lint/suspicious/noExplicitAny: migration
				const capabilities: string[] = (details as any).capabilities || [];
				if (!capabilities.includes("tools")) {
					console.debug(`Skipping model ${model.name}: does not support tools`);
					return null;
				}

				// Extract model info
				// biome-ignore lint/suspicious/noExplicitAny: migration
				const modelInfo: any = details.model_info || {};

				// Get context window size - look for architecture-specific keys
				const architecture = modelInfo["general.architecture"] || "";
				const contextKey = `${architecture}.context_length`;
				const contextWindow = parsePositiveIntegerOrFallback(modelInfo[contextKey], 8192);

				// Ollama caps max tokens at 10x context length
				const maxTokens = contextWindow * 10;

				// Ollama only supports completions API
				const ollamaModel: Model<Api> = {
					id: model.name,
					name: model.name,
					// biome-ignore lint/suspicious/noExplicitAny: migration
					api: "openai-completions" as any,
					provider: "", // Will be set by caller
					baseUrl: `${baseUrl}/v1`,
					reasoning: capabilities.includes("thinking"),
					input: ["text"],
					cost: {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
					},
					contextWindow: contextWindow,
					maxTokens: maxTokens,
				};

				return ollamaModel;
			} catch (err) {
				console.error(`Failed to fetch details for model ${model.name}:`, err);
				return null;
			}
		});

		const results = await Promise.all(ollamaModelPromises);
		return results.filter((m): m is Model<Api> => m !== null);
	} catch (err) {
		console.error("Failed to discover Ollama models:", err);
		throw new Error(`Ollama discovery failed: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Discover models from a llama.cpp server via OpenAI-compatible /v1/models endpoint.
 * @param baseUrl - Base URL of the llama.cpp server (e.g., "http://localhost:8080")
 * @param apiKey - Optional API key
 * @returns Array of discovered models
 */
export async function discoverLlamaCppModels(baseUrl: string, apiKey?: string): Promise<Model<Api>[]> {
	try {
		const headers: HeadersInit = {
			"Content-Type": "application/json",
		};

		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`;
		}

		const response = await fetch(`${baseUrl}/v1/models`, {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		const models = parseDiscoveredModelsResponse(data, "llama.cpp");

		const discoveredModels: Model<Api>[] = [];
		for (const model of models) {
			const modelRecord = asRecord(model);
			if (!modelRecord) {
				continue;
			}
			const id = parseNonEmptyString(modelRecord?.id);
			if (!id) {
				continue;
			}

			// llama.cpp doesn't always provide context window info
			const contextWindow = parsePositiveIntegerOrFallback(modelRecord.context_length, 8192);
			const maxTokens = parsePositiveIntegerOrFallback(modelRecord.max_tokens, 4096);

			const llamaModel: Model<Api> = {
				id,
				name: id,
				// biome-ignore lint/suspicious/noExplicitAny: migration
				api: "openai-completions" as any,
				provider: "", // Will be set by caller
				baseUrl: `${baseUrl}/v1`,
				reasoning: false,
				input: ["text"],
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
				},
				contextWindow,
				maxTokens,
			};
			discoveredModels.push(llamaModel);
		}

		return discoveredModels;
	} catch (err) {
		console.error("Failed to discover llama.cpp models:", err);
		throw new Error(`llama.cpp discovery failed: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Discover models from a vLLM server via OpenAI-compatible /v1/models endpoint.
 * @param baseUrl - Base URL of the vLLM server (e.g., "http://localhost:8000")
 * @param apiKey - Optional API key
 * @returns Array of discovered models
 */
export async function discoverVLLMModels(baseUrl: string, apiKey?: string): Promise<Model<Api>[]> {
	try {
		const headers: HeadersInit = {
			"Content-Type": "application/json",
		};

		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`;
		}

		const response = await fetch(`${baseUrl}/v1/models`, {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		const models = parseDiscoveredModelsResponse(data, "vLLM");

		const discoveredModels: Model<Api>[] = [];
		for (const model of models) {
			const modelRecord = asRecord(model);
			if (!modelRecord) {
				continue;
			}
			const id = parseNonEmptyString(modelRecord?.id);
			if (!id) {
				continue;
			}

			// vLLM provides max_model_len which is the context window
			const contextWindow = parsePositiveIntegerOrFallback(modelRecord.max_model_len, 8192);
			const maxTokens = Math.min(contextWindow, 4096); // Cap max tokens

			const vllmModel: Model<Api> = {
				id,
				name: id,
				// biome-ignore lint/suspicious/noExplicitAny: migration
				api: "openai-completions" as any,
				provider: "", // Will be set by caller
				baseUrl: `${baseUrl}/v1`,
				reasoning: false,
				input: ["text"],
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
				},
				contextWindow,
				maxTokens,
			};
			discoveredModels.push(vllmModel);
		}

		return discoveredModels;
	} catch (err) {
		console.error("Failed to discover vLLM models:", err);
		throw new Error(`vLLM discovery failed: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Discover models from an LM Studio server using the LM Studio SDK.
 * @param baseUrl - Base URL of the LM Studio server (e.g., "http://localhost:1234")
 * @param apiKey - Optional API key (unused for LM Studio SDK)
 * @returns Array of discovered models
 */
export async function discoverLMStudioModels(baseUrl: string, _apiKey?: string): Promise<Model<Api>[]> {
	try {
		// Extract host and port from baseUrl
		const url = new URL(baseUrl);
		const port = parsePositiveInteger(url.port) ?? 1234;

		// Create LM Studio client
		const client = new LMStudioClient({ baseUrl: `ws://${url.hostname}:${port}` });

		// List all downloaded models
		const models = await client.system.listDownloadedModels();

		// Filter to only LLM models and map to our Model format
		return models
			.filter((model) => model.type === "llm")
			.map((model) => {
				const contextWindow = parsePositiveIntegerOrFallback(model.maxContextLength, 8192);
				// Use 10x context length like Ollama does
				const maxTokens = contextWindow;

				const lmStudioModel: Model<Api> = {
					id: model.path,
					name: model.displayName || model.path,
					// biome-ignore lint/suspicious/noExplicitAny: migration
					api: "openai-completions" as any,
					provider: "", // Will be set by caller
					baseUrl: `${baseUrl}/v1`,
					reasoning: model.trainedForToolUse || false,
					input: model.vision ? ["text", "image"] : ["text"],
					cost: {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
					},
					contextWindow: contextWindow,
					maxTokens: maxTokens,
				};

				return lmStudioModel;
			});
	} catch (err) {
		console.error("Failed to discover LM Studio models:", err);
		throw new Error(`LM Studio discovery failed: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Convenience function to discover models based on provider type.
 * @param type - Provider type
 * @param baseUrl - Base URL of the server
 * @param apiKey - Optional API key
 * @returns Array of discovered models
 */
export async function discoverModels(
	type: "ollama" | "llama.cpp" | "vllm" | "lmstudio",
	baseUrl: string,
	apiKey?: string,
): Promise<Model<Api>[]> {
	switch (type) {
		case "ollama":
			return discoverOllamaModels(baseUrl, apiKey);
		case "llama.cpp":
			return discoverLlamaCppModels(baseUrl, apiKey);
		case "vllm":
			return discoverVLLMModels(baseUrl, apiKey);
		case "lmstudio":
			return discoverLMStudioModels(baseUrl, apiKey);
	}
}
