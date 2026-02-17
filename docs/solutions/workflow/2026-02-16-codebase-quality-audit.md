# Codebase Quality Audit — 2026-02-16

## Scope

Full monorepo review and remediation across:

- `packages/ai`
- `packages/agent`
- `packages/coding-agent`
- `packages/tui`
- `packages/web-ui`
- `packages/mom`
- `packages/pods`

Audit goals:

1. Remove concrete check/test friction.
2. Improve reliability and safety without changing product intent.
3. Keep changes aligned with architecture boundaries and existing methodologies.

## Findings and Actions

### 1) Root check reproducibility issues (web-ui + type resolution)

**Finding:** Root `npm run check` failed from a fresh source install because `web-ui` type checks relied on built declaration outputs from sibling packages.

**Action:** Updated local path mapping in:

- `packages/web-ui/tsconfig.json`
- `packages/web-ui/example/tsconfig.json`

to resolve internal dependencies from source paths.

**Result:** `npm run check` passes without requiring a prior monorepo build.

---

### 2) Cross-typing incompatibility in Codex provider helper

**Finding:** `headers.entries()` usage in `openai-codex-responses` caused typing incompatibility in some check flows.

**Action:** Switched header iteration to `Headers.forEach()` in:

- `packages/ai/src/providers/openai-codex-responses.ts`

**Result:** Type compatibility improved; no behavior change.

---

### 3) mom model selection hardcoded

**Finding:** mom runner used a hardcoded default model/provider in code.

**Action:** Added environment-driven model selection with validation in:

- `packages/mom/src/agent.ts`

Supported env vars:

- `PI_MOM_PROVIDER` / `MOM_MODEL_PROVIDER`
- `PI_MOM_MODEL` / `MOM_MODEL_ID`

Documented in:

- `packages/mom/README.md`

**Result:** Model choice is configurable while preserving previous defaults.

---

### 4) Reviewer contract drift in agent package

**Finding:** Reviewer parser/prompt were still centered on binary `[APPROVE]/[REJECT]`, while newer flow expects three outcomes.

**Action:** Updated reviewer prompt and parser to support:

- `approved`
- `needs_fixes`
- `rejected`

with backward compatibility for legacy tags.

Files:

- `packages/agent/src/reviewer.ts`
- `packages/agent/test/reviewer.test.ts`

**Result:** Review contract now matches newer TDD gate semantics and remains backward compatible.

---

### 5) Risky broad git operations in autonomous loop code

**Finding:** Agent loop orchestration still used broad/dangerous patterns (`git add -A`, `git checkout .`) in autonomous flows.

**Action:** Replaced with safer patterns in:

- `packages/agent/src/project-loop.ts`
- `packages/agent/src/tdd-loop.ts`

Specifically:

- stage explicit discovered changed files (tracked + untracked),
- use `git restore --worktree --source=HEAD -- .` for reset behavior.

**Result:** Lower risk of accidental unrelated staging and safer reset semantics.

---

### 6) Persistent storage dialog reliability

**Finding:** Storage permission flow had reliability issues around when browser persistence request was executed.

**Action:** Moved `navigator.storage.persist()` invocation into the direct user-click handler and simplified promise resolution flow:

- `packages/web-ui/src/dialogs/PersistentStorageDialog.ts`

Updated docs to remove stale “known broken” note:

- `packages/web-ui/README.md`

**Result:** More reliable persistent storage permission behavior.

---

### 7) Agent package tests required prebuilt internal dependencies

**Finding:** `@mariozechner/pi-agent-core` tests failed in source checkout when internal package entries were not prebuilt.

**Action:** Added Vitest aliasing in:

- `packages/agent/vitest.config.ts`

to resolve `@mariozechner/pi-ai` from source.

Also expanded biome include scope to lint package vitest configs and normalized formatting:

- `biome.json`
- `packages/ai/vitest.config.ts`
- `packages/coding-agent/vitest.config.ts`

**Result:** Agent package tests now run from source checkout without requiring prebuild artifacts.

---

### 8) ExecutionEngine review step was a hardcoded placeholder

**Finding:** `ExecutionEngine` review mode always returned a placeholder rejection (`approved: false`) instead of performing a real review pass.

**Action:** Implemented real reviewer execution in:

- `packages/agent/src/execution-engine.ts`

using the existing reviewer prompt + parser contract and an LLM-backed review loop.

**Result:** Review mode now produces actual `approved/needs_fixes/rejected` outcomes rather than guaranteed retries/failures.

---

### 9) coding-agent test/runtime resolution gaps from source checkout

**Finding:** coding-agent tests and extension loading still had source-checkout friction:

- Vitest import resolution for internal monorepo packages required prebuilt dist entries.
- Extension loader alias resolution used `require.resolve(...)` only, which failed when sibling packages were not built.
- Git update tests used shorthand git sources instead of explicit `git:` prefixes required by strict parsing.

**Action:** Updated:

- `packages/coding-agent/vitest.config.ts` to resolve internal `@mariozechner/pi-*` packages from source.
- `packages/coding-agent/src/core/extensions/loader.ts` to fall back to sibling source entries when dist package entries are unavailable.
- `packages/coding-agent/test/git-update.test.ts` to use explicit `git:` source prefixes.

**Result:** coding-agent tests run successfully from source checkout, including extension-loading suites and git-update scenarios.

---

### 10) ExecutionEngine reviewer path lacked direct unit coverage

**Finding:** After implementing real reviewer execution in `ExecutionEngine`, there was no dedicated unit test coverage for retry/approval behavior.

**Action:** Added focused tests in:

- `packages/agent/test/execution-engine.test.ts`

covering:

- immediate approval (`VERDICT: approved`),
- retry when reviewer returns `needs_fixes`,
- rejection behavior when reviewer emits no assistant text.

**Result:** The reviewer execution path now has explicit regression coverage for core control flow.

---

### 11) ExecutionEngine decision logs omitted work summaries

**Finding:** `DecisionLogger` supports `work_summary`, but `ExecutionEngine` was not populating it when persisting review attempts.

**Action:** Updated:

- `packages/agent/src/execution-engine.ts`
- `packages/agent/test/execution-engine.test.ts`

to include summarized tool/work context in each logged review decision and to verify this behavior via unit tests.

**Result:** Decision logs now capture why a review failed/succeeded plus what work was attempted, improving auditability of retry cycles.

---

### 12) AI E2E test contained a silent no-op placeholder

**Finding:** In `packages/ai/test/stream.test.ts`, the Mistral “thinking mode” test body was fully commented out, causing a false-positive pass instead of an explicit skip.

**Action:** Converted that case to an explicit `it.skip(...)` with a clear rationale and preserved the intended test body for future re-enable.

**Result:** Test intent is now transparent; the suite no longer reports a misleading pass for a disabled scenario.

---

### 13) web-ui example still carried stale disabled persistence flow

**Finding:** The example app still had `PersistentStorageDialog` imports/calls commented out with “currently broken” TODO notes, despite the dialog fix.

**Action:** Re-enabled persistent storage prompt usage in:

- `packages/web-ui/example/src/main.ts`

and updated:

- `packages/web-ui/CHANGELOG.md`

to record the example app behavior alignment.

**Result:** Example behavior now matches the fixed dialog implementation and no longer advertises stale broken-state comments.

---

### 14) ExecutionEngine retry counters persisted across separate runs

**Finding:** `ExecutionEngine` stored retries in an instance field without resetting at the start of `runWithReview()`, so a previous run could exhaust retries for subsequent runs on the same instance.

**Action:** Updated:

- `packages/agent/src/execution-engine.ts`
- `packages/agent/test/execution-engine.test.ts`

to reset retry state per invocation and added regression coverage for sequential runs.

**Result:** Retry budgets are now applied independently per run, preventing unintended early exits in reused engine instances.

---

### 15) `pi agent` command in pods package was unimplemented

**Finding:** `packages/pods/src/commands/prompt.ts` terminated with `throw new Error("Not implemented")`, so `pi agent <model> ...` could never run.

**Action:** Implemented agent delegation flow in `prompt.ts`:

- create a temporary extension that registers a dynamic `pods-vllm` provider pointing at the selected pod/model endpoint,
- invoke coding-agent with that provider/model plus the pod-specific system prompt and user arguments,
- run coding-agent CLI via:
  - monorepo source fallback (`npx tsx packages/coding-agent/src/cli.ts`) during local development,
  - installed dist CLI when available,
  - npm package execution fallback (`npx --package @mariozechner/pi-coding-agent pi ...`) otherwise,
- return actionable error guidance when delegation fails and clean up temporary provider artifacts after execution.

**Result:** `pi agent` now executes the coding-agent CLI instead of hard-failing with a placeholder error.

---

### 16) pods `--pod` override could crash in `pi agent` flow

**Finding:** `promptModel()` assumed an override pod existed and directly dereferenced `loadConfig().pods[opts.pod]`, which could cause undefined access crashes for invalid pod names.

**Action:** Added explicit override pod validation in:

- `packages/pods/src/commands/prompt.ts`

with clear error messaging for unknown pod names.

**Result:** `pi agent ... --pod <name>` now fails gracefully with actionable feedback when the pod does not exist.

---

### 17) pods agent delegation failure handling exited inconsistently

**Finding:** `packages/pods/src/cli.ts` swallowed delegation errors with `process.exit(0)`, and `prompt.ts` forced process exits from deep helper code, making cleanup/error propagation brittle.

**Action:** Updated:

- `packages/pods/src/commands/prompt.ts` to throw structured errors after delegation failures (while still cleaning temporary artifacts in `finally`),
- `packages/pods/src/cli.ts` to surface agent delegation failures clearly and exit with non-zero status.

**Result:** Delegation failures now propagate consistently and do not report false-success exit codes.

---

### 18) pods temporary provider extension wrote resolved API key to disk

**Finding:** The initial dynamic-provider implementation serialized the resolved API key value into the temporary extension file.

**Action:** Hardened `packages/pods/src/commands/prompt.ts` to:

- register provider config with an environment-variable key reference (`PI_PODS_AGENT_API_KEY`),
- pass the resolved key only via child-process environment.

**Result:** Temporary extension artifacts no longer contain raw API key values.

---

### 19) pods agent command allowed conflicting provider/model overrides

**Finding:** Because user arguments are forwarded to coding-agent, callers could pass `--provider`/`--model` and bypass pod-selected routing.

**Action:** Added reserved-flag validation in:

