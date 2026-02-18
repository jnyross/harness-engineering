/**
 * Gemini CLI OAuth flow (Google Cloud Code Assist)
 * Standard Gemini models only (gemini-2.0-flash, gemini-2.5-*)
 *
 * NOTE: This module uses Node.js http.createServer for the OAuth callback.
 * It is only intended for CLI use, not browser environments.
 */

import type { createServer as NodeCreateServer, Server } from "node:http";
import { abortableSleep } from "../abortable-sleep.js";
import { parseManualRedirectCodeOrThrow } from "./authorization-input.js";
import { generatePKCE } from "./pkce.js";
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

type GeminiCredentials = OAuthCredentials & {
	projectId: string;
};

let _createServer: typeof NodeCreateServer | null = null;
let _httpImportPromise: Promise<void> | null = null;
if (typeof process !== "undefined" && (process.versions?.node || process.versions?.bun)) {
	_httpImportPromise = import("node:http").then((m) => {
		_createServer = m.createServer;
	});
}

const decode = (s: string) => atob(s);
const CLIENT_ID = decode(
	"NjgxMjU1ODA5Mzk1LW9vOGZ0Mm9wcmRybnA5ZTNhcWY2YXYzaG1kaWIxMzVqLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t",
);
const CLIENT_SECRET = decode("R09DU1BYLTR1SGdNUG0tMW83U2stZ2VWNkN1NWNsWEZzeGw=");
const REDIRECT_URI = "http://localhost:8085/oauth2callback";
const SCOPES = [
	"https://www.googleapis.com/auth/cloud-platform",
	"https://www.googleapis.com/auth/userinfo.email",
	"https://www.googleapis.com/auth/userinfo.profile",
];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CODE_ASSIST_ENDPOINT = "https://cloudcode-pa.googleapis.com";

type CallbackServerInfo = {
	server: Server;
	cancelWait: () => void;
	waitForCode: () => Promise<{ code: string; state: string } | null>;
};

/**
 * Start a local HTTP server to receive the OAuth callback
 */
async function getNodeCreateServer(): Promise<typeof NodeCreateServer> {
	if (_createServer) return _createServer;
	if (_httpImportPromise) {
		await _httpImportPromise;
	}
	if (_createServer) return _createServer;
	throw new Error("Gemini CLI OAuth is only available in Node.js environments");
}

async function startCallbackServer(): Promise<CallbackServerInfo> {
	const createServer = await getNodeCreateServer();

	return new Promise((resolve) => {
		let result: { code: string; state: string } | null = null;
		let cancelled = false;
		let settled = false;
		let waitForCodeResolve: ((value: { code: string; state: string } | null) => void) | undefined;
		let waitForCodePromise: Promise<{ code: string; state: string } | null> | undefined;

		const settleWait = (value: { code: string; state: string } | null) => {
			if (!waitForCodeResolve) {
				return;
			}
			const resolvePending = waitForCodeResolve;
			waitForCodeResolve = undefined;
			waitForCodePromise = undefined;
			resolvePending(value);
		};

		const resolveOnce = (value: CallbackServerInfo) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(value);
		};

		const server = createServer((req, res) => {
			const url = new URL(req.url || "", `http://localhost:8085`);

			if (url.pathname === "/oauth2callback") {
				const code = url.searchParams.get("code");
				const state = url.searchParams.get("state");
				const error = url.searchParams.get("error");

				if (error) {
					res.writeHead(400, { "Content-Type": "text/html" });
					res.end(
						`<html><body><h1>Authentication Failed</h1><p>Error: ${error}</p><p>You can close this window.</p></body></html>`,
					);
					return;
				}

				if (code && state) {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(
						`<html><body><h1>Authentication Successful</h1><p>You can close this window and return to the terminal.</p></body></html>`,
					);
					result = { code, state };
					settleWait(result);
				} else {
					res.writeHead(400, { "Content-Type": "text/html" });
					res.end(
						`<html><body><h1>Authentication Failed</h1><p>Missing code or state parameter.</p></body></html>`,
					);
				}
			} else {
				res.writeHead(404);
				res.end();
			}
		});

		server.on("error", (err) => {
			console.error(
				`[google-gemini-cli] Failed to bind ${REDIRECT_URI} (${(err as NodeJS.ErrnoException).code ?? "unknown"}). Falling back to manual redirect input.`,
			);
			resolveOnce({
				server,
				cancelWait: () => {
					cancelled = true;
					settleWait(result);
				},
				waitForCode: async () => null,
			});
		});
		server.on("close", () => {
			cancelled = true;
			settleWait(result);
		});

		server.listen(8085, "127.0.0.1", () => {
			resolveOnce({
				server,
				cancelWait: () => {
					cancelled = true;
					settleWait(result);
				},
				waitForCode: async () => {
					if (result || cancelled) {
						return result;
					}
					if (!waitForCodePromise) {
						waitForCodePromise = new Promise((resolveWait) => {
							waitForCodeResolve = resolveWait;
						});
					}
					return waitForCodePromise;
				},
			});
		});
	});
}

