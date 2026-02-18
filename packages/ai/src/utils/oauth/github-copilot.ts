/**
 * GitHub Copilot OAuth flow
 */

import { getModels } from "../../models.js";
import type { Api, Model } from "../../types.js";
import { abortableSleep } from "../abortable-sleep.js";
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

type CopilotCredentials = OAuthCredentials & {
	enterpriseUrl?: string;
};

const decode = (s: string) => atob(s);
const CLIENT_ID = decode("SXYxLmI1MDdhMDhjODdlY2ZlOTg=");

const COPILOT_HEADERS = {
	"User-Agent": "GitHubCopilotChat/0.35.0",
	"Editor-Version": "vscode/1.107.0",
	"Editor-Plugin-Version": "copilot-chat/0.35.0",
	"Copilot-Integration-Id": "vscode-chat",
} as const;

type DeviceCodeResponse = {
	device_code: string;
	user_code: string;
	verification_uri: string;
	interval: number;
	expires_in: number;
};

type ParsedDeviceTokenPollResponse =
	| {
			type: "success";
			accessToken: string;
	  }
	| {
			type: "error";
			error: string;
			intervalSeconds?: number;
	  };

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

function parsePositiveSafeInteger(value: unknown): number | undefined {
	if (typeof value !== "number") {
		return undefined;
	}
	return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export function parseDeviceCodeResponsePayload(value: unknown): DeviceCodeResponse | undefined {
	const payload = asRecord(value);
	const deviceCode = parseNonEmptyString(payload?.device_code);
	const userCode = parseNonEmptyString(payload?.user_code);
	const verificationUri = parseNonEmptyString(payload?.verification_uri);
	const interval = parsePositiveSafeInteger(payload?.interval);
	const expiresIn = parsePositiveSafeInteger(payload?.expires_in);
	if (!deviceCode || !userCode || !verificationUri || !interval || !expiresIn) {
		return undefined;
	}
	return {
		device_code: deviceCode,
		user_code: userCode,
		verification_uri: verificationUri,
		interval,
		expires_in: expiresIn,
	};
}

export function parseCopilotTokenResponsePayload(value: unknown): { token: string; expiresAt: number } | undefined {
	const payload = asRecord(value);
	const token = parseNonEmptyString(payload?.token);
	const expiresAt = parsePositiveSafeInteger(payload?.expires_at);
	if (!token || !expiresAt) {
		return undefined;
	}
	return { token, expiresAt };
}

export function parseDeviceTokenPollPayload(value: unknown): ParsedDeviceTokenPollResponse | undefined {
	const payload = asRecord(value);
	const accessToken = parseNonEmptyString(payload?.access_token);
	if (accessToken) {
		return { type: "success", accessToken };
	}

	const error = parseNonEmptyString(payload?.error);
	if (!error) {
		return undefined;
	}

	const intervalSeconds = parsePositiveSafeInteger(payload?.interval);
	return { type: "error", error, intervalSeconds };
}

export function normalizeDomain(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	try {
		const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
		return url.hostname;
	} catch {
		return null;
	}
}

function getUrls(domain: string): {
	deviceCodeUrl: string;
	accessTokenUrl: string;
	copilotTokenUrl: string;
} {
	return {
		deviceCodeUrl: `https://${domain}/login/device/code`,
		accessTokenUrl: `https://${domain}/login/oauth/access_token`,
		copilotTokenUrl: `https://api.${domain}/copilot_internal/v2/token`,
	};
}

/**
 * Parse the proxy-ep from a Copilot token and convert to API base URL.
 * Token format: tid=...;exp=...;proxy-ep=proxy.individual.githubcopilot.com;...
 * Returns API URL like https://api.individual.githubcopilot.com
 */
function getBaseUrlFromToken(token: string): string | null {
	const match = token.match(/proxy-ep=([^;]+)/);
	if (!match) return null;
	const proxyHost = match[1];
	// Convert proxy.xxx to api.xxx
	const apiHost = proxyHost.replace(/^proxy\./, "api.");
	return `https://${apiHost}`;
}

export function getGitHubCopilotBaseUrl(token?: string, enterpriseDomain?: string): string {
	// If we have a token, extract the base URL from proxy-ep
	if (token) {
		const urlFromToken = getBaseUrlFromToken(token);
		if (urlFromToken) return urlFromToken;
	}
	// Fallback for enterprise or if token parsing fails
	if (enterpriseDomain) return `https://copilot-api.${enterpriseDomain}`;
	return "https://api.individual.githubcopilot.com";
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
	const response = await fetch(url, init);
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`${response.status} ${response.statusText}: ${text}`);
	}
	return response.json();
}