- `packages/pods/src/commands/prompt.ts`

to reject conflicting `--provider` and `--model` arguments with explicit guidance.

**Result:** `pi agent <name>` now consistently targets the selected pod model and cannot be accidentally redirected by conflicting flags.

---

### 20) pods dynamic provider name could collide with user-defined providers

**Finding:** A static provider name (`pods-vllm`) risks collisions with persisted/custom provider registrations across repeated runs or user config.

**Action:** Updated `packages/pods/src/commands/prompt.ts` to generate a unique provider name per invocation (prefixed `pods-vllm-...`) and wire that name through extension registration + CLI arguments.

**Result:** Delegated runs are isolated from existing provider namespaces and avoid accidental provider override collisions.

---

### 21) pods docs/help text did not reflect reserved flag behavior

**Finding:** After enforcing reserved `--provider`/`--model` behavior for `pi agent`, user-facing help text still implied all coding-agent flags were supported unconditionally.

**Action:** Updated:

- `packages/pods/src/cli.ts` help output
- `packages/pods/README.md`

to clearly state that `--provider` and `--model` are managed by `pi` in pods agent mode.

**Result:** CLI/docs now match runtime behavior, reducing confusion and support friction.

---

### 22) pods package lacked changelog coverage for shipped fixes

**Finding:** `packages/pods` had no `CHANGELOG.md`, so recent pods command fixes were not captured in package release notes.

**Action:** Added:

- `packages/pods/CHANGELOG.md` with `## [Unreleased]` fixed entries for pods agent delegation hardening,
- `packages/pods/package.json` update to include `CHANGELOG.md` in published package files.

**Result:** pods package now has standard changelog tracking and ships the changelog alongside published artifacts.

---

### 23) pods prompt helper still used deep process exits for validation failures

**Finding:** `packages/pods/src/commands/prompt.ts` still called `process.exit(1)` for missing pod / missing model validations, bypassing the top-level `cli.ts` error handling pattern used by other `pi agent` failures.

**Action:** Updated `promptModel()` in:

- `packages/pods/src/commands/prompt.ts`

to throw explicit errors for:

- missing active pod / unknown `--pod` override
- unknown model on selected pod

and let `cli.ts` consistently render and exit non-zero.

**Result:** Error handling remains centralized at the CLI entrypoint, and validation failures now follow the same cleanup and reporting path as other delegation errors.

---

### 24) pods `--pod` override parsing was permissive and format-limited

**Finding:** `packages/pods/src/cli.ts` only parsed `--pod <name>` with `indexOf`, which:

- ignored `--pod=<name>` form,
- silently allowed `--pod` without a value,
- allowed duplicate `--pod` flags to pass through ambiguously.

**Action:** Added explicit `extractPodOverride()` parsing in:

- `packages/pods/src/cli.ts`

with behavior to:

- support both `--pod <name>` and `--pod=<name>`,
- reject missing `--pod` values,
- reject duplicate `--pod` usage,
- route command argument parsing through pod-flag-cleaned args.

Also normalized top-level CLI error rendering to print the message directly in red.

**Result:** Pod override parsing is deterministic and user errors are surfaced early with clear messages.

---

### 25) pods pod-override parsing did not honor `--` option terminator

**Finding:** After introducing stricter `--pod` parsing, argument scanning still continued through all tokens and could interpret post-terminator payload (`--`) as pod flags.

**Action:** Updated `extractPodOverride()` in:

- `packages/pods/src/cli.ts`

to stop parsing and preserve remaining arguments verbatim once `--` is encountered.

**Result:** `pi agent` now supports standard CLI option-terminator behavior, allowing literal message payloads that begin with `--` without false pod-flag parsing.

---

### 26) pods `--pod` flag was accepted on non-model commands

**Finding:** `--pod` parsing occurred for all non-`pods` commands, so non-model commands like `pi shell` could accept `--pod` even though docs scope override behavior to model commands only.

**Action:** Updated:

- `packages/pods/src/cli.ts`

to allow pod-override parsing only for model commands (`start`, `stop`, `list`, `logs`, `agent`) and reject `--pod` usage on other commands with a clear error.

**Result:** CLI behavior now matches documented command semantics and avoids silent/confusing flag acceptance on unrelated commands.

---

### 27) root README package metadata and check guidance drifted from current behavior

**Finding:** Root documentation still listed pods package as `@mariozechner/pi-pods` and stated `npm run check` required a prior build, both of which were stale after audit fixes and package naming updates.

**Action:** Updated:

- `README.md`

to:

- reference the correct package name `@mariozechner/pi` for pods,
- state that `npm run check` should pass from a fresh install without `npm run build`.

**Result:** Top-level contributor guidance now matches the current repository/package behavior.

---

### 28) pods README Node.js prerequisite lagged behind enforced engine

**Finding:** `packages/pods/README.md` still listed `Node.js 18+` even though `packages/pods/package.json` enforces `node >=20.0.0`.

**Action:** Updated:

- `packages/pods/README.md`
- `packages/pods/CHANGELOG.md`

to align the documented prerequisite to `Node.js 20+`.

**Result:** Installation guidance now matches the package’s enforced runtime requirement.

---

### 29) reserved flag validation ignored `--` option terminator

**Finding:** `packages/pods/src/commands/prompt.ts` scanned all forwarded args for reserved `--provider`/`--model` flags, including arguments after `--`, which should be treated as literal passthrough payload.

**Action:** Updated:

- `packages/pods/src/commands/prompt.ts`
- `packages/pods/CHANGELOG.md`

so reserved-flag scanning stops once `--` is encountered.

**Result:** Reserved flag protection remains intact for real options while preserving standard CLI terminator semantics for literal argument payloads.

---

### 30) pods agent used implicit API key fallback

**Finding:** `packages/pods/src/commands/prompt.ts` silently defaulted missing API keys to `"dummy"`, which led to unclear downstream auth failures.

**Action:** Updated:

- `packages/pods/src/commands/prompt.ts`
- `packages/pods/CHANGELOG.md`

to require `PI_API_KEY` (or explicit option-provided key) and fail early with a clear actionable error when missing.

**Result:** Authentication prerequisites are validated up front, making failures deterministic and easier to diagnose.

---

### 31) pods docs did not surface published binary name

**Finding:** `packages/pods/README.md` examples use `pi`, but the published package exposes the `pi-pods` binary. This mismatch can cause first-run confusion after global install.

**Action:** Updated:

- `packages/pods/README.md`
- `packages/pods/CHANGELOG.md`
- `README.md` (root package table description)

to explicitly document the `pi-pods` command name and include an alias pattern for users who prefer `pi`.

**Result:** Command naming expectations are now explicit in both package-level and repo-level documentation.

---

### 32) pods CLI help text was hardcoded to `pi`

**Finding:** `packages/pods/src/cli.ts` rendered help/usage strings with a hardcoded `pi` command name, even when invoked via a differently named binary (e.g., `pi-pods`).

**Action:** Updated:

- `packages/pods/src/cli.ts`
- `packages/pods/CHANGELOG.md`

to detect the invoked command basename and render help/usage output accordingly, with a fallback to `pi` for source-run entrypoints (`cli.ts`/`cli.js`).

**Result:** Help and usage text now accurately match the command users actually invoked, reducing naming confusion across install modes.

---

### 33) unknown command diagnostics were masked by `--pod` parsing

**Finding:** For unknown direct commands, parsing `--pod` early could raise pod-flag validation errors before the CLI reached its intended `Unknown command` handler.

**Action:** Updated:

- `packages/pods/src/cli.ts`
- `packages/pods/CHANGELOG.md`

to run pod-override parsing only for known direct commands and let unknown commands flow to the canonical default handler.

**Result:** Users now get deterministic, authoritative unknown-command errors instead of misleading pod-flag parsing failures.

---

### 34) coding-agent README referenced deprecated agent package name

**Finding:** `packages/coding-agent/README.md` "See Also" still linked to `@mariozechner/pi-agent`, while the package is now published as `@mariozechner/pi-agent-core`.

**Action:** Updated:

- `packages/coding-agent/README.md`
- `packages/coding-agent/CHANGELOG.md`

to point to `@mariozechner/pi-agent-core`.

**Result:** Package cross-reference docs now match the current package naming and reduce install confusion.

---

### 35) pods CLI argument parsing logic lacked direct regression tests

**Finding:** Repeated hardening changes to pods command parsing (`--pod` behavior and invoked-command naming) lived only in `cli.ts` without targeted automated regression coverage.

**Action:** Added:

- `packages/pods/src/cli-args.ts` (extracted reusable parser helpers),
- `packages/pods/test/cli-args.test.ts` (Node test coverage),
- `packages/pods/src/cli.ts` wiring to use shared helpers,
- `packages/pods/CHANGELOG.md` update.

Covered scenarios include:

- `resolveAppCommand()` fallback behavior for source entrypoints,
- invoked-command basename handling for wrappers/binaries,
- `--pod <name>` and `--pod=<name>` extraction,
- missing/duplicate `--pod` validation,
- non-model command rejection,
- `--` terminator passthrough behavior.

**Result:** pods CLI parsing behavior now has focused, repeatable regression coverage to guard against future argument-handling drift.

---

### 36) pods runtime guidance still hardcoded `pi` in command modules

**Finding:** Even after dynamic help/usage rendering in `cli.ts`, multiple runtime messages in `commands/models.ts`, `commands/pods.ts`, and `commands/prompt.ts` still hardcoded `pi`, causing inconsistent guidance when invoked as `pi-pods` or wrapper command names.

**Action:** Added:

- `packages/pods/src/cli-command.ts`

and updated:

- `packages/pods/src/cli.ts` (sets invoked command for downstream modules),
- `packages/pods/src/commands/models.ts`,
- `packages/pods/src/commands/pods.ts`,
- `packages/pods/src/commands/prompt.ts`,
- `packages/pods/CHANGELOG.md`.

Runtime guidance now reads the active command label from shared command context and renders actionable messages with the invoked name.

**Result:** Help text, errors, and follow-up command hints now consistently reference the command users actually executed.

---

### 37) shared command-context helper needed explicit regression coverage

**Finding:** After introducing dynamic command-context propagation via `cli-command.ts`, there was no direct automated test protecting default/fallback command behavior.

**Action:** Added:

- `packages/pods/test/cli-command.test.ts`
- `packages/pods/CHANGELOG.md` update

with assertions for:

