import { describe, expect, it } from "vitest";
import { getOpenUrlInvocation } from "../src/modes/interactive/components/login-dialog.js";

describe("getOpenUrlInvocation", () => {
	const url = "https://example.com/oauth?code=a&state=b";

	it("uses open on macOS", () => {
		expect(getOpenUrlInvocation(url, "darwin")).toEqual({
			command: "open",
			args: [url],
		});
	});

	it("uses explorer on Windows", () => {
		expect(getOpenUrlInvocation(url, "win32")).toEqual({
			command: "explorer",
			args: [url],
		});
	});

	it("uses xdg-open on Linux and other Unix platforms", () => {
		expect(getOpenUrlInvocation(url, "linux")).toEqual({
			command: "xdg-open",
			args: [url],
		});
		expect(getOpenUrlInvocation(url, "freebsd")).toEqual({
			command: "xdg-open",
			args: [url],
		});
	});
});
