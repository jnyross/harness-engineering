import { describe, expect, it } from "vitest";
import {
	buildRpcClientCommandText,
	getRpcClientStartError,
	getRpcClientStartupExitError,
} from "../src/modes/rpc/rpc-client-status.js";

describe("rpc client startup status helpers", () => {
	it("builds a deterministic command text", () => {
		expect(buildRpcClientCommandText("node", ["dist/cli.js", "--mode", "rpc"])).toBe("node dist/cli.js --mode rpc");
	});

	it("includes command context in startup spawn errors", () => {
		expect(
			getRpcClientStartError({
				command: "node",
				args: ["dist/cli.js", "--mode", "rpc"],
				error: new Error("ENOENT"),
				stderr: "",
			}),
		).toBe("Failed to start agent process 'node dist/cli.js --mode rpc': ENOENT. Stderr: (none)");
	});

	it("includes command context in pre-initialization exits", () => {
		expect(
			getRpcClientStartupExitError({
				command: "node",
				args: ["dist/cli.js", "--mode", "rpc"],
				code: 7,
				signal: null,
				stderr: "bad config\n",
			}),
		).toBe(
			"Agent process 'node dist/cli.js --mode rpc' exited before initialization with code 7. Stderr: bad config",
		);
	});

	it("reports unknown null/null pre-initialization exits explicitly", () => {
		expect(
			getRpcClientStartupExitError({
				command: "node",
				args: ["dist/cli.js", "--mode", "rpc"],
				code: null,
				signal: null,
				stderr: "",
			}),
		).toBe(
			"Agent process 'node dist/cli.js --mode rpc' exited before initialization with unknown status. Stderr: (none)",
		);
	});
});