interface LoadCodeAssistPayload {
	cloudaicompanionProject?: string;
	currentTier?: { id?: string };
	allowedTiers?: Array<{ id?: string; isDefault?: boolean }>;
}

/**
 * Long-running operation response from onboardUser
 */
interface LongRunningOperationResponse {
	name?: string;
	done?: boolean;
	response?: {
		cloudaicompanionProject?: { id?: string };
	};
}

// Tier IDs as used by the Cloud Code API
const TIER_FREE = "free-tier";
const TIER_LEGACY = "legacy-tier";
const TIER_STANDARD = "standard-tier";

interface GoogleRpcErrorResponse {
	error?: {
		details?: Array<{ reason?: string }>;
	};
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	return value as Record<string, unknown>;
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

function parsePositiveSafeInteger(value: unknown): number | undefined {
	if (typeof value !== "number") {
		return undefined;
	}
	return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function parseLoadCodeAssistPayload(value: unknown): LoadCodeAssistPayload {
	const payload = asRecord(value);
	const projectId = parseStrictNonEmptyString(payload?.cloudaicompanionProject);
	const currentTierRecord = asRecord(payload?.currentTier);
	const currentTierId = parseStrictNonEmptyString(currentTierRecord?.id);
	const allowedTiersRaw = Array.isArray(payload?.allowedTiers) ? payload.allowedTiers : [];
	const allowedTiers = allowedTiersRaw
		.map((tier): { id?: string; isDefault?: boolean } | undefined => {
			const tierRecord = asRecord(tier);
			if (!tierRecord) {
				return undefined;
			}
			const id = parseStrictNonEmptyString(tierRecord.id);
			const isDefault = typeof tierRecord.isDefault === "boolean" ? tierRecord.isDefault : undefined;
			if (!id && isDefault === undefined) {
				return undefined;
			}
			return { ...(id ? { id } : {}), ...(isDefault === undefined ? {} : { isDefault }) };
		})
		.filter((tier): tier is { id?: string; isDefault?: boolean } => tier !== undefined);

	return {
		...(projectId ? { cloudaicompanionProject: projectId } : {}),
		...(currentTierId ? { currentTier: { id: currentTierId } } : {}),
		...(allowedTiers.length > 0 ? { allowedTiers } : {}),
	};
}

function parseLongRunningOperationResponse(value: unknown): LongRunningOperationResponse {
	const payload = asRecord(value);
	const name = parseStrictNonEmptyString(payload?.name);
	const done = typeof payload?.done === "boolean" ? payload.done : undefined;
	const responseRecord = asRecord(payload?.response);
	const projectRecord = asRecord(responseRecord?.cloudaicompanionProject);
	const projectId = parseStrictNonEmptyString(projectRecord?.id);
	const response = projectId ? { cloudaicompanionProject: { id: projectId } } : undefined;
	return {
		...(name ? { name } : {}),
		...(done === undefined ? {} : { done }),
		...(response ? { response } : {}),
	};
}

function parseGoogleCloudTokenPayload(
	value: unknown,
	context: "exchange" | "refresh",
): {
	accessToken: string;
	expiresIn: number;
	refreshToken?: string;
} {
	const tokenPayload = asRecord(value);
	const accessToken = parseStrictNonEmptyString(tokenPayload?.access_token);
	const expiresIn = parsePositiveSafeInteger(tokenPayload?.expires_in);
	const refreshToken = parseStrictNonEmptyString(tokenPayload?.refresh_token);
	if (!accessToken || !expiresIn) {
		throw new Error(`Google Cloud token ${context} payload missing required fields`);
	}
	return {
		accessToken,
		expiresIn,
		refreshToken,
	};
}

/**
 * Wait helper for onboarding retries
 */
function assertNotAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new Error("Login cancelled");
	}
}

