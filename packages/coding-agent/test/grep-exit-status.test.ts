import { describe, expect, it } from "vitest";
import { getRipgrepExitError } from "../src/core/tools/grep-exit-status.js";

describe("getRipgrepExitError", () => {
	it("returns undefined for successful exit codes", () => {
		expect(getRipgrepExitError({ code: 0, signal: null, stderr: "", killedDueToLimit: false })).toBeUndefined();
		expect(getRipgrepExitError({ code: 1, signal: null, stderr: "", killedDueToLimit: false })).toBeUndefined();
	});

	it("returns undefined when process was intentionally killed for match limit", () => {
		expect(
			getRipgrepExitError({
				code: null,
				signal: "SIGTERM",
				stderr: "",
				killedDueToLimit: true,
			}),
		).toBeUndefined();
	});

	it("reports signal exits", () => {
		expect(
			getRipgrepExitError({
				code: null,
				signal: "SIGTERM",
				stderr: "",
				killedDueToLimit: false,
			}),
		).toBe("ripgrep exited due to signal SIGTERM");
	});

	it("reports unknown status exits", () => {
		expect(
			getRipgrepExitError({
				code: null,
				signal: null,
				stderr: "",
				killedDueToLimit: false,
			}),
		).toBe("ripgrep exited with unknown status");
	});

	it("prefers stderr details for failures", () => {
		expect(
			getRipgrepExitError({
				code: 2,
				signal: null,
				stderr: "regex parse error\n",
				killedDueToLimit: false,
			}),
		).toBe("regex parse error");
	});
});
