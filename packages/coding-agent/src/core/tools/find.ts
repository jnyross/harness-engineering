import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import { type SpawnSyncReturns, spawnSync } from "child_process";
import { existsSync } from "fs";
import { globSync } from "glob";
import path from "path";
import { ensureTool } from "../../utils/tools-manager.js";
import { getFindExitError } from "./find-exit-status.js";
import { resolveToCwd } from "./path-utils.js";
import { DEFAULT_MAX_BYTES, formatSize, type TruncationResult, truncateHead } from "./truncate.js";

const findSchema = Type.Object({
	pattern: Type.String({
		description: "Glob pattern to match files, e.g. '*.ts', '**/*.json', or 'src/**/*.spec.ts'",
	}),
	path: Type.Optional(Type.String({ description: "Directory to search in (default: current directory)" })),
	limit: Type.Optional(Type.Integer({ minimum: 1, description: "Maximum number of results (default: 1000)" })),
});

export type FindToolInput = Static<typeof findSchema>;

const DEFAULT_LIMIT = 1000;
const DEFAULT_FD_TIMEOUT_MS = 30000;

export interface FindToolDetails {
	truncation?: TruncationResult;
	resultLimitReached?: number;
}

function parseLimitValue(limit: number | undefined): number {
	if (limit === undefined) {
		return DEFAULT_LIMIT;
	}
	if (!Number.isSafeInteger(limit) || limit < 1) {
		throw new Error("Parameter 'limit' must be a positive integer.");
	}
	return limit;
}

/**
 * Pluggable operations for the find tool.
 * Override these to delegate file search to remote systems (e.g., SSH).
 */
export interface FindOperations {
	/** Check if path exists */
	exists: (absolutePath: string) => Promise<boolean> | boolean;
	/** Find files matching glob pattern. Returns relative paths. */
	glob?: (pattern: string, cwd: string, options: { ignore: string[]; limit: number }) => Promise<string[]> | string[];
	/** Execute fd with args and return spawnSync-style result. */
	spawnFd?: (fdPath: string, args: string[]) => SpawnSyncReturns<string>;
}

const defaultFindOperations: FindOperations = {
	exists: existsSync,
	glob: (_pattern, _searchCwd, _options) => {
		// This is a placeholder - actual fd execution happens in execute
		return [];
	},
	spawnFd: (fdPath, args) =>
		spawnSync(fdPath, args, {
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
			timeout: DEFAULT_FD_TIMEOUT_MS,
		}),
};

export interface FindToolOptions {
	/** Custom operations for find. Default: local filesystem + fd */
	operations?: FindOperations;
}

