import { describe, expect, it } from "vitest";
import {
	parseCopilotTokenResponsePayload,
	parseDeviceCodeResponsePayload,
	parseDeviceTokenPollPayload,
} from "../src/utils/oauth/github-copilot.js";

describe("GitHub Copilot OAuth payload parsing", () => {
	it("parses valid device-code payload fields", () => {
		expect(
			parseDeviceCodeResponsePayload({
				device_code: "device-code",
				user_code: "user-code",
				verification_uri: "https://github.com/login/device",
				interval: 5,
				expires_in: 900,
			}),
		).toEqual({
			device_code: "device-code",
			user_code: "user-code",
			verification_uri: "https://github.com/login/device",
			interval: 5,
			expires_in: 900,
		});
	});

	it("rejects malformed device-code payload shapes", () => {
		expect(parseDeviceCodeResponsePayload(null)).toBeUndefined();
		expect(
			parseDeviceCodeResponsePayload({
				device_code: "device-code",
				user_code: "user-code",
				verification_uri: "https://github.com/login/device",
				interval: 0,
				expires_in: 900,
			}),
		).toBeUndefined();
		expect(
			parseDeviceCodeResponsePayload({
				device_code: "device-code",
				user_code: " ",
				verification_uri: "https://github.com/login/device",
				interval: 5,
				expires_in: 900,
			}),
		).toBeUndefined();
	});

	it("parses valid copilot token payload fields", () => {
		expect(
			parseCopilotTokenResponsePayload({
				token: "copilot-token",
				expires_at: 1_700_000_000,
			}),
		).toEqual({
			token: "copilot-token",
			expiresAt: 1_700_000_000,
		});
	});

	it("parses valid device-token poll payload fields", () => {
		expect(parseDeviceTokenPollPayload({ access_token: "gho_device_token" })).toEqual({
			type: "success",
			accessToken: "gho_device_token",
		});
		expect(parseDeviceTokenPollPayload({ error: "slow_down", interval: 10 })).toEqual({
			type: "error",
			error: "slow_down",
			intervalSeconds: 10,
		});
	});

	it("rejects malformed copilot token payload fields", () => {
		const oversizedEpochSeconds = Number.MAX_SAFE_INTEGER + 1;
		expect(parseCopilotTokenResponsePayload(null)).toBeUndefined();
		expect(parseCopilotTokenResponsePayload({ token: " ", expires_at: 1_700_000_000 })).toBeUndefined();
		expect(parseCopilotTokenResponsePayload({ token: "copilot-token", expires_at: 0 })).toBeUndefined();
		expect(
			parseCopilotTokenResponsePayload({ token: "copilot-token", expires_at: oversizedEpochSeconds }),
		).toBeUndefined();
	});

	it("rejects malformed device-token poll payload fields", () => {
		expect(parseDeviceTokenPollPayload(null)).toBeUndefined();
		expect(parseDeviceTokenPollPayload({ access_token: " " })).toBeUndefined();
		expect(parseDeviceTokenPollPayload({ error: "slow_down", interval: 0 })).toEqual({
			type: "error",
			error: "slow_down",
			intervalSeconds: undefined,
		});
	});
});
