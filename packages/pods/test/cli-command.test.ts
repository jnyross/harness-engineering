import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getCliCommand, setCliCommand } from "../src/cli-command.js";

const CLI_COMMAND_ENV = "PI_PODS_CLI_COMMAND";
const originalCommand = process.env[CLI_COMMAND_ENV];

afterEach(() => {
	if (originalCommand === undefined) {
		delete process.env[CLI_COMMAND_ENV];
	} else {
		process.env[CLI_COMMAND_ENV] = originalCommand;
	}
});

describe("cli command context", () => {
	it("defaults to pi when command context is not set", () => {
		delete process.env[CLI_COMMAND_ENV];
		assert.equal(getCliCommand(), "pi");
	});

	it("returns command set by the cli", () => {
		setCliCommand("pi-pods");
		assert.equal(getCliCommand(), "pi-pods");
	});
});
