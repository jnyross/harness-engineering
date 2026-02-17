import { describe, expect, it } from "vitest";
import {
	parseAuthorizationInputFromRedirectUrl,
	parseFlexibleAuthorizationInput,
	parseManualRedirectCodeOrThrow,
} from "../src/utils/oauth/authorization-input.js";

describe("oauth authorization input parsing", () => {
	it("parses code/state from redirect URL query params", () => {
		const parsed = parseAuthorizationInputFromRedirectUrl("http://localhost/callback?code=abc&state=def");
		expect(parsed).toEqual({ code: "abc", state: "def" });
	});

	it("parses code/state from redirect URL hash params", () => {
		const parsed = parseAuthorizationInputFromRedirectUrl("http://localhost/callback#code=abc&state=def");
		expect(parsed).toEqual({ code: "abc", state: "def" });
	});

	it("returns empty object for non-url redirect input", () => {
		const parsed = parseAuthorizationInputFromRedirectUrl("code#state");
		expect(parsed).toEqual({});
	});

	it("parses flexible code#state input", () => {
		const parsed = parseFlexibleAuthorizationInput("code-value#state-value");
		expect(parsed).toEqual({ code: "code-value", state: "state-value" });
	});

	it("parses flexible query-string snippets", () => {
		const parsed = parseFlexibleAuthorizationInput("code=code-value&state=state-value");
		expect(parsed).toEqual({ code: "code-value", state: "state-value" });
	});

	it("parses flexible bare code values", () => {
		const parsed = parseFlexibleAuthorizationInput("code-only-value");
		expect(parsed).toEqual({ code: "code-only-value" });
	});

	it("validates manual redirect state and returns code", () => {
		const code = parseManualRedirectCodeOrThrow("http://localhost/callback?code=abc&state=expected", "expected");
		expect(code).toBe("abc");
	});

	it("rejects manual redirect URLs missing code/state", () => {
		expect(() => parseManualRedirectCodeOrThrow("http://localhost/callback", "expected")).toThrow(
			"Manual input must be a full redirect URL",
		);
	});

	it("rejects manual redirect URLs with mismatched state", () => {
		expect(() =>
			parseManualRedirectCodeOrThrow("http://localhost/callback?code=abc&state=wrong", "expected"),
		).toThrow("OAuth state mismatch");
	});
});