- default fallback (`pi`) when command context is unset,
- explicit command propagation via `setCliCommand()` for wrapper/binary flows.

**Result:** Dynamic command-name state now has targeted regression coverage, reducing risk of future message/help drift.

---

### 38) prompt argument helper logic was embedded and untested

**Finding:** `packages/pods/src/commands/prompt.ts` still embedded reserved-flag parsing and provider-name generation logic directly, with no focused unit tests guarding terminator semantics and naming format.

**Action:** Added:

- `packages/pods/src/commands/prompt-args.ts`
- `packages/pods/test/prompt-args.test.ts`

and updated:

- `packages/pods/src/commands/prompt.ts`
- `packages/pods/CHANGELOG.md`

to centralize `findReservedFlag()` and `createProviderName()` behind reusable helpers with dedicated tests.

**Result:** Prompt argument parsing and provider-name generation now have explicit regression coverage and are easier to maintain independently from delegation flow code.

---

### 39) pods README advertised removed `pi-agent` command

**Finding:** `packages/pods/README.md` still documented `pi-agent` as a command provided by `@mariozechner/pi`, but the pods package publishes `pi-pods` and standalone agent usage is provided by `@mariozechner/pi-coding-agent`.

**Action:** Updated:

- `packages/pods/README.md`
- `packages/pods/CHANGELOG.md`

to replace `pi-agent` examples with explicit standalone coding-agent invocation:

- `npx --yes --package @mariozechner/pi-coding-agent pi ...`

and clarified environment variable wording accordingly.

**Result:** Standalone-agent documentation now aligns with actual package boundaries and avoids directing users to a non-existent command.

---

### 40) pods regression tests lacked package-level runner integration

**Finding:** Newly added pods regression tests were executable via direct `tsx --test` commands but not wired to a package-level `npm test` script.

**Action:** Updated:

- `packages/pods/package.json`
- `packages/pods/CHANGELOG.md`

to add:

- `"test": "tsx --test test/**/*.test.ts"`

**Result:** pods helper regressions are now runnable through standard workspace test workflows (`npm --workspace "@mariozechner/pi" test`), improving discoverability and CI friendliness.

---

### 41) model instance names were unsafely interpolated into shell commands

**Finding:** pods model lifecycle commands interpolated model instance names into remote shell command strings and log paths without explicit validation, creating avoidable command/path injection risk from malformed names.

**Action:** Added:

- `packages/pods/src/model-name.ts`
- `packages/pods/test/model-name.test.ts`

and updated:

- `packages/pods/src/commands/models.ts`
- `packages/pods/README.md`
- `packages/pods/CHANGELOG.md`

to enforce model-name constraints (`[A-Za-z0-9._-]`, length 1-64, starting with alphanumeric) for start/stop/log flows, and to skip unsafe config entries during status verification.

**Result:** Model-name handling is now explicitly validated before shell interpolation, reducing injection surface and making naming rules clear to users.

---

### 42) model ids were accepted without shell-safety validation

**Finding:** `pi start <model>` accepted arbitrary model-id strings which are later interpolated into remote shell script content (`model_run.sh`) without upfront validation.

**Action:** Added:

- `packages/pods/src/model-id.ts`
- `packages/pods/test/model-id.test.ts`

and updated:

- `packages/pods/src/commands/models.ts`
- `packages/pods/README.md`
- `packages/pods/CHANGELOG.md`

to enforce model-id constraints (`[A-Za-z0-9._/-]`, 1-128 chars, leading alphanumeric) before deployment.

**Result:** Unsafe model-id inputs are rejected early, reducing shell interpolation risk while preserving common HuggingFace-style model id formats.

---

### 43) `--memory` / `--context` options accepted invalid values

**Finding:** CLI parsing accepted arbitrary `--memory` and `--context` values, allowing invalid values (e.g., `--memory abc`, `--context none`) to flow into vLLM args and fail later with unclear runtime errors.

**Action:** Added:

- `packages/pods/src/model-options.ts`
- `packages/pods/test/model-options.test.ts`

and updated:

- `packages/pods/src/cli.ts`
- `packages/pods/CHANGELOG.md`

to normalize and validate:

- `--memory`: percentage in `(0, 100]` (supports `50` or `50%`),
- `--context`: one of `4k|8k|16k|32k|64k|128k` or a positive token count.

**Result:** Invalid option values now fail fast with actionable error messages before any deployment side effects.

---

### 44) custom `--vllm` args were interpolated as raw shell fragments

**Finding:** In model startup flow, custom `--vllm` args were joined with spaces and injected into script content without per-argument shell quoting, which could mis-handle spaces/metacharacters and increase shell injection surface.

**Action:** Added:

- `packages/pods/src/shell-quote.ts`
- `packages/pods/test/shell-quote.test.ts`

and updated:

- `packages/pods/src/commands/models.ts`
- `packages/pods/CHANGELOG.md`

to quote each vLLM arg token with safe single-quote escaping before template insertion.

**Result:** Custom vLLM args are now passed as literal arguments (including values with spaces or shell metacharacters) instead of raw shell fragments.

---

### 45) pod setup command arguments were interpolated without robust quoting

**Finding:** `setupPod()` built the SSH setup command by wrapping user/environment-derived values in simple single quotes. Inputs containing quotes/spaces could break argument boundaries and were not robustly escaped.

**Action:** Added/updated:

- `packages/pods/src/commands/pods.ts`
- `packages/pods/test/pods-setup-command.test.ts`
- `packages/pods/CHANGELOG.md`

by extracting a `buildPodSetupCommand()` helper that shell-quotes each argument token (`--models-path`, `--hf-token`, `--vllm-api-key`, optional `--mount`, `--vllm`) using shared shell-quoting utilities, with dedicated regression coverage.

**Result:** Pod setup command construction is now resilient to spaces/single quotes and preserves literal argument semantics across SSH execution.

---

### 46) runtime environment exports still used raw string interpolation

**Finding:** Model startup environment exports in `packages/pods/src/commands/models.ts` built `export KEY='value'` lines with direct string interpolation, which could mishandle quote-heavy values and did not validate env var names from model configs.

**Action:** Updated:

- `packages/pods/src/shell-quote.ts`
- `packages/pods/src/commands/models.ts`
- `packages/pods/test/shell-quote.test.ts`
- `packages/pods/CHANGELOG.md`

by adding `shellExport()`:

- validates env var names (`[A-Za-z_][A-Za-z0-9_]*`),
- shell-quotes values consistently,
- used for standard runtime exports and model-specific env overrides.

**Result:** Runtime env injection now uses validated names and quote-safe value handling, reducing shell interpolation risk in startup flows.

---

### 47) pod names lacked consistent input validation

**Finding:** Pod names supplied to `pods setup/active/remove`, `shell/ssh`, and model-command `--pod` overrides were accepted without normalized constraints, allowing confusing/unportable identifiers and uneven validation behavior.

**Action:** Added:

- `packages/pods/src/pod-name.ts`
- `packages/pods/test/pod-name.test.ts`

and updated:

- `packages/pods/src/cli.ts`
- `packages/pods/src/commands/pods.ts`
- `packages/pods/README.md`
- `packages/pods/CHANGELOG.md`

to enforce pod-name constraints (`[A-Za-z0-9._-]`, 1-64 chars, leading alphanumeric) across CLI parsing and command handlers.

**Result:** Pod naming is now validated consistently across setup, overrides, and direct pod-targeting commands with clear actionable errors.

---

### 48) persisted model state was trusted without PID/port sanity checks

**Finding:** `list`, `stop`, and `stopAll` flows interpolated persisted `pid`/`port` values from config into remote shell checks/kill commands without runtime sanity checks, which is risky when local config is stale or manually edited.

**Action:** Added:

- `packages/pods/src/process-identifiers.ts`
- `packages/pods/test/process-identifiers.test.ts`

and updated:

- `packages/pods/src/commands/models.ts`
- `packages/pods/CHANGELOG.md`

to enforce integer range validation for:

- PIDs (`1..2147483647`)
- ports (`1..65535`)

with graceful handling/reporting in list/stop/stopAll flows.

**Result:** Malformed persisted state is now detected and surfaced safely before any shell interpolation/remote process control.

---

### 49) ssh command parsing relied on naive whitespace splitting

**Finding:** SSH command strings from config were split with `string.split(" ")`, which breaks quoted arguments (e.g., identity files with spaces) and could mis-parse option/value pairs used by shell/ssh/scp flows.

**Action:** Updated:

- `packages/pods/src/ssh.ts`
- `packages/pods/src/cli.ts`
- `packages/pods/src/commands/models.ts`
- `packages/pods/test/ssh-parse.test.ts`
- `packages/pods/CHANGELOG.md`

by introducing shell-aware token parsing (`parseShellCommand`) and host extraction helpers used consistently by SSH execution, SCP handling, interactive shell launch, and model URL/log host resolution (including attached short options like `-p2222`).

**Result:** SSH command handling is now robust for quoted/escaped arguments and avoids brittle tokenization behavior.

---

### 50) `pi agent` still used brittle host extraction and unvalidated persisted ports

**Finding:** While SSH helper flows were hardened, `packages/pods/src/commands/prompt.ts` still extracted pod hostnames by naive `split(" ")` + `@` scanning and accepted persisted model ports without validation when building provider base URLs.

**Action:** Updated:

- `packages/pods/src/commands/prompt.ts`
- `packages/pods/CHANGELOG.md`

to:

- resolve host via `extractHostFromSshCommand(...)` (shell-aware parsing),
- validate `modelConfig.port` with `isValidPort(...)` before provider registration.

**Result:** Agent delegation now uses robust host resolution and rejects malformed persisted port values before constructing endpoint URLs.

---

### 51) models-path extraction from `--mount` was whitespace-fragile

**Finding:** `pods setup` inferred `modelsPath` from `--mount` using plain `split(" ")`, which fails for quoted mount targets containing spaces and for malformed commands.

**Action:** Added:

- `packages/pods/src/mount-command.ts`
- `packages/pods/test/mount-command.test.ts`

and updated:

- `packages/pods/src/cli.ts`
- `packages/pods/src/commands/pods.ts`
- `packages/pods/CHANGELOG.md`

to parse mount commands with shell-aware tokenization and only infer absolute target paths.

**Result:** `--mount` models-path inference now handles quoted paths safely and rejects malformed/relative targets instead of extracting brittle tokens.

---