async function startDeviceFlow(domain: string): Promise<DeviceCodeResponse> {
	const urls = getUrls(domain);
	const data = await fetchJson(urls.deviceCodeUrl, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"User-Agent": "GitHubCopilotChat/0.35.0",
		},
		body: JSON.stringify({
			client_id: CLIENT_ID,
			scope: "read:user",
		}),
	});

	const payload = parseDeviceCodeResponsePayload(data);
	if (!payload) {
		throw new Error("Invalid device code response fields");
	}
	return payload;
}

async function pollForGitHubAccessToken(
	domain: string,
	deviceCode: string,
	intervalSeconds: number,
	expiresIn: number,
	signal?: AbortSignal,
) {
	const urls = getUrls(domain);
	const deadline = Date.now() + expiresIn * 1000;
	let intervalMs = Math.max(1000, Math.floor(intervalSeconds * 1000));

	while (Date.now() < deadline) {
		if (signal?.aborted) {
			throw new Error("Login cancelled");
		}

		const raw = await fetchJson(urls.accessTokenUrl, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				"User-Agent": "GitHubCopilotChat/0.35.0",
			},
			body: JSON.stringify({
				client_id: CLIENT_ID,
				device_code: deviceCode,
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			}),
		});

		const parsedPollResponse = parseDeviceTokenPollPayload(raw);
		if (parsedPollResponse?.type === "success") {
			return parsedPollResponse.accessToken;
		}

		if (parsedPollResponse?.type === "error") {
			const err = parsedPollResponse.error;
			if (err === "authorization_pending") {
				await abortableSleep(intervalMs, signal, "Login cancelled");
				continue;
			}

			if (err === "slow_down") {
				const serverIntervalMs =
					parsedPollResponse.intervalSeconds !== undefined
						? Math.max(1000, Math.floor(parsedPollResponse.intervalSeconds * 1000))
						: undefined;
				intervalMs = Math.max(intervalMs + 5000, serverIntervalMs ?? 0);
				await abortableSleep(intervalMs, signal, "Login cancelled");
				continue;
			}

			throw new Error(`Device flow failed: ${err}`);
		}

		await abortableSleep(intervalMs, signal, "Login cancelled");
	}

	throw new Error("Device flow timed out");
}

/**
 * Refresh GitHub Copilot token
 */
