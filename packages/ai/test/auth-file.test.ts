import { describe, expect, it } from "vitest";
import { parseAuthFileContent } from "../src/auth-file.js";

describe("parseAuthFileContent", () => {
	it("returns empty map for malformed JSON or non-object roots", () => {
		expect(parseAuthFileContent("{")).toEqual({});
		expect(parseAuthFileContent("[]")).toEqual({});
		expect(parseAuthFileContent("null")).toEqual({});
	});

	it("keeps valid oauth entries and drops malformed ones", () => {
		const parsed = parseAuthFileContent(
			JSON.stringify({
				anthropic: { type: "oauth", refresh: " refresh-token ", access: " access-token ", expires: 1234567890 },
				openai: { type: "oauth", refresh: "", access: "token", expires: 123 },
				badType: { type: "api_key", key: "sk-test" },
				badExpires: { type: "oauth", refresh: "r", access: "a", expires: "never" },
				badShape: 123,
			}),
		);

		expect(parsed).toEqual({
			anthropic: {
				type: "oauth",
				refresh: "refresh-token",
				access: "access-token",
				expires: 1234567890,
			},
		});
	});

	it("drops blank provider names", () => {
		const parsed = parseAuthFileContent(
			JSON.stringify({
				"   ": { type: "oauth", refresh: "r", access: "a", expires: 1 },
				valid: { type: "oauth", refresh: "r", access: "a", expires: 1 },
			}),
		);

		expect(parsed).toEqual({
			valid: { type: "oauth", refresh: "r", access: "a", expires: 1 },
		});
	});

	it("drops provider names with surrounding whitespace", () => {
		const parsed = parseAuthFileContent(
			JSON.stringify({
				" anthropic ": { type: "oauth", refresh: "r", access: "a", expires: 1 },
				openai: { type: "oauth", refresh: "r", access: "a", expires: 1 },
			}),
		);

		expect(parsed).toEqual({
			openai: { type: "oauth", refresh: "r", access: "a", expires: 1 },
		});
	});
});