### 52) ssh command fields allowed non-ssh binaries

**Finding:** Parsed SSH command fields accepted any binary token as command entrypoint, which could trigger accidental local non-SSH execution when config values are malformed or tampered.

**Action:** Updated:

- `packages/pods/src/ssh.ts`
- `packages/pods/test/ssh-parse.test.ts`
- `packages/pods/CHANGELOG.md`

to enforce SSH binary validation (`ssh`, `*/ssh`, and `ssh.exe` forms) before SSH/SCP execution paths proceed.

**Result:** Pod command execution now rejects non-SSH command binaries early, with explicit errors and regression coverage.

---

### 53) agent git staging/commit paths still used shell-composed commands

**Finding:** `packages/agent/src/project-loop.ts`, `packages/agent/src/tdd-loop.ts`, and `packages/agent/src/state-files.ts` still executed some git operations via shell-composed strings, which is brittle for unusual paths and unnecessary given argument-safe process APIs.

**Action:** Updated:

- `packages/agent/src/project-loop.ts`
- `packages/agent/src/tdd-loop.ts`
- `packages/agent/src/state-files.ts`
- `packages/agent/test/state-files.test.ts`
- `packages/agent/CHANGELOG.md`

to use argument-based git invocation (`execFileSync("git", ["diff"...])`, `["restore"...]`, `["add", "--", path]`, `["commit", "-m", message]`, `["tag", ...]`), include cached (`--cached`) file detection in project-loop staging, and added regression tests proving `commitState()` handles both path-with-spaces commits and tracked state-file deletions.

**Result:** Agent loop/state git operations now avoid shell-string command composition and are robust for edge-case paths.

**Test hygiene follow-up:** state-file git fixture setup now uses `git init --quiet --initial-branch=main` to remove noisy branch-name hints and keep agent test output focused on assertions.

---

### 54) `pi agent` could silently fallback to localhost for malformed SSH host config

**Finding:** `packages/pods/src/commands/prompt.ts` previously defaulted host resolution to `localhost` when host extraction failed, which could misroute agent requests if pod SSH config was malformed/tampered.

**Action:** Updated:

- `packages/pods/src/commands/prompt.ts`
- `packages/pods/CHANGELOG.md`

to require successful host extraction and throw a clear configuration error if the SSH command does not contain a resolvable host target.

**Result:** Agent endpoint routing now fails safe on malformed SSH host config instead of silently targeting localhost.

**Regression coverage follow-up:** Added dedicated unit tests for `promptModel` validation paths (invalid SSH host config, invalid persisted model port) to keep these early-fail safeguards from regressing.

---

### 55) agent mechanical gates used shell-composed command execution

**Finding:** `packages/agent/src/gates.ts` executed `PI_TEST_COMMAND` / `PI_VALIDATE_COMMAND` through shell-composed command strings, which is brittle for quoting and unnecessary for deterministic gate execution.

**Action:** Updated:

- `packages/agent/src/gates.ts`
- `packages/agent/test/gates.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- parse gate command strings into argv (`parseCommand`) with quote/escape handling,
- execute via `execFileSync(binary, args)` (no shell string composition),
- evaluate `PI_TEST_COMMAND` / `PI_VALIDATE_COMMAND` at call-time (not module-load time).

**Result:** Gate command execution is now argument-safe, deterministic, and supports runtime env overrides consistently.

---

### 56) `writeState()` used path-join parent derivation instead of `dirname`

**Finding:** `packages/agent/src/state-files.ts` created parent directories using `join(path, "..")`, which is less clear and can be brittle compared to direct dirname derivation for nested state-file paths.

**Action:** Updated:

- `packages/agent/src/state-files.ts`
- `packages/agent/test/state-files.test.ts`
- `packages/agent/CHANGELOG.md`

to use `dirname(path)` for parent directory creation and added regression coverage that nested relative state-file writes succeed.

**Result:** State-file writing now uses explicit parent-directory derivation with verified nested-path behavior.

---

### 57) invalid gate command syntax could throw instead of returning a gate result

**Finding:** After moving gate execution to parsed argv handling, parse failures (e.g., unmatched quotes in `PI_VALIDATE_COMMAND`) could throw before returning `GateResult`.

**Action:** Updated:

- `packages/agent/src/gates.ts`
- `packages/agent/test/gates.test.ts`
- `packages/agent/CHANGELOG.md`

to catch parse errors in `runInCwd(...)` and surface them as structured gate failures (`passed: false`, diagnostic output), with regression coverage for invalid command syntax.

**Result:** Mechanical gates now fail deterministically with structured output even when command configuration is malformed.

---

### 58) red gate treated test-command invocation errors as successful "red" outcomes

**Finding:** Red gate semantics (`exitCode !== 0`) could mistakenly pass when test command invocation itself failed (e.g., malformed command syntax), which is not equivalent to meaningful failing tests.

**Action:** Updated:

- `packages/agent/src/gates.ts`
- `packages/agent/test/gates.test.ts`
- `packages/agent/CHANGELOG.md`

to track invocation errors explicitly and fail red gate with diagnostics when the test command cannot be executed.

**Result:** Red gate now distinguishes "tests failed as expected" from "test command failed to run," improving loop correctness.

---

### 59) review-gate parsing drifted from shared reviewer contract parser

**Finding:** `validateReview()` in gates used independent heuristic parsing logic, which risked drift from the canonical reviewer parsing behavior in `parseReviewResponse()`.

**Action:** Updated:

- `packages/agent/src/gates.ts`
- `packages/agent/test/gates.test.ts`
- `packages/agent/CHANGELOG.md`

to route review gate parsing through `parseReviewResponse()`, while still failing the gate when output is truly unparseable.

**Result:** Review gate verdict handling is now consistent with reviewer prompt parsing semantics across agent flows.

---

### 60) pods package test script prevented efficient file-filtered runs

**Finding:** `packages/pods/package.json` used `tsx --test test/**/*.test.ts`, which always ran the full suite even when users passed specific files via `npm test -- <file>`.

**Action:** Updated:

- `packages/pods/package.json`
- `packages/pods/CHANGELOG.md`

to use `tsx --test` so tests are auto-discovered by default while still supporting file-level filtering arguments.

**Result:** Pods tests now support fast targeted execution (`npm --workspace "@mariozechner/pi" test -- test/ssh-parse.test.ts`) without sacrificing default full-suite runs.

---

### 61) blank gate env command values caused avoidable empty-command failures

**Finding:** `PI_TEST_COMMAND` / `PI_VALIDATE_COMMAND` values containing only whitespace were treated as configured commands, producing empty-command parse failures instead of falling back to default gate commands.

**Action:** Updated:

- `packages/agent/src/gates.ts`
- `packages/agent/test/gates.test.ts`
- `packages/agent/CHANGELOG.md`

to trim env overrides and fallback to defaults when the configured value is blank/whitespace.

**Result:** Gate command overrides now behave robustly for unset/blank env values and avoid confusing empty-command failures.

---

### 62) GPU-type parsing logic was duplicated across pods flows

**Finding:** GPU type extraction (`"NVIDIA H200" -> "H200"`) was duplicated in both `model-configs` selection and known-model compatibility display, increasing drift risk for vendor prefixes/formatting edge cases.

**Action:** Added:

- `packages/pods/src/gpu-name.ts`
- `packages/pods/test/gpu-name.test.ts`

and updated:

- `packages/pods/src/model-configs.ts`
- `packages/pods/src/commands/models.ts`
- `packages/pods/CHANGELOG.md`

to centralize GPU type derivation through `extractGpuType(...)`.

**Result:** GPU compatibility matching and display now share one tested parsing path.

---

### 63) blank `!` config commands still spawned shell execution attempts

**Finding:** In coding-agent config value resolution, a value like `"!"` or `"!   "` was treated as a shell command invocation, causing unnecessary execution attempts for effectively empty command strings.

**Action:** Updated:

- `packages/coding-agent/src/core/resolve-config-value.ts`
- `packages/coding-agent/test/resolve-config-value.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to short-circuit blank `!` commands to `undefined` without attempting shell execution, with regression tests for blank command behavior and header-value filtering.

**Result:** Config command resolution now handles malformed/blank shell directives safely and predictably.

---

### 64) shell-command cache keys were sensitive to leading/trailing whitespace

**Finding:** Config shell-command caching in coding-agent keyed on raw config strings, so semantically identical commands like `"!echo key"` and `"!   echo key   "` could bypass cache reuse and execute multiple times.

**Action:** Updated:

- `packages/coding-agent/src/core/resolve-config-value.ts`
- `packages/coding-agent/test/resolve-config-value.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to normalize cache keys by trimmed command text and added regression coverage proving equivalent whitespace variants hit the same cache entry.

**Result:** Shell-command-backed config resolution now caches consistently across whitespace-equivalent command forms.

---

### 65) empty environment variables fell back to literal config keys

**Finding:** In coding-agent value resolution, when a configured environment variable existed but was empty (`""`), resolution could fall back to the literal config key name, which is confusing and incorrect for auth/header semantics.

**Action:** Updated:

- `packages/coding-agent/src/core/resolve-config-value.ts`
- `packages/coding-agent/test/resolve-config-value.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to treat explicitly empty env-var values as unresolved (`undefined`) while keeping literal fallback behavior only for truly undefined env vars.

**Result:** Env-based value resolution now cleanly distinguishes unset vs empty values, avoiding accidental literal-key fallback.

---

### 66) prompt-template argument parsing dropped shell-style escaped content

**Finding:** `parseCommandArgs(...)` in prompt-template expansion handled only basic quotes and whitespace splitting, which caused shell-style escaped arguments (escaped quotes/spaces) to parse incorrectly and dropped explicit empty quoted arguments.

**Action:** Updated:

- `packages/coding-agent/src/core/prompt-templates.ts`
- `packages/coding-agent/test/prompt-templates.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to make command-argument parsing preserve empty quoted args and correctly handle escaped quotes/spaces/backslashes in shell-style input forms.

**Result:** Prompt-template argument expansion now handles realistic command input safely and predictably for quoted/escaped edge cases.

---

### 67) extension external-editor command parsing used naive whitespace splits

**Finding:** Extension editor launch (`$EDITOR` / `$VISUAL`) split command strings by plain spaces, which broke quoted editor binaries/arguments (for example editor paths containing spaces).

**Action:** Added:

- `packages/coding-agent/src/utils/parse-command-args.ts`

and updated:

- `packages/coding-agent/src/core/prompt-templates.ts`
- `packages/coding-agent/src/modes/interactive/components/extension-editor.ts`
- `packages/coding-agent/CHANGELOG.md`

to share one shell-style argument parser and apply it to extension external-editor launch command parsing.

**Result:** Extension editor invocation now correctly handles quoted/escaped editor command arguments instead of splitting them incorrectly.

---

### 68) shared command-arg parser lacked direct regression coverage

**Finding:** After extracting a shared shell-style command-argument parser for prompt templates and extension-editor command launch, coverage existed only indirectly through prompt-template tests.

**Action:** Added:

- `packages/coding-agent/test/parse-command-args.test.ts`

to directly validate parser behavior for quoted-empty args and escaped quotes/spaces/backslashes.

**Result:** Shared command parser behavior is now protected by focused regression tests independent of prompt-template substitution logic.

---

### 69) malformed external-editor commands were accepted silently

**Finding:** Extension external-editor launch reused shared parser output directly, so malformed quoted command strings could be tolerated and produce unintended editor invocation arguments.

**Action:** Updated:

- `packages/coding-agent/src/utils/parse-command-args.ts`
- `packages/coding-agent/src/modes/interactive/components/extension-editor.ts`
- `packages/coding-agent/test/parse-command-args.test.ts`

to add strict parsing mode for command invocation contexts and enforce strict parsing for extension-editor `$EDITOR`/`$VISUAL` command launch.

**Result:** Extension editor command launch now rejects malformed quoted command strings instead of invoking partially parsed arguments.

---

### 70) interactive external-editor command parsing still used naive splitting

**Finding:** While extension editor launch had been moved to shared parser logic, interactive-mode external editor launch still split `$EDITOR`/`$VISUAL` by literal spaces.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/CHANGELOG.md`

to reuse shared parser logic in strict mode for interactive external-editor launch as well, including guard handling for invalid parsed command values.

**Result:** Both interactive and extension editor launch paths now use consistent strict parsing for quoted/escaped editor command arguments.

---

### 71) strict editor command parsing could still bubble exceptions to UI handlers

**Finding:** Strict parsing was introduced for external editor command invocations, but strict-parse failures could still throw through UI action handlers instead of being handled as invalid invocation state.

**Action:** Updated:

- `packages/coding-agent/src/utils/parse-command-args.ts`
- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/src/modes/interactive/components/extension-editor.ts`
- `packages/coding-agent/test/parse-command-args.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to add `parseCommandInvocation(...)` (safe strict parser wrapper) and route both interactive and extension editor launch paths through it.

**Result:** Malformed `$EDITOR`/`$VISUAL` strings now fail safely (no uncaught strict-parse exceptions), with stable UI behavior.

---

### 72) interactive `/export` command parsing broke quoted output paths

**Finding:** Interactive `/export` command handling split input on generic whitespace, so quoted output paths containing spaces were parsed incorrectly.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/test/parse-command-args.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to parse `/export` input using shared strict argument parsing and surface syntax errors for malformed quoted input.

**Result:** `/export "path with spaces.html"` style usage now resolves correctly, and malformed quote syntax is handled with a clear error instead of silent misparsing.

---

### 73) interactive `/share` used a fixed temp export filename

**Finding:** Interactive `/share` exported session HTML to a fixed temp filename (`session.html`), risking path collisions between concurrent invocations/sessions and stale file interference.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/CHANGELOG.md`

to export share payloads to a unique temp filename per invocation (`pi-session-share-<uuid>.html`).

**Result:** `/share` temp export flow now avoids fixed-path collisions and stale temp-file reuse.

---

### 74) command-arg parser escaped Windows path backslashes incorrectly

**Finding:** Shared command argument parsing treated any backslash as an escape marker, which could strip backslashes from Windows-style paths (e.g. `C:\Users\...`) when characters after `\` were not intended escapes.

**Action:** Updated:

- `packages/coding-agent/src/utils/parse-command-args.ts`
- `packages/coding-agent/test/parse-command-args.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to only treat backslashes as escapes for supported escaped characters (whitespace, quotes, backslash), preserving non-escape backslashes in normal and quoted path forms.

**Result:** Windows-style path arguments are now preserved correctly while existing escaped-space/quote behavior remains intact.

---

### 75) pods SSH shell parser stripped backslashes from Windows command paths

**Finding:** Pods SSH command parsing treated all backslashes as generic escapes, which could strip backslashes from Windows-style `ssh.exe` command paths (`C:\Windows\...`) and break host/binary parsing.

**Action:** Updated:

- `packages/pods/src/ssh.ts`
- `packages/pods/test/ssh-parse.test.ts`
- `packages/pods/CHANGELOG.md`

to preserve non-escape backslashes while still supporting escaped whitespace/quotes and to add regression coverage for Windows backslash-path parsing.

**Result:** Pods SSH command parsing now supports Windows-style `ssh.exe` command paths using backslashes as well as forward slashes.

---

### 76) agent gate command parser stripped backslashes from Windows binary paths

**Finding:** Agent mechanical-gate command parsing treated all backslashes as generic escapes, which could corrupt Windows-style binary paths in `PI_TEST_COMMAND` / `PI_VALIDATE_COMMAND`.

**Action:** Updated:

- `packages/agent/src/gates.ts`
- `packages/agent/test/gates.test.ts`
- `packages/agent/CHANGELOG.md`

to preserve non-escape backslashes while still supporting escaped whitespace/quote sequences, and added regression coverage for Windows-style gate command binaries.

**Result:** Mechanical gate command overrides now parse Windows-style binary paths reliably without losing backslashes.

---

### 77) prompt-template expansion silently accepted malformed quoted args

**Finding:** Prompt-template expansion accepted malformed quoted argument syntax and continued with lenient parsing, which could silently mis-expand template arguments.

**Action:** Updated:

- `packages/coding-agent/src/core/prompt-templates.ts`
- `packages/coding-agent/test/prompt-templates.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to enforce strict quoted-argument parsing during template expansion and added regression coverage for unmatched-quote rejection.

**Result:** Malformed quoted template arguments now fail fast with explicit parsing errors instead of silently producing incorrect expansions.

---

### 78) command-name parsing only recognized literal spaces as separators

**Finding:** Prompt-template and slash-command name parsing in coding-agent used `indexOf(" ")`, so tab-separated command invocations could fail to resolve command/template names correctly.

**Action:** Updated:

- `packages/coding-agent/src/core/prompt-templates.ts`
- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/test/prompt-templates.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to detect the first whitespace separator using `search(/\s/)` and added regression coverage for tab-separated template invocation.

**Result:** Slash-command and prompt-template parsing now handles space- and tab-separated command arguments consistently.

---

### 79) interactive extension-command detection failed for tab-separated args

**Finding:** Interactive extension-command detection still split on literal spaces, so tab-separated extension invocations could be misclassified as non-extension commands in compaction/retry queue paths.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/test/interactive-mode-status.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to use first-whitespace detection for extension command names and added regression tests for tab-separated extension command detection.

**Result:** Interactive extension-command detection now handles tab-separated and space-separated forms consistently.

---

### 80) mom docker sandbox selector accepted unsafe container-name characters

**Finding:** Mom docker sandbox selection accepted arbitrary container-name text, which later flowed into shell-composed `docker exec` command invocation and allowed unsafe characters in container identifiers.

**Action:** Updated:

- `packages/mom/src/sandbox.ts`
- `packages/mom/test/sandbox.test.ts`
- `packages/mom/CHANGELOG.md`

to validate docker container names against a safe pattern (`[A-Za-z0-9][A-Za-z0-9_.-]*`) and reject invalid names before command execution.

**Result:** Docker sandbox mode now rejects invalid/unsafe container names early, preventing unsafe shell interpolation in sandbox command execution.

---

### 81) mom docker sandbox execution still used shell-composed `docker exec`

**Finding:** Even with container-name validation, docker sandbox execution composed `docker exec ... sh -c ...` as a shell string before host execution, leaving unnecessary shell interpolation surface.

**Action:** Updated:

- `packages/mom/src/sandbox.ts`
- `packages/mom/test/sandbox.test.ts`
- `packages/mom/CHANGELOG.md`

to execute docker sandbox commands via argv-based `spawn("docker", ["exec", ...])` and added regression coverage for docker exec argv construction.

**Result:** Mom docker sandbox command execution no longer relies on shell-composed host command strings, reducing interpolation risk and aligning with argument-safe execution patterns used elsewhere.

---

### 82) mom package lacked a standard workspace test entrypoint

**Finding:** Mom regression tests were runnable via direct `tsx --test ...` invocation, but `@mariozechner/pi-mom` had no package-level `npm test` script for standard workspace-targeted execution.

**Action:** Updated:

- `packages/mom/package.json`
- `packages/mom/CHANGELOG.md`

to add a package-level test script (`tsx --test`) supporting full-suite default runs and file-filtered runs via `npm test -- <pattern>`.

**Result:** Mom tests can now run through standard workspace script invocation (`npm --workspace "@mariozechner/pi-mom" test`), consistent with other packages.

---

### 83) mom sandbox process runners did not handle spawn `error` events

**Finding:** `execSimple()` and executor process runners used `spawn(...)` but only listened for `close`. Missing-binary failures (`ENOENT`, etc.) emit `error` events; without listeners those failures can surface as uncaught runtime errors instead of controlled command failures.

**Action:** Updated:

- `packages/mom/src/sandbox.ts`
- `packages/mom/test/sandbox.test.ts`
- `packages/mom/CHANGELOG.md`

to add explicit spawn `error` listeners with single-settlement guards in both sandbox runners, and added regression coverage proving docker-unavailable handling exits cleanly through existing validation flow.

**Result:** Sandbox command execution now handles spawn startup failures predictably and reports them through existing error handling instead of relying on uncaught process-level errors.

---

### 84) agent `spawnScript()` had abort/timeout settlement races

**Finding:** `spawnScript()` rejected on timeout/abort but did not guard single settlement or remove abort listeners consistently, allowing abort/timeout/error/close races to compete and making pre-aborted signals start subprocesses unnecessarily.

**Action:** Updated:

- `packages/agent/src/sub-agent.ts`
- `packages/agent/test/sub-agent.test.ts`
- `packages/agent/CHANGELOG.md`

to reject immediately for pre-aborted signals, enforce single-settlement cleanup across abort/timeout/error/close paths, and add regression tests for success, pre-abort, in-flight abort, and timeout behavior.

**Result:** Subprocess spawning in agent helpers now has deterministic cancellation/timeout semantics with clean listener teardown and race-safe promise settlement.

---

### 85) coding-agent RPC client startup could miss spawn/startup failures

**Finding:** `RpcClient.start()` used a fixed startup sleep and only checked `exitCode`, which could miss startup-time spawn errors (e.g., missing runtime binary) and leave partially initialized client state after failed starts.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `packages/coding-agent/test/rpc-client.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to add deterministic startup failure handling (spawn error + early exit), single-settlement startup lifecycle guards, and cleanup of partially initialized process/readline state on failure. Added targeted regression tests for missing runtime and immediate CLI-exit startup failures.