export async function refreshGitHubCopilotToken(
	refreshToken: string,
	enterpriseDomain?: string,
): Promise<OAuthCredentials> {
	const domain = enterpriseDomain || "github.com";
	const urls = getUrls(domain);

	const raw = await fetchJson(urls.copilotTokenUrl, {
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${refreshToken}`,
			...COPILOT_HEADERS,
		},
	});

	if (!raw || typeof raw !== "object") {
		throw new Error("Invalid Copilot token response");
	}
	const payload = parseCopilotTokenResponsePayload(raw);
	if (!payload) {
		throw new Error("Invalid Copilot token response fields");
	}

	return {
		refresh: refreshToken,
		access: payload.token,
		expires: payload.expiresAt * 1000 - 5 * 60 * 1000,
		enterpriseUrl: enterpriseDomain,
	};
}

/**
 * Enable a model for the user's GitHub Copilot account.
 * This is required for some models (like Claude, Grok) before they can be used.
 */
async function enableGitHubCopilotModel(token: string, modelId: string, enterpriseDomain?: string): Promise<boolean> {
	const baseUrl = getGitHubCopilotBaseUrl(token, enterpriseDomain);
	const url = `${baseUrl}/models/${modelId}/policy`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
				...COPILOT_HEADERS,
				"openai-intent": "chat-policy",
				"x-interaction-type": "chat-policy",
			},
			body: JSON.stringify({ state: "enabled" }),
		});
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Enable all known GitHub Copilot models that may require policy acceptance.
 * Called after successful login to ensure all models are available.
 */
async function enableAllGitHubCopilotModels(
	token: string,
	enterpriseDomain?: string,
	onProgress?: (model: string, success: boolean) => void,
): Promise<void> {
	const models = getModels("github-copilot");
	await Promise.all(
		models.map(async (model) => {
			const success = await enableGitHubCopilotModel(token, model.id, enterpriseDomain);
			onProgress?.(model.id, success);
		}),
	);
}

/**
 * Login with GitHub Copilot OAuth (device code flow)
 *
 * @param options.onAuth - Callback with URL and optional instructions (user code)
 * @param options.onPrompt - Callback to prompt user for input
 * @param options.onProgress - Optional progress callback
 * @param options.signal - Optional AbortSignal for cancellation
 */
export async function loginGitHubCopilot(options: {
	onAuth: (url: string, instructions?: string) => void;
	onPrompt: (prompt: { message: string; placeholder?: string; allowEmpty?: boolean }) => Promise<string>;
	onProgress?: (message: string) => void;
	signal?: AbortSignal;
}): Promise<OAuthCredentials> {
	const input = await options.onPrompt({
		message: "GitHub Enterprise URL/domain (blank for github.com)",
		placeholder: "company.ghe.com",
		allowEmpty: true,
	});

	if (options.signal?.aborted) {
		throw new Error("Login cancelled");
	}

	const trimmed = input.trim();
	const enterpriseDomain = normalizeDomain(input);
	if (trimmed && !enterpriseDomain) {
		throw new Error("Invalid GitHub Enterprise URL/domain");
	}
	const domain = enterpriseDomain || "github.com";

	const device = await startDeviceFlow(domain);
	options.onAuth(device.verification_uri, `Enter code: ${device.user_code}`);

	const githubAccessToken = await pollForGitHubAccessToken(
		domain,
		device.device_code,
		device.interval,
		device.expires_in,
		options.signal,
	);
	const credentials = await refreshGitHubCopilotToken(githubAccessToken, enterpriseDomain ?? undefined);

	// Enable all models after successful login
	options.onProgress?.("Enabling models...");
	await enableAllGitHubCopilotModels(credentials.access, enterpriseDomain ?? undefined);
	return credentials;
}

export const githubCopilotOAuthProvider: OAuthProviderInterface = {
	id: "github-copilot",
	name: "GitHub Copilot",

	async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
		return loginGitHubCopilot({
			onAuth: (url, instructions) => callbacks.onAuth({ url, instructions }),
			onPrompt: callbacks.onPrompt,
			onProgress: callbacks.onProgress,
			signal: callbacks.signal,
		});
	},

	async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
		const creds = credentials as CopilotCredentials;
		return refreshGitHubCopilotToken(creds.refresh, creds.enterpriseUrl);
	},

	getApiKey(credentials: OAuthCredentials): string {
		return credentials.access;
	},

	modifyModels(models: Model<Api>[], credentials: OAuthCredentials): Model<Api>[] {
		const creds = credentials as CopilotCredentials;
		const domain = creds.enterpriseUrl ? (normalizeDomain(creds.enterpriseUrl) ?? undefined) : undefined;
		const baseUrl = getGitHubCopilotBaseUrl(creds.access, domain);
		return models.map((m) => (m.provider === "github-copilot" ? { ...m, baseUrl } : m));
	},
};
