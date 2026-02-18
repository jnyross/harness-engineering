import type { OAuthCredentials } from "./utils/oauth/types.js";

export type StoredOAuthCredential = { type: "oauth" } & OAuthCredentials;
export type StoredOAuthMap = Record<string, StoredOAuthCredential>;

function parseNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function parseProviderId(value: string): string | undefined {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}
	return trimmed === value ? value : undefined;
}

function parseStoredOAuthCredential(value: unknown): StoredOAuthCredential | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	const record = value as Record<string, unknown>;
	if (record.type !== "oauth") {
		return undefined;
	}

	const refresh = parseNonEmptyString(record.refresh);
	const access = parseNonEmptyString(record.access);
	const expires = record.expires;
	if (!refresh || !access || typeof expires !== "number" || !Number.isSafeInteger(expires) || expires < 0) {
		return undefined;
	}

	return {
		...(record as OAuthCredentials),
		type: "oauth",
		refresh,
		access,
		expires,
	};
}

export function parseAuthFileContent(content: string): StoredOAuthMap {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		return {};
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return {};
	}

	const normalized: StoredOAuthMap = {};
	for (const [provider, rawCredential] of Object.entries(parsed as Record<string, unknown>)) {
		const providerId = parseProviderId(provider);
		if (!providerId) {
			continue;
		}
		const credential = parseStoredOAuthCredential(rawCredential);
		if (credential) {
			normalized[providerId] = credential;
		}
	}
	return normalized;
}