**Result:** RPC client startup now fails fast and predictably on runtime/startup issues, with clean client-state rollback and actionable error reporting.

---

### 86) coding-agent `execCommand()` reported cancelled processes as successful

**Finding:** Shared `execCommand()` could return exit code `0` for cancelled subprocesses (`close` with `code === null`), spawned even when the provided `AbortSignal` was already aborted, and dropped spawn-error details from stderr.

**Action:** Updated:

- `packages/coding-agent/src/core/exec.ts`
- `packages/coding-agent/test/exec.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to short-circuit pre-aborted signals, enforce non-zero exit status for killed/cancelled processes, and propagate spawn error messages into stderr. Added regression tests for success path, missing binary spawn failure, pre-aborted signal behavior, and timeout cancellation semantics.

**Result:** Shared subprocess execution now reports cancellation/failure outcomes accurately and surfaces actionable spawn diagnostics for extension/runtime callers.

---

### 87) interactive `/share` gist flow could hang on spawn failures

**Finding:** `/share` gist creation in interactive mode used a manual `spawn("gh", ...)` promise that only handled `close`. Spawn-time failures could leave the loader path waiting indefinitely instead of surfacing an actionable error.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/CHANGELOG.md`

to route gist creation through shared `execCommand()` with abort-signal support, reusing hardened spawn/cancellation/error handling semantics.

**Result:** `/share` gist execution now fails and cancels through the same deterministic subprocess path as other command execution, preventing loader hangs on spawn failures.

---

### 88) pods model log streaming could hang on spawn-time SSH failures

**Finding:** Pods model log streaming paths (`startModel` startup tail + `logs` command) awaited process exit only. If SSH process spawning failed, error events were not handled consistently and could leave log streaming flows hanging.

**Action:** Updated:

- `packages/pods/src/process-exit.ts`
- `packages/pods/src/commands/models.ts`
- `packages/pods/test/process-exit.test.ts`
- `packages/pods/CHANGELOG.md`

to add a shared `waitForProcessExit()` helper handling both `exit` and `error`, and routed model log streaming flows through it with explicit error reporting.

**Result:** Pods model log monitoring now handles spawn failures deterministically and exits with actionable errors instead of waiting indefinitely.

---

### 89) pods interactive `shell` command lacked spawn startup error handling

**Finding:** `pi shell` launched SSH with an exit-only listener. SSH spawn startup failures were not surfaced through explicit error handling, risking unhandled child-process failures.

**Action:** Updated:

- `packages/pods/src/cli.ts`
- `packages/pods/test/cli-shell.test.ts`
- `packages/pods/CHANGELOG.md`

to handle SSH process `error` events explicitly in interactive shell mode and added regression coverage validating clean error messaging on missing SSH binaries.

**Result:** `pi shell` now reports SSH startup failures deterministically with user-facing diagnostics and exits cleanly.

---

### 90) coding-agent bash executor did unnecessary work for pre-aborted signals

**Finding:** `executeBash()` and `executeBashWithOperations()` still initialized subprocess/operation execution paths even when provided `AbortSignal` was already aborted.

**Action:** Updated:

- `packages/coding-agent/src/core/bash-executor.ts`
- `packages/coding-agent/test/bash-executor.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to short-circuit pre-aborted signals before spawning subprocesses or invoking delegated operations, and added regression tests for both local and delegated execution paths.

**Result:** Bash execution helpers now honor cancellation preconditions immediately, avoiding unnecessary process startup and remote operation calls.

---

### 91) mom sandbox executors still spawned commands for pre-aborted signals

**Finding:** Mom sandbox executor path accepted pre-aborted signals but still proceeded into subprocess spawn setup before eventually surfacing abort handling.

**Action:** Updated:

- `packages/mom/src/sandbox.ts`
- `packages/mom/test/sandbox.test.ts`
- `packages/mom/CHANGELOG.md`

to short-circuit pre-aborted execution signals before subprocess spawn and added regression coverage ensuring no command side effects occur when cancellation is already requested.

**Result:** Mom sandbox command execution now respects cancellation preconditions immediately and avoids unnecessary subprocess startup.

---

### 92) coding-agent bash tool spawned shells for pre-aborted requests

**Finding:** Built-in bash tool default execution path only handled aborted signals after shell spawn setup, allowing cancelled calls to still start subprocesses.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/bash.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to short-circuit pre-aborted signals before shell spawn and added regression coverage proving aborted calls do not execute side-effect commands.

**Result:** Built-in bash tool now honors cancellation preconditions before command startup, reducing unnecessary subprocess execution under cancelled runs.

---

### 93) pods shell/log flows bypassed centralized SSH-binary validation

**Finding:** `pi shell` and model log streaming paths (`start` startup tail + `logs`) manually tokenized SSH commands and did not reuse the SSH-binary validation gate used in SSH helpers.

**Action:** Updated:

- `packages/pods/src/ssh.ts`
- `packages/pods/src/cli.ts`
- `packages/pods/src/commands/models.ts`
- `packages/pods/test/ssh-parse.test.ts`
- `packages/pods/test/cli-shell.test.ts`
- `packages/pods/CHANGELOG.md`

to export/reuse validated SSH command parsing (`parseSshCommand`) across interactive shell and model-log command paths, with regression tests covering validation behavior.

**Result:** Pods shell and model log execution now consistently enforce SSH-binary validation before process launch, aligning command safety behavior across all SSH entry points.

---

### 94) pods SSH wrappers treated signal-terminated sessions as success

**Finding:** SSH helper/CLI shell wrappers collapsed `code === null` to `0`, causing signal-terminated SSH subprocesses to be reported as successful exits.

**Action:** Updated:

- `packages/pods/src/ssh.ts`
- `packages/pods/src/cli.ts`
- `packages/pods/test/ssh-parse.test.ts`
- `packages/pods/test/cli-shell.test.ts`
- `packages/pods/CHANGELOG.md`

to treat signal-terminated SSH child processes as non-zero exits and added regression coverage for both helper and CLI-shell behavior.

**Result:** Interrupted/terminated SSH subprocesses now propagate failure semantics correctly instead of being misreported as success.

---

### 95) coding-agent grep tool could miss aborts during async startup

**Finding:** Grep tool abort listener was attached only after async startup work (`ensureTool`/path checks). Abort requests arriving during that window could be missed and still progress toward ripgrep spawn.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/grep.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to register abort handling before async startup, short-circuit pre-spawn when cancellation already occurred, and add regression coverage for cancellation during delayed startup.

**Result:** Grep tool now honors cancellation requests reliably across startup and execution phases, preventing startup-time abort races.

---

### 96) mom sandbox executor treated signal-terminated commands as success

**Finding:** Sandbox command execution path resolved `code ?? 0`, causing signal-terminated child processes (`code === null`) to be reported as success.

**Action:** Updated:

- `packages/mom/src/sandbox.ts`
- `packages/mom/test/sandbox.test.ts`
- `packages/mom/CHANGELOG.md`

to map signal-terminated child exits to non-zero command results and added regression coverage for host executor signal-exit behavior.

**Result:** Signal-terminated sandbox commands now propagate failure semantics correctly instead of false success.

---

### 97) coding-agent find/ls tools had inconsistent abort-listener cleanup

**Finding:** Find/ls tools registered abort listeners but resolved/rejected from multiple early-return branches without centralized settlement/cleanup, risking inconsistent abort listener lifecycle and startup cancellation races.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/find.ts`
- `packages/coding-agent/src/core/tools/ls.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to use single-settlement abort cleanup paths, add early cancellation checks during async startup/listing phases, and extend tool regression coverage for pre-aborted find/ls executions.

**Result:** Find/ls tool execution now handles abort lifecycle deterministically with consistent listener cleanup and cancellation behavior.

---

### 98) coding-agent RPC stop left pending requests unresolved until timeout

**Finding:** `RpcClient.stop()` cleared pending request tracking without actively rejecting waiting callers, leaving request promises dependent on timeout rather than immediate shutdown feedback.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `packages/coding-agent/test/rpc-client.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to reject pending in-flight RPC requests during client shutdown and added regression coverage for stop-time pending-request rejection behavior.

**Result:** RPC clients now fail pending requests immediately on stop, avoiding shutdown-time request hangs.

---

### 99) coding-agent sleep helper leaked abort listeners after resolve

**Finding:** `sleep(ms, signal)` attached abort listeners without cleanup on resolve/reject, allowing listener accumulation and redundant reject attempts when shared signals were reused.

**Action:** Updated:

- `packages/coding-agent/src/utils/sleep.ts`
- `packages/coding-agent/test/sleep.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to use single-settlement resolve/reject paths with listener cleanup and added regression coverage for listener cleanup on both resolve and abort paths.

**Result:** Sleep helper now cleans abort listeners deterministically and avoids double-settlement behavior under abort timing races.

---

### 100) ai provider retry backoff sleep duplicated abort-listener leak pattern

**Finding:** OpenAI Codex and Google Gemini CLI providers each had local retry `sleep()` helpers that attached abort listeners without cleanup, allowing listener accumulation across retry loops.

**Action:** Updated:

- `packages/ai/src/utils/abortable-sleep.ts` (new shared helper)
- `packages/ai/src/providers/openai-codex-responses.ts`
- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/abortable-sleep.test.ts`
- `packages/ai/CHANGELOG.md`

to centralize abort-aware sleep behavior with deterministic listener cleanup and added dedicated helper regression tests.

**Result:** AI provider retry backoff now uses a shared abort-safe sleep implementation that avoids abort-listener leaks across retries.

---

### 101) ai GitHub Copilot OAuth polling duplicated leaky abort-sleep logic

