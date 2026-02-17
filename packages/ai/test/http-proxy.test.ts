import { describe, expect, it } from "vitest";
import { hasHttpProxyEnv } from "../src/utils/http-proxy.js";

describe("hasHttpProxyEnv", () => {
	it("returns false when no proxy variables are configured", () => {
		expect(hasHttpProxyEnv({})).toBe(false);
	});

	it("detects uppercase proxy environment variables", () => {
		expect(hasHttpProxyEnv({ HTTP_PROXY: "http://proxy.local:3128" })).toBe(true);
		expect(hasHttpProxyEnv({ HTTPS_PROXY: "https://proxy.local:3129" })).toBe(true);
		expect(hasHttpProxyEnv({ ALL_PROXY: "socks5://proxy.local:1080" })).toBe(true);
	});

	it("detects lowercase proxy environment variables", () => {
		expect(hasHttpProxyEnv({ http_proxy: "http://proxy.local:3128" })).toBe(true);
		expect(hasHttpProxyEnv({ https_proxy: "https://proxy.local:3129" })).toBe(true);
		expect(hasHttpProxyEnv({ all_proxy: "socks5://proxy.local:1080" })).toBe(true);
	});
});