export function createFindTool(cwd: string, options?: FindToolOptions): AgentTool<typeof findSchema> {
	const customOps = options?.operations;

	return {
		name: "find",
		label: "find",
		description: `Search for files by glob pattern. Returns matching file paths relative to the search directory. Respects .gitignore. Output is truncated to ${DEFAULT_LIMIT} results or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`,
		parameters: findSchema,
		execute: async (
			_toolCallId: string,
			{ pattern, path: searchDir, limit }: { pattern: string; path?: string; limit?: number },
			signal?: AbortSignal,
		) => {
			const effectiveLimit = parseLimitValue(limit);
			return new Promise((resolve, reject) => {
				if (signal?.aborted) {
					reject(new Error("Operation aborted"));
					return;
				}

				let aborted = false;
				let settled = false;
				const settle = (fn: () => void) => {
					if (!settled) {
						settled = true;
						signal?.removeEventListener("abort", onAbort);
						fn();
					}
				};

				const onAbort = () => {
					aborted = true;
					settle(() => reject(new Error("Operation aborted")));
				};
				signal?.addEventListener("abort", onAbort, { once: true });

				(async () => {
					try {
						const searchPath = resolveToCwd(searchDir || ".", cwd);

						// If custom operations provided with glob, use that
						if (customOps?.glob) {
							const exists = customOps.exists;
							const customGlob = customOps.glob;

							if (aborted) {
								return;
							}
							if (!(await exists(searchPath))) {
								settle(() => reject(new Error(`Path not found: ${searchPath}`)));
								return;
							}

							if (aborted) {
								return;
							}
							const results = await customGlob(pattern, searchPath, {
								ignore: ["**/node_modules/**", "**/.git/**"],
								limit: effectiveLimit,
							});
							if (aborted) {
								return;
							}

							if (results.length === 0) {
								settle(() =>
									resolve({
										content: [{ type: "text", text: "No files found matching pattern" }],
										details: undefined,
									}),
								);
								return;
							}

							// Relativize paths
							const relativized = results.map((p) => {
								if (p.startsWith(searchPath)) {
									return p.slice(searchPath.length + 1);
								}
								return path.relative(searchPath, p);
							});

							const resultLimitReached = relativized.length >= effectiveLimit;
							const rawOutput = relativized.join("\n");
							const truncation = truncateHead(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });

							let resultOutput = truncation.content;
							const details: FindToolDetails = {};
							const notices: string[] = [];

							if (resultLimitReached) {
								notices.push(`${effectiveLimit} results limit reached`);
								details.resultLimitReached = effectiveLimit;
							}

							if (truncation.truncated) {
								notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`);
								details.truncation = truncation;
							}

							if (notices.length > 0) {
								resultOutput += `\n\n[${notices.join(". ")}]`;
							}

							settle(() =>
								resolve({
									content: [{ type: "text", text: resultOutput }],
									details: Object.keys(details).length > 0 ? details : undefined,
								}),
							);
							return;
						}

						// Default: use fd
						if (aborted) {
							return;
						}
						const fdPath = await ensureTool("fd", true);
						if (!fdPath) {
							settle(() => reject(new Error("fd is not available and could not be downloaded")));
							return;
						}
						if (aborted) {
							return;
						}

						// Build fd arguments
						const args: string[] = [
							"--glob",
							"--color=never",
							"--hidden",
							"--max-results",
							String(effectiveLimit),
						];

						// Include .gitignore files
						const gitignoreFiles = new Set<string>();
						const rootGitignore = path.join(searchPath, ".gitignore");
						if (existsSync(rootGitignore)) {
							gitignoreFiles.add(rootGitignore);
						}

						try {
							const nestedGitignores = globSync("**/.gitignore", {
								cwd: searchPath,
								dot: true,
								absolute: true,
								ignore: ["**/node_modules/**", "**/.git/**"],
							});
							for (const file of nestedGitignores) {
								gitignoreFiles.add(file);
							}
						} catch {
							// Ignore glob errors
						}

						for (const gitignorePath of gitignoreFiles) {
							args.push("--ignore-file", gitignorePath);
						}

						args.push(pattern, searchPath);
						if (aborted) {
							return;
						}

						const runFd = customOps?.spawnFd ?? defaultFindOperations.spawnFd!;
						const result = runFd(fdPath, args);
						if (aborted) {
							return;
						}

						const exitError = getFindExitError(result);
						if (exitError) {
							settle(() => reject(new Error(exitError)));
							return;
						}

						const output = result.stdout?.trim() || "";

						if (!output) {
							settle(() =>
								resolve({
									content: [{ type: "text", text: "No files found matching pattern" }],
									details: undefined,
								}),
							);
							return;
						}

						const lines = output.split("\n");
						const relativized: string[] = [];

						for (const rawLine of lines) {
							const line = rawLine.replace(/\r$/, "").trim();
							if (!line) continue;

							const hadTrailingSlash = line.endsWith("/") || line.endsWith("\\");
							let relativePath = line;
							if (line.startsWith(searchPath)) {
								relativePath = line.slice(searchPath.length + 1);
							} else {
								relativePath = path.relative(searchPath, line);
							}

							if (hadTrailingSlash && !relativePath.endsWith("/")) {
								relativePath += "/";
							}

							relativized.push(relativePath);
						}

						const resultLimitReached = relativized.length >= effectiveLimit;
						const rawOutput = relativized.join("\n");
						const truncation = truncateHead(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });

						let resultOutput = truncation.content;
						const details: FindToolDetails = {};
						const notices: string[] = [];

						if (resultLimitReached) {
							notices.push(
								`${effectiveLimit} results limit reached. Use limit=${effectiveLimit * 2} for more, or refine pattern`,
							);
							details.resultLimitReached = effectiveLimit;
						}

						if (truncation.truncated) {
							notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`);
							details.truncation = truncation;
						}

						if (notices.length > 0) {
							resultOutput += `\n\n[${notices.join(". ")}]`;
						}

						settle(() =>
							resolve({
								content: [{ type: "text", text: resultOutput }],
								details: Object.keys(details).length > 0 ? details : undefined,
							}),
						);
						// biome-ignore lint/suspicious/noExplicitAny: migration
					} catch (e: any) {
						settle(() => reject(e));
					}
				})();
			});
		},
	};
}

/** Default find tool using process.cwd() - for backwards compatibility */
export const findTool = createFindTool(process.cwd());