**Finding:** GitHub Copilot device-flow polling used a separate local abortable sleep implementation with the same no-cleanup listener pattern, which could accumulate listeners during long polling loops.

**Action:** Updated:

- `packages/ai/src/utils/oauth/github-copilot.ts`
- `packages/ai/CHANGELOG.md`

to reuse shared `abortableSleep(...)` with explicit `"Login cancelled"` abort messaging.

**Result:** Copilot OAuth polling now shares deterministic abort-listener cleanup semantics with other AI retry/backoff paths.

---

### 102) coding-agent write tool had multi-branch abort settlement paths

**Finding:** Write tool cancellation and completion paths each handled listener cleanup/rejection independently, increasing race risk around duplicate settle attempts during async filesystem operations.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/write.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to use single-settlement abort cleanup and added pre-aborted write regression coverage.

**Result:** Write tool now settles deterministically under abort timing races and preserves consistent cancellation semantics.

---

### 103) coding-agent read tool used split abort cleanup/reject branches

**Finding:** Read tool managed abort listener cleanup in separate success/error branches, which made cancellation/exception settlement behavior less deterministic during async read flows.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/read.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to use single-settlement abort cleanup and added pre-aborted read regression coverage.

**Result:** Read tool now has deterministic cancellation/error settlement semantics with centralized abort-listener cleanup.

---

### 104) coding-agent edit tool had branch-local abort settlement handling

**Finding:** Edit tool performed listener cleanup/reject logic independently across validation branches (`file not found`, match uniqueness checks, unchanged replacement), increasing complexity and race risk under cancellation timing.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/edit.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to use a shared single-settlement abort cleanup path and added pre-aborted edit regression coverage.

**Result:** Edit tool now handles cancellation/error settlement deterministically across all validation/read/write branches.

---

### 105) coding-agent bash execution path had split settlement + signal-null success

**Finding:** Default bash execution path handled error/close settlement in separate branches without a single-settlement guard and returned `exitCode: null` on signal termination, which could surface as false success at higher layers.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/bash.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to use single-settlement cleanup for abort/error/close paths and map signal-terminated child closes to non-zero exits.

**Result:** Bash tool execution now has deterministic settlement semantics and reports signal-terminated commands as failures instead of false success.

---

### 106) pods shared process-exit helper mapped signal exits to success

**Finding:** `waitForProcessExit()` resolved `code ?? 0` on child `exit`, causing signal-terminated processes (`code === null`) to appear as successful exits.

**Action:** Updated:

- `packages/pods/src/process-exit.ts`
- `packages/pods/test/process-exit.test.ts`
- `packages/pods/CHANGELOG.md`

to map signal-terminated exits to non-zero codes and added regression assertion coverage for signal path code semantics.

**Result:** Shared process-exit helper now reports signal-terminated subprocesses as failures instead of false success.

---

### 107) coding-agent bash executor marked signal exits as cancellations

**Finding:** `executeBash()` treated `close` events with `code === null` as cancelled regardless of caller abort state, and `executeBashWithOperations()` surfaced null exits as undefined/success-like results when not aborted.

**Action:** Updated:

- `packages/coding-agent/src/core/bash-executor.ts`
- `packages/coding-agent/test/bash-executor.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to base cancellation on caller abort signal state, map signal/null exits to non-zero failure semantics when not cancelled, and add regression coverage for local signal termination plus null exit codes from delegated operations.

**Result:** Bash executor now preserves failure semantics for signal/null exits while keeping true caller-driven cancellation behavior.

---

### 108) agent proxy stream dropped terminal SSE lines without trailing newline

**Finding:** Proxy stream parsing buffered partial lines and only processed newline-delimited chunks, so a final `data:` event without trailing newline could be dropped, leaving stream completion events unprocessed.

**Action:** Updated:

- `packages/agent/src/proxy.ts`
- `packages/agent/test/proxy.test.ts`
- `packages/agent/CHANGELOG.md`

to flush/process the final buffered SSE line after stream completion and added regression coverage for newline-less terminal `data:` events.

**Result:** Proxy streams now correctly process final SSE events even when responses end without trailing newline delimiters.

---

### 109) ai Gemini CLI stream could drop terminal SSE data line

**Finding:** Gemini CLI SSE parser processed only newline-delimited lines and did not flush the terminal buffered line on stream completion, so responses without trailing newline could lose the final event chunk.

**Action:** Updated:

- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/google-gemini-cli-empty-stream.test.ts`
- `packages/ai/CHANGELOG.md`

to route SSE line handling through a reusable line processor and flush the remaining buffer after read-loop completion, with regression coverage for newline-less terminal `data:` events.

**Result:** Gemini CLI streaming now handles terminal SSE events reliably even when providers omit trailing newline delimiters.

---

### 110) ai OpenAI Codex SSE parser could drop terminal buffered chunk

**Finding:** OpenAI Codex SSE parser only emitted chunks delimited by `\n\n`; a terminal buffered chunk without trailing separator could be dropped at stream end.

**Action:** Updated:

- `packages/ai/src/providers/openai-codex-responses.ts`
- `packages/ai/test/openai-codex-stream.test.ts`
- `packages/ai/CHANGELOG.md`

to centralize SSE chunk parsing and flush trailing buffered chunk after stream completion, with regression coverage for terminal chunks lacking trailing separators.

**Result:** OpenAI Codex streaming now preserves final SSE events even when providers omit trailing chunk delimiters.

---

### 111) coding-agent execCommand could misreport signal exits as success

**Finding:** `execCommand()` mapped `close` events with `code === null` to `0` unless the process was marked as caller-killed, causing externally signal-terminated subprocesses to appear successful.

**Action:** Updated:

- `packages/coding-agent/src/core/exec.ts`
- `packages/coding-agent/test/exec.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to map signal-terminated closes to non-zero failures when not caller-cancelled, with regression coverage for self-signaled subprocess termination.

**Result:** Shared command execution now preserves failure semantics for signal-terminated subprocesses instead of false success reporting.

---

### 112) web-ui sandbox validation failure left stale registered runtime state

**Finding:** `SandboxedIframe.execute()` rejected on HTML validation failure without running shared cleanup, and `loadContent()` validation failures did not unregister the sandbox router entry, leaving stale sandbox state.

**Action:** Updated:

- `packages/web-ui/src/components/SandboxedIframe.ts`
- `packages/web-ui/CHANGELOG.md`

to run full cleanup on execute-time validation failure and unregister failed `loadContent()` sandboxes before rendering validation-error output.

**Result:** HTML validation failures now cleanly release sandbox router/listener state instead of leaking stale runtime registrations.

---

### 113) web-ui sandbox bootstrap listeners could leak on early termination

**Finding:** In extension sandbox mode, `SandboxedIframe.execute()` registered `sandbox-ready`/`sandbox-error` window listeners that were removed only when one of those events fired; abort/timeout/validation-failure cleanup could leave pending listeners.

**Action:** Updated:

- `packages/web-ui/src/components/SandboxedIframe.ts`
- `packages/web-ui/CHANGELOG.md`

to track bootstrap listener references and remove them from shared cleanup paths.

**Result:** Sandbox execution cleanup now removes pending bootstrap listeners deterministically, avoiding cross-run listener accumulation when setup does not complete.

---

### 114) web-ui load-content path leaked window message handlers across reloads

**Finding:** `SandboxedIframe.loadViaSandboxUrl()` / `loadViaSrcdoc()` registered window-level handlers (external URL + bootstrap) without shared teardown on subsequent loads/disconnect, allowing handler accumulation across repeated loads.

**Action:** Updated:

- `packages/web-ui/src/components/SandboxedIframe.ts`
- `packages/web-ui/CHANGELOG.md`

to centralize window-handler references and clear them on reload/disconnect before attaching new handlers.

**Result:** Sandboxed iframe load lifecycle now keeps window message handlers bounded, preventing cross-load listener leaks.

## Validation Evidence

- Root quality gate passes:
  - `npm run check`
- AI package tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test`
- agent spawnScript regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/sub-agent.test.ts`
- coding-agent RPC startup/shutdown regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/rpc-client.test.ts` (includes startup failures + pending-request rejection on stop)
- coding-agent sleep helper regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/sleep.test.ts` (includes listener cleanup on resolve + abort paths)
- ai abortable sleep + retry stream regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/abortable-sleep.test.ts test/google-gemini-cli-retry-delay.test.ts test/openai-codex-stream.test.ts`
- ai copilot/oauth-related regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/abortable-sleep.test.ts test/github-copilot-anthropic.test.ts`
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes pre-aborted write coverage)
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes pre-aborted read + write coverage)
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes pre-aborted read + write + edit coverage)
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes signal-terminated bash command coverage)
- pods process-exit regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/process-exit.test.ts` (includes signal-exit non-zero assertion)
- coding-agent bash executor regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/bash-executor.test.ts` (includes signal/null exit non-zero semantics)
- agent proxy stream regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/proxy.test.ts` (includes trailing SSE line without newline)
- ai Gemini CLI SSE regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-gemini-cli-empty-stream.test.ts` (includes terminal `data:` line without trailing newline)
- ai Codex/Gemini SSE regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-codex-stream.test.ts test/google-gemini-cli-empty-stream.test.ts`
- coding-agent exec regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/exec.test.ts` (includes signal-terminated subprocess failure semantics)
- coding-agent execCommand regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/exec.test.ts`
- web-ui package checks pass:
  - `cd packages/web-ui && npm run check`
- coding-agent interactive status tests pass after share flow command-exec refactor:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/exec.test.ts test/interactive-mode-status.test.ts`
- pods process-exit helper regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/process-exit.test.ts`
- pods interactive shell spawn-error regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/process-exit.test.ts test/cli-shell.test.ts`
- coding-agent bash executor pre-abort regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/bash-executor.test.ts`
- mom sandbox pre-abort executor regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/sandbox.test.ts` (includes pre-aborted host executor case)
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes pre-aborted bash tool signal case)
- pods SSH validation + spawn handling regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/ssh-parse.test.ts test/process-exit.test.ts test/cli-shell.test.ts`
- pods SSH signal-exit semantics regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/ssh-parse.test.ts test/cli-shell.test.ts test/process-exit.test.ts`
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes pre-aborted bash + grep startup-abort race coverage)
- mom sandbox signal-exit regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/sandbox.test.ts` (includes signal-terminated host command case)
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes bash/grep/find/ls cancellation coverage)
- mom sandbox regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/sandbox.test.ts` (includes docker-missing spawn-error handling case)
- Agent package tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test`
- Targeted ExecutionEngine review tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/execution-engine.test.ts`
- Targeted AI stream mistral block run (all skipped as expected without creds):
  - `npm --workspace "@mariozechner/pi-ai" test -- test/stream.test.ts -t "Mistral Provider (devstral-medium-latest via OpenAI Completions)"`
- coding-agent package tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test`
- TUI package tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test`
- Targeted reviewer parser tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- reviewer.test.ts`
- web-ui package + example checks pass:
  - `cd packages/web-ui && npm run check`
