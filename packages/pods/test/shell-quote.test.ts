import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { joinShellArgs, shellExport, shellQuote } from "../src/shell-quote.js";

describe("shellQuote", () => {
	it("wraps values in single quotes", () => {
		assert.equal(shellQuote("value"), "'value'");
		assert.equal(shellQuote(""), "''");
	});

	it("escapes embedded single quotes safely", () => {
		assert.equal(shellQuote("o'hare"), "'o'\"'\"'hare'");
	});
});

describe("joinShellArgs", () => {
	it("quotes each argument independently", () => {
		const joined = joinShellArgs(["--max-model-len", "32768", "--gpu-memory-utilization", "0.75"]);
		assert.equal(joined, "'--max-model-len' '32768' '--gpu-memory-utilization' '0.75'");
	});

	it("preserves spaces and metacharacters as literal argument content", () => {
		const joined = joinShellArgs(["--flag", "semi;colon && rm -rf /", "quoted'value"]);
		assert.equal(joined, "'--flag' 'semi;colon && rm -rf /' 'quoted'\"'\"'value'");
	});
});

describe("shellExport", () => {
	it("creates safe export statements", () => {
		assert.equal(shellExport("HF_TOKEN", "hf_value"), "export HF_TOKEN='hf_value'");
		assert.equal(shellExport("TOKEN", "o'hare"), "export TOKEN='o'\"'\"'hare'");
	});

	it("rejects invalid environment variable names", () => {
		assert.throws(() => shellExport("bad-name", "x"), /Invalid shell environment variable name/);
	});
});