/**
 * Get default tier from allowed tiers
 */
function getDefaultTier(allowedTiers?: Array<{ id?: string; isDefault?: boolean }>): { id?: string } {
	if (!allowedTiers || allowedTiers.length === 0) return { id: TIER_LEGACY };
	const defaultTier = allowedTiers.find((t) => t.isDefault);
	return defaultTier ?? { id: TIER_LEGACY };
}

function isVpcScAffectedUser(payload: unknown): boolean {
	if (!payload || typeof payload !== "object") return false;
	if (!("error" in payload)) return false;
	const error = (payload as GoogleRpcErrorResponse).error;
	if (!error?.details || !Array.isArray(error.details)) return false;
	return error.details.some((detail) => detail.reason === "SECURITY_POLICY_VIOLATED");
}

/**
 * Poll a long-running operation until completion
 */
async function pollOperation(
	operationName: string,
	headers: Record<string, string>,
	onProgress?: (message: string) => void,
	signal?: AbortSignal,
): Promise<LongRunningOperationResponse> {
	let attempt = 0;
	while (true) {
		assertNotAborted(signal);
		if (attempt > 0) {
			onProgress?.(`Waiting for project provisioning (attempt ${attempt + 1})...`);
			await abortableSleep(5000, signal, "Login cancelled");
		}

		const response = await fetch(`${CODE_ASSIST_ENDPOINT}/v1internal/${operationName}`, {
			method: "GET",
			headers,
			signal,
		});

		if (!response.ok) {
			throw new Error(`Failed to poll operation: ${response.status} ${response.statusText}`);
		}

		const data = parseLongRunningOperationResponse(await response.json());
		if (data.done) {
			return data;
		}

		attempt += 1;
	}
}

/**
 * Discover or provision a Google Cloud project for the user
 */
async function discoverProject(
	accessToken: string,
	onProgress?: (message: string) => void,
	signal?: AbortSignal,
): Promise<string> {
	assertNotAborted(signal);
	// Check for user-provided project ID via environment variable
	const envProjectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT_ID;

	const headers = {
		Authorization: `Bearer ${accessToken}`,
		"Content-Type": "application/json",
		"User-Agent": "google-api-nodejs-client/9.15.1",
		"X-Goog-Api-Client": "gl-node/22.17.0",
	};

	// Try to load existing project via loadCodeAssist
	onProgress?.("Checking for existing Cloud Code Assist project...");
	const loadResponse = await fetch(`${CODE_ASSIST_ENDPOINT}/v1internal:loadCodeAssist`, {
		method: "POST",
		headers,
		signal,
		body: JSON.stringify({
			cloudaicompanionProject: envProjectId,
			metadata: {
				ideType: "IDE_UNSPECIFIED",
				platform: "PLATFORM_UNSPECIFIED",
				pluginType: "GEMINI",
				duetProject: envProjectId,
			},
		}),
	});

	let data: LoadCodeAssistPayload;

	if (!loadResponse.ok) {
		let errorPayload: unknown;
		try {
			errorPayload = await loadResponse.clone().json();
		} catch {
			errorPayload = undefined;
		}

		if (isVpcScAffectedUser(errorPayload)) {
			data = { currentTier: { id: TIER_STANDARD } };
		} else {
			const errorText = await loadResponse.text();
			throw new Error(`loadCodeAssist failed: ${loadResponse.status} ${loadResponse.statusText}: ${errorText}`);
		}
	} else {
		data = parseLoadCodeAssistPayload(await loadResponse.json());
	}

	// If user already has a current tier and project, use it
	if (data.currentTier) {
		if (data.cloudaicompanionProject) {
			return data.cloudaicompanionProject;
		}
		// User has a tier but no managed project - they need to provide one via env var
		if (envProjectId) {
			return envProjectId;
		}
		throw new Error(
			"This account requires setting the GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_PROJECT_ID environment variable. " +
				"See https://goo.gle/gemini-cli-auth-docs#workspace-gca",
		);
	}

	// User needs to be onboarded - get the default tier
	const tier = getDefaultTier(data.allowedTiers);
	const tierId = tier?.id ?? TIER_FREE;

	if (tierId !== TIER_FREE && !envProjectId) {
		throw new Error(
			"This account requires setting the GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_PROJECT_ID environment variable. " +
				"See https://goo.gle/gemini-cli-auth-docs#workspace-gca",
		);
	}

	onProgress?.("Provisioning Cloud Code Assist project (this may take a moment)...");

	// Build onboard request - for free tier, don't include project ID (Google provisions one)
	// For other tiers, include the user's project ID if available
	const onboardBody: Record<string, unknown> = {
		tierId,
		metadata: {
			ideType: "IDE_UNSPECIFIED",
			platform: "PLATFORM_UNSPECIFIED",
			pluginType: "GEMINI",
		},
	};

	if (tierId !== TIER_FREE && envProjectId) {
		onboardBody.cloudaicompanionProject = envProjectId;
		(onboardBody.metadata as Record<string, unknown>).duetProject = envProjectId;
	}

	// Start onboarding - this returns a long-running operation
	const onboardResponse = await fetch(`${CODE_ASSIST_ENDPOINT}/v1internal:onboardUser`, {
		method: "POST",
		headers,
		body: JSON.stringify(onboardBody),
	});

	if (!onboardResponse.ok) {
		const errorText = await onboardResponse.text();
		throw new Error(`onboardUser failed: ${onboardResponse.status} ${onboardResponse.statusText}: ${errorText}`);
	}

	let lroData = parseLongRunningOperationResponse(await onboardResponse.json());

	// If the operation isn't done yet, poll until completion
	if (!lroData.done && lroData.name) {
		lroData = await pollOperation(lroData.name, headers, onProgress, signal);
	}

	// Try to get project ID from the response
	const projectId = lroData.response?.cloudaicompanionProject?.id;
	if (projectId) {
		return projectId;
	}

	// If no project ID from onboarding, fall back to env var
	if (envProjectId) {
		return envProjectId;
	}

	throw new Error(
		"Could not discover or provision a Google Cloud project. " +
			"Try setting the GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_PROJECT_ID environment variable. " +
			"See https://goo.gle/gemini-cli-auth-docs#workspace-gca",
	);
}