- pods dynamic provider registration smoke test succeeds with temporary config:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model --list-models pods-vllm`
- pods missing override validation smoke test:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model --pod missing-pod`
- pods no-active-pod validation smoke test:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model`
- pods missing-model validation smoke test:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent missing-model --json`
- pods missing `--pod` value validation smoke test:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model --pod`
- pods `--pod=<name>` parsing validation smoke test:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model --pod=missing-pod`
- pods duplicate `--pod` validation smoke test:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model --pod demo --pod other`
- pods `--` option terminator passthrough validation:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model -- --pod`
- pods non-model `--pod` rejection validation:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts shell --pod demo`
- pods dynamic provider registration + key handling smoke test:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model --list-models pods-vllm`
- pods reserved flag validation smoke test:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model --provider openai`
- pods reserved flag terminator passthrough validation:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model -- --provider`
- pods missing API key validation smoke test:
  - `PI_CONFIG_DIR=<tmp> env -u PI_API_KEY npx tsx packages/pods/src/cli.ts agent known-model --list-models`
- pods delegated list-models success with explicit key:
  - `PI_CONFIG_DIR=<tmp> PI_API_KEY=test-key npx tsx packages/pods/src/cli.ts agent known-model --list-models`
- pods default source-entrypoint help rendering:
  - `npx tsx packages/pods/src/cli.ts --help` (renders `pi ...`)
- pods invoked-command help rendering:
  - `ln -s packages/pods/src/cli.ts /tmp/<name> && npx tsx /tmp/<name> --help` (renders `<name> ...`)
- pods unknown-command precedence validation:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts mystery --pod demo` (reports `Unknown command: mystery`)
- pods non-model `--pod` enforcement validation:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts shell --pod demo` (still rejects `--pod`)
- pods CLI parser regression tests:
  - `npx tsx --test packages/pods/test/cli-args.test.ts`
- pods CLI command-context regression tests:
  - `npx tsx --test packages/pods/test/cli-command.test.ts packages/pods/test/cli-args.test.ts packages/pods/test/prompt-args.test.ts`
- standalone coding-agent invocation validation:
  - `cd /tmp && npx --yes --package @mariozechner/pi-coding-agent pi --help`
- pods package test script validation:
  - `npm --workspace "@mariozechner/pi" test`
- model-name validation (start command):
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts start <model> --name "bad name"` (rejected with validation error)
- model-name validation (logs command):
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts logs "bad name"` (rejected with validation error)
- model-id validation (start command):
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts start "bad model" --name goodname` (rejected with validation error)
- memory option validation (start command):
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts start <model> --name qwen --memory abc` (rejected with validation error)
- context option validation (start command):
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts start <model> --name qwen --context none` (rejected with validation error)
- shell-quote helper regression tests:
  - `npm --workspace "@mariozechner/pi" test` (includes `test/shell-quote.test.ts`)
- pod setup command quoting regression tests:
  - `npm --workspace "@mariozechner/pi" test` (includes `test/pods-setup-command.test.ts`)
- shell export helper regression tests:
  - `npm --workspace "@mariozechner/pi" test` (includes `test/shell-quote.test.ts` `shellExport` cases)
- pod-name validation (pods active):
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts pods active "bad name"` (rejected with validation error)
- pod-name validation (`--pod` override):
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts list --pod "bad name"` (rejected with validation error)
- malformed persisted pid/port state handling:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts list` with tampered config (reports invalid pid/port, avoids shell interpolation)
- SSH command parsing regression coverage:
  - `npm --workspace "@mariozechner/pi" test` (includes `test/ssh-parse.test.ts` quote/escape/host extraction cases, including `-p2222`)
- `pi agent` with quoted SSH options:
  - `PI_CONFIG_DIR=<tmp> PI_API_KEY=test-key npx tsx packages/pods/src/cli.ts agent demo-model --list-models` with SSH config `ssh -i "~/.ssh/my key" -p2222 ubuntu@demo.host` (works; provider/model listed)
- `pi agent` invalid persisted port guard:
  - `PI_CONFIG_DIR=<tmp> PI_API_KEY=test-key npx tsx packages/pods/src/cli.ts agent demo-model --list-models` with tampered model port `bad-port` (rejected before delegation)
- mount command parsing helper behavior:
  - `npx tsx -e "<extractModelsPathFromMountCommand demo>"` returns `/mnt/model cache` for quoted target and `undefined` for malformed command
- non-ssh binary guard in SSH helpers:
  - `npm --workspace "@mariozechner/pi" test` (includes `test/ssh-parse.test.ts` cases for rejecting `sshExec("bash ...")` and accepting `/usr/bin/ssh ...` / `.../ssh.exe ...` host extraction)
- agent state-file git invocation regression:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/state-files.test.ts` (covers path-with-spaces commits and tracked deletion staging)
- full agent suite after git-invocation refactor:
  - `npm --workspace "@mariozechner/pi-agent-core" test`
- gate command parsing/runtime override coverage:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/gates.test.ts` (covers quoted parsing + call-time env command overrides)
- gate malformed-command behavior:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/gates.test.ts` (includes unmatched-quote command syntax failure case)
- red gate invocation-error behavior:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/gates.test.ts` (ensures malformed test command does not count as passing red gate)
- review-gate parser alignment behavior:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/gates.test.ts` (covers explicit verdict, clear reject, and unparseable-review failure)
- blank gate env override behavior:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/gates.test.ts` (covers whitespace `PI_TEST_COMMAND` / `PI_VALIDATE_COMMAND` fallback to defaults)
- GPU type extraction helper coverage:
  - `npm --workspace "@mariozechner/pi" test -- test/gpu-name.test.ts`
- coding-agent blank shell-config command coverage:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/resolve-config-value.test.ts` (covers blank-command short-circuit, cache-key normalization, and empty env-var handling)
- coding-agent prompt-template argument parsing coverage:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/prompt-templates.test.ts` (covers escaped quotes/spaces/backslashes and quoted-empty-arg behavior)
- coding-agent external-editor parser integration coverage:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/prompt-templates.test.ts test/interactive-mode-status.test.ts`
- coding-agent shared parser unit coverage:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/parse-command-args.test.ts test/prompt-templates.test.ts`
- coding-agent strict parser behavior coverage:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/parse-command-args.test.ts test/interactive-mode-status.test.ts`
- coding-agent interactive editor parser integration:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/parse-command-args.test.ts test/interactive-mode-status.test.ts` (with strict parser mode used by interactive + extension editor launch paths)
- coding-agent safe invocation parser coverage:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/parse-command-args.test.ts test/interactive-mode-status.test.ts` (includes `parseCommandInvocation` malformed-input guard behavior)
- coding-agent quoted export-path parser coverage:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/parse-command-args.test.ts test/interactive-mode-status.test.ts` (includes `/export "path with spaces"` argument parsing case)
- coding-agent interactive share-flow regression check:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/interactive-mode-status.test.ts test/parse-command-args.test.ts`
- coding-agent Windows-path parser coverage:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/parse-command-args.test.ts test/prompt-templates.test.ts` (includes `C:\Users\...` argument preservation cases)
- pods SSH Windows-backslash parser coverage:
  - `npm --workspace "@mariozechner/pi" test -- test/ssh-parse.test.ts` (includes `C:\Windows\...\ssh.exe` parse and host extraction cases)
- agent gate Windows-backslash parser coverage:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/gates.test.ts` (includes `C:\Tools\node.exe ...` command parse case)
- coding-agent strict prompt-template argument validation coverage:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/prompt-templates.test.ts test/parse-command-args.test.ts` (includes unmatched-quote template invocation rejection)
- coding-agent tab-separated command parsing coverage:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/prompt-templates.test.ts` (includes `/tmpl\t...` invocation case)
- coding-agent tab-separated extension-command detection coverage:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/interactive-mode-status.test.ts` (includes `/demo\targ` extension-command detection case)
- mom sandbox container-name validation coverage:
  - `cd packages/mom && npx tsx --test test/sandbox.test.ts`
- mom docker argv execution coverage:
  - `cd packages/mom && npx tsx --test test/sandbox.test.ts` (includes `buildDockerExecArgs` assertion for shell-free argv construction)
- mom workspace test-script behavior:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/sandbox.test.ts`
- nested state-file write coverage:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/state-files.test.ts` (includes nested parent-dir creation case)
- `pi agent` malformed SSH host guard:
  - `PI_CONFIG_DIR=<tmp> PI_API_KEY=test-key npx tsx packages/pods/src/cli.ts agent demo-model --list-models` with SSH `ssh -o StrictHostKeyChecking=no` (rejected with invalid SSH command error)
- prompt validation unit coverage:
  - `npm --workspace "@mariozechner/pi" test -- test/prompt-model-validation.test.ts`
- pods targeted test filtering behavior:
  - `npm --workspace "@mariozechner/pi" test -- test/ssh-parse.test.ts` (runs only SSH parser tests)
- pods invoked-command guidance in pod listing:
  - `PI_CONFIG_DIR=<tmp> npx tsx /tmp/<symlink-to-cli.ts> pods` (message includes `<symlink> pods setup`)
- pods invoked-command guidance in model/list flow:
  - `PI_CONFIG_DIR=<tmp> npx tsx /tmp/<symlink-to-cli.ts> list` (message includes `<symlink> pods active`)
- pods invoked-command guidance in agent/no-pod flow:
  - `PI_CONFIG_DIR=<tmp> npx tsx /tmp/<symlink-to-cli.ts> agent demo-model` (message includes `<symlink> pods active`)
- pods unique provider generation smoke test:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model --list-models` (shows `pods-vllm-<random>` entry)

## Methodology Fit

Changes were constrained to correctness, safety, and maintainability, with no architecture boundary violations introduced and no expansion beyond existing package intent.
