export type ParsedAuthorizationInput = {
	code?: string;
	state?: string;
};

function parseCodeStateFromParams(params: URLSearchParams): ParsedAuthorizationInput {
	return {
		code: params.get("code") ?? undefined,
		state: params.get("state") ?? undefined,
	};
}

function parseRedirectUrlInput(value: string): { isUrl: boolean; parsed: ParsedAuthorizationInput } {
	try {
		const url = new URL(value);
		const queryParsed = parseCodeStateFromParams(url.searchParams);
		if (queryParsed.code || queryParsed.state) {
			return {
				isUrl: true,
				parsed: queryParsed,
			};
		}

		const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
		if (hash) {
			return {
				isUrl: true,
				parsed: parseCodeStateFromParams(new URLSearchParams(hash)),
			};
		}

		return {
			isUrl: true,
			parsed: {},
		};
	} catch {
		return {
			isUrl: false,
			parsed: {},
		};
	}
}

export function parseAuthorizationInputFromRedirectUrl(input: string): ParsedAuthorizationInput {
	const value = input.trim();
	if (!value) {
		return {};
	}
	return parseRedirectUrlInput(value).parsed;
}

export function parseFlexibleAuthorizationInput(input: string): ParsedAuthorizationInput {
	const value = input.trim();
	if (!value) {
		return {};
	}

	const urlParsed = parseRedirectUrlInput(value);
	if (urlParsed.isUrl) {
		return urlParsed.parsed;
	}

	if (value.includes("#")) {
		const [code, state] = value.split("#", 2);
		return {
			code: code || undefined,
			state: state || undefined,
		};
	}

	if (value.includes("code=")) {
		return parseCodeStateFromParams(new URLSearchParams(value));
	}

	return { code: value };
}

export function parseManualRedirectCodeOrThrow(input: string, expectedState: string): string {
	const parsed = parseAuthorizationInputFromRedirectUrl(input);
	if (!parsed.code || !parsed.state) {
		throw new Error("Manual input must be a full redirect URL containing both code and state parameters.");
	}
	if (parsed.state !== expectedState) {
		throw new Error("OAuth state mismatch - possible CSRF attack");
	}
	return parsed.code;
}