/**
 * Get user email from the access token
 */
async function getUserEmail(accessToken: string, signal?: AbortSignal): Promise<string | undefined> {
	try {
		const response = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			signal,
		});

		if (response.ok) {
			const data = asRecord((await response.json()) as { email?: unknown });
			return parseStrictNonEmptyString(data?.email);
		}
	} catch {
		// Ignore errors, email is optional
	}
	return undefined;
}

/**
 * Refresh Google Cloud Code Assist token
 */
export async function refreshGoogleCloudToken(refreshToken: string, projectId: string): Promise<OAuthCredentials> {
	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
			refresh_token: refreshToken,
			grant_type: "refresh_token",
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Google Cloud token refresh failed: ${error}`);
	}

	const data = parseGoogleCloudTokenPayload(await response.json(), "refresh");

	return {
		refresh: data.refreshToken ?? refreshToken,
		access: data.accessToken,
		expires: Date.now() + data.expiresIn * 1000 - 5 * 60 * 1000,
		projectId,
	};
}

/**
 * Login with Gemini CLI (Google Cloud Code Assist) OAuth
 *
 * @param onAuth - Callback with URL and optional instructions
 * @param onProgress - Optional progress callback
 * @param onManualCodeInput - Optional promise that resolves with user-pasted redirect URL.
 *                            Races with browser callback - whichever completes first wins.
 */
export async function loginGeminiCli(
	onAuth: (info: { url: string; instructions?: string }) => void,
	onProgress?: (message: string) => void,
	onManualCodeInput?: () => Promise<string>,
	signal?: AbortSignal,
): Promise<OAuthCredentials> {
	assertNotAborted(signal);
	const { verifier, challenge } = await generatePKCE();

	// Start local server for callback
	onProgress?.("Starting local server for OAuth callback...");
	const server = await startCallbackServer();
	const onAbort = () => {
		server.cancelWait();
	};
	signal?.addEventListener("abort", onAbort, { once: true });

	let code: string | undefined;

	try {
		// Build authorization URL
		const authParams = new URLSearchParams({
			client_id: CLIENT_ID,
			response_type: "code",
			redirect_uri: REDIRECT_URI,
			scope: SCOPES.join(" "),
			code_challenge: challenge,
			code_challenge_method: "S256",
			state: verifier,
			access_type: "offline",
			prompt: "consent",
		});

		const authUrl = `${AUTH_URL}?${authParams.toString()}`;

		// Notify caller with URL to open
		onAuth({
			url: authUrl,
			instructions: "Complete the sign-in in your browser.",
		});

		// Wait for the callback, racing with manual input if provided
		onProgress?.("Waiting for OAuth callback...");

		if (onManualCodeInput) {
			// Race between browser callback and manual input
			let manualInput: string | undefined;
			let manualError: Error | undefined;
			const manualPromise = onManualCodeInput()
				.then((input) => {
					manualInput = input;
					server.cancelWait();
				})
				.catch((err) => {
					manualError = err instanceof Error ? err : new Error(String(err));
					server.cancelWait();
				});

			const result = await server.waitForCode();
			assertNotAborted(signal);

			// If manual input was cancelled, throw that error
			if (manualError) {
				throw manualError;
			}

			if (result?.code) {
				// Browser callback won - verify state
				if (result.state !== verifier) {
					throw new Error("OAuth state mismatch - possible CSRF attack");
				}
				code = result.code;
			} else if (manualInput) {
				// Manual input won
				code = parseManualRedirectCodeOrThrow(manualInput, verifier);
			}

			// If still no code, wait for manual promise and try that
			if (!code) {
				assertNotAborted(signal);
				await manualPromise;
				assertNotAborted(signal);
				if (manualError) {
					throw manualError;
				}
				if (manualInput) {
					code = parseManualRedirectCodeOrThrow(manualInput, verifier);
				}
			}
		} else {
			// Original flow: just wait for callback
			const result = await server.waitForCode();
			assertNotAborted(signal);
			if (result?.code) {
				if (result.state !== verifier) {
					throw new Error("OAuth state mismatch - possible CSRF attack");
				}
				code = result.code;
			}
		}

		if (!code) {
			throw new Error("No authorization code received");
		}
		assertNotAborted(signal);

		// Exchange code for tokens
		onProgress?.("Exchanging authorization code for tokens...");
		const tokenResponse = await fetch(TOKEN_URL, {
			method: "POST",
			signal,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				client_id: CLIENT_ID,
				client_secret: CLIENT_SECRET,
				code,
				grant_type: "authorization_code",
				redirect_uri: REDIRECT_URI,
				code_verifier: verifier,
			}),
		});

		if (!tokenResponse.ok) {
			const error = await tokenResponse.text();
			throw new Error(`Token exchange failed: ${error}`);
		}

		const tokenData = parseGoogleCloudTokenPayload(await tokenResponse.json(), "exchange");

		if (!tokenData.refreshToken) {
			throw new Error("No refresh token received. Please try again.");
		}

		// Get user email
		onProgress?.("Getting user info...");
		const email = await getUserEmail(tokenData.accessToken, signal);

		// Discover project
		const projectId = await discoverProject(tokenData.accessToken, onProgress, signal);

		// Calculate expiry time (current time + expires_in seconds - 5 min buffer)
		const expiresAt = Date.now() + tokenData.expiresIn * 1000 - 5 * 60 * 1000;

		const credentials: OAuthCredentials = {
			refresh: tokenData.refreshToken,
			access: tokenData.accessToken,
			expires: expiresAt,
			projectId,
			email,
		};

		return credentials;
	} finally {
		signal?.removeEventListener("abort", onAbort);
		try {
			server.server.close();
		} catch {
			// Ignore non-listening server close errors in manual-input fallback mode.
		}
	}
}

export const geminiCliOAuthProvider: OAuthProviderInterface = {
	id: "google-gemini-cli",
	name: "Google Cloud Code Assist (Gemini CLI)",
	usesCallbackServer: true,

	async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
		return loginGeminiCli(callbacks.onAuth, callbacks.onProgress, callbacks.onManualCodeInput, callbacks.signal);
	},

	async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
		const creds = credentials as GeminiCredentials;
		if (!creds.projectId) {
			throw new Error("Google Cloud credentials missing projectId");
		}
		return refreshGoogleCloudToken(creds.refresh, creds.projectId);
	},

	getApiKey(credentials: OAuthCredentials): string {
		const creds = credentials as GeminiCredentials;
		return JSON.stringify({ token: creds.access, projectId: creds.projectId });
	},
};
