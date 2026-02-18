import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENV_AGENT_DIR } from "../src/config.js";
import { migrateAuthToAuthJson, migrateSessionsFromAgentRoot } from "../src/migrations.js";

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf-8"));
}

describe("migrations", () => {
	let agentDir: string;
	let originalAgentDirEnv: string | undefined;

	beforeEach(() => {
		agentDir = join(tmpdir(), `pi-migrations-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(agentDir, { recursive: true });
		originalAgentDirEnv = process.env[ENV_AGENT_DIR];
		process.env[ENV_AGENT_DIR] = agentDir;
	});

	afterEach(() => {
		if (originalAgentDirEnv === undefined) {
			delete process.env[ENV_AGENT_DIR];
		} else {
			process.env[ENV_AGENT_DIR] = originalAgentDirEnv;
		}
	});

	it("migrates only valid auth providers and rejects whitespace-padded provider keys and api keys", () => {
		const oauthPath = join(agentDir, "oauth.json");
		const settingsPath = join(agentDir, "settings.json");
		const authPath = join(agentDir, "auth.json");

		writeFileSync(
			oauthPath,
			JSON.stringify({
				anthropic: { refresh: "token-1" },
				" openai ": { access: "token-2" },
				" ": { ignored: true },
				invalid: 42,
				array: [],
			}),
		);
		writeFileSync(
			settingsPath,
			JSON.stringify({
				apiKeys: {
					gemini: "key-123",
					copilot: "  should-be-dropped  ",
					" vertex ": "  should-be-dropped  ",
					" ": "ignored",
					anthropic: "should-not-overwrite-oauth",
					badType: 7,
				},
				keep: true,
			}),
		);

		const migratedProviders = migrateAuthToAuthJson();
		expect(migratedProviders).toEqual(["anthropic", "gemini"]);
		expect(existsSync(join(agentDir, "oauth.json.migrated"))).toBe(true);

		expect(readJson(authPath)).toEqual({
			anthropic: { type: "oauth", refresh: "token-1" },
			gemini: { type: "api_key", key: "key-123" },
		});
		expect(readJson(settingsPath)).toEqual({ keep: true });
	});

	it("skips malformed session headers during agent-root session migration", () => {
		const validSessionPath = join(agentDir, "valid.jsonl");
		const malformedSessionPath = join(agentDir, "malformed.jsonl");
		const whitespaceHeaderSessionPath = join(agentDir, "whitespace-header.jsonl");
		writeFileSync(validSessionPath, `${JSON.stringify({ type: "session", cwd: "/tmp/my-project" })}\n{}`);
		writeFileSync(malformedSessionPath, `${JSON.stringify({ type: "session", cwd: { bad: true } })}\n{}`);
		writeFileSync(
			whitespaceHeaderSessionPath,
			`${JSON.stringify({ type: " session ", cwd: " /tmp/whitespace-project " })}\n{}`,
		);

		migrateSessionsFromAgentRoot();

		expect(existsSync(validSessionPath)).toBe(false);
		expect(existsSync(join(agentDir, "sessions", "--tmp-my-project--", "valid.jsonl"))).toBe(true);
		expect(existsSync(malformedSessionPath)).toBe(true);
		expect(existsSync(whitespaceHeaderSessionPath)).toBe(true);
		expect(existsSync(join(agentDir, "sessions", "--tmp-whitespace-project--", "whitespace-header.jsonl"))).toBe(
			false,
		);
	});

	it("keeps oauth.json in place when no valid oauth credentials are migrated", () => {
		const oauthPath = join(agentDir, "oauth.json");
		const migratedOauthPath = join(agentDir, "oauth.json.migrated");
		writeFileSync(
			oauthPath,
			JSON.stringify({
				invalidProvider: 42,
				arrayProvider: [],
				" ": { token: "blank-provider" },
			}),
		);

		const migratedProviders = migrateAuthToAuthJson();

		expect(migratedProviders).toEqual([]);
		expect(existsSync(oauthPath)).toBe(true);
		expect(existsSync(migratedOauthPath)).toBe(false);
		expect(existsSync(join(agentDir, "auth.json"))).toBe(false);
	});
});
