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

---

### 115) ai OAuth providers had inconsistent `AbortSignal` cancellation behavior

**Finding:** OAuth login flows in `@mariozechner/pi-ai` were inconsistent about honoring caller cancellation:

- Gemini CLI login did not thread `AbortSignal` through callback wait, project discovery polling, and token/user fetch requests.
- Antigravity login similarly ignored signal-driven cancellation in callback wait and downstream fetch paths.
- OpenAI Codex login accepted callback-server/manual fallback flows but did not honor cancellation during callback wait, prompt fallback, or token exchange.
- Anthropic login ignored cancellation before prompt and during token exchange.

This could leave login flows waiting on callback polling/prompts/fetches after user cancellation.

**Action:** Updated:

- `packages/ai/src/utils/oauth/google-gemini-cli.ts`
- `packages/ai/src/utils/oauth/google-antigravity.ts`
- `packages/ai/src/utils/oauth/openai-codex.ts`
- `packages/ai/src/utils/oauth/anthropic.ts`
- `packages/ai/test/google-gemini-cli-oauth-abort.test.ts`
- `packages/ai/test/google-antigravity-oauth-abort.test.ts`
- `packages/ai/test/openai-codex-oauth-abort.test.ts`
- `packages/ai/test/anthropic-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- thread `callbacks.signal` through provider `login(...)` entrypoints,
- reject early for pre-aborted signals,
- cancel callback polling waits on abort and clean up abort listeners deterministically,
- pass signals into token exchange/user info/project discovery fetches where supported.

**Result:** OAuth login cancellation semantics are now consistent across providers and fail fast on user-cancelled flows, with targeted regression coverage for pre-aborted signal handling.

---

### 116) anthropic OAuth login trusted unvalidated pasted state/code input

**Finding:** `loginAnthropic(...)` accepted raw pasted input with simple `code#state` splitting and no local state verification against the generated verifier. It also did not parse full redirect URLs or query-string formatted manual input, making headless login input more error-prone.

**Action:** Updated:

- `packages/ai/src/utils/oauth/anthropic.ts`
- `packages/ai/test/anthropic-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- parse manual input as either full redirect URL (`?code=...&state=...`), query-string format (`code=...&state=...`), legacy `code#state`, or bare code,
- reject state mismatches before token exchange (`OAuth state mismatch - possible CSRF attack`),
- keep token exchange state tied to the generated verifier,
- add regression tests for state-mismatch rejection and full redirect URL parsing.

**Result:** Anthropic manual OAuth input handling is now safer and more robust for headless/manual flows, with explicit CSRF-state validation and URL parsing support.

---

### 117) openai-codex OAuth startup depended on lazy import timing

**Finding:** `loginOpenAICodex(...)` relied on top-level lazy imports (`node:crypto`, `node:http`) that populated module-level variables asynchronously. Immediate login invocation could race before those variables were initialized, causing false "only available in Node.js" errors despite running in Node.

**Action:** Updated:

- `packages/ai/src/utils/oauth/openai-codex.ts`
- `packages/ai/test/openai-codex-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- explicitly await lazy import promises before using crypto/http helpers (`getNodeRandomBytes`, `getNodeHttp`),
- make OAuth state generation and callback-server startup use those awaited helpers,
- add cancellation checkpoints immediately after auth-flow initialization so post-start aborts fail before prompt fallback,
- add regression tests for manual login paths (state mismatch rejection + successful manual code exchange/account extraction).

**Result:** Codex OAuth startup is now deterministic regardless of lazy-import timing, and both manual-input parsing and post-start cancellation paths are covered by targeted tests.

---

### 118) OAuth manual redirect parsing missed hash-fragment callback formats

**Finding:** Manual OAuth parsing improvements covered query-string forms, but both Anthropic and OpenAI Codex flows could still miss full redirect URLs that carry `code`/`state` in URL hash fragments (e.g. `...#code=...&state=...`), which is a common copy/paste variant in some browser flows.

**Action:** Updated:

- `packages/ai/src/utils/oauth/anthropic.ts`
- `packages/ai/src/utils/oauth/openai-codex.ts`
- `packages/ai/test/anthropic-oauth-abort.test.ts`
- `packages/ai/test/openai-codex-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- parse hash-fragment `code`/`state` pairs from full redirect URLs,
- preserve existing support for query-string, `code#state`, and bare-code inputs,
- add regression tests for Anthropic and Codex hash-fragment manual-input handling.

**Result:** Manual OAuth input handling now accepts both query-string and hash-fragment redirect URL variants across Anthropic and Codex login flows.

---

### 119) google OAuth manual parsing still missed hash-fragment redirect URLs

**Finding:** After hardening Anthropic/Codex manual parsing, Google Gemini CLI and Antigravity OAuth flows still only reliably parsed query-string callbacks and could miss manual redirect input where `code`/`state` arrive in hash fragments.

**Action:** Updated:

- `packages/ai/src/utils/oauth/google-gemini-cli.ts`
- `packages/ai/src/utils/oauth/google-antigravity.ts`
- `packages/ai/test/google-gemini-cli-oauth-abort.test.ts`
- `packages/ai/test/google-antigravity-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- parse manual input from full redirect URLs with query-string or hash-fragment `code`/`state`,
- keep Google OAuth manual input contract URL-only (non-URL snippets like `code#state` are rejected),
- add regression tests proving:
  - mismatched hash-fragment state is rejected before network calls,
  - non-URL snippets are rejected with explicit redirect-URL guidance.

**Result:** Google OAuth manual-input parsing now supports hash-fragment callback variants while preserving the original redirect-URL-only manual input contract with clearer invalid-input diagnostics.

---

### 120) OAuth input parsing logic drifted across provider implementations

**Finding:** OAuth input parsing had diverged into multiple provider-local helpers (`anthropic`, `openai-codex`, `google-gemini-cli`, `google-antigravity`), increasing maintenance overhead and behavior-drift risk when adding new formats/fixes.

**Action:** Added:

- `packages/ai/src/utils/oauth/authorization-input.ts`
- `packages/ai/test/oauth-authorization-input.test.ts`

and updated provider OAuth modules to use shared parsing helpers.

Shared helper behavior now covers:

- redirect URL query parsing (`?code=...&state=...`),
- redirect URL hash-fragment parsing (`#code=...&state=...`),
- flexible fallback parsing for providers that allow non-URL manual input,
- strict manual redirect validation helper for URL-only providers.

**Result:** OAuth parsing behavior is now centralized and regression-tested at the utility level, reducing parser drift while preserving provider-specific contracts.

---

### 121) codex OAuth manual state errors used generic messaging

**Finding:** OpenAI Codex manual-input state mismatch paths still emitted generic `"State mismatch"` errors, while the other OAuth providers had explicit CSRF-oriented diagnostics.

**Action:** Updated:

- `packages/ai/src/utils/oauth/openai-codex.ts`
- `packages/ai/test/openai-codex-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to align mismatch errors with explicit wording:

- `OAuth state mismatch - possible CSRF attack`

across manual-input validation branches.

**Result:** OAuth state mismatch diagnostics are now consistent and explicit across providers, improving security-context clarity for manual login failures.

---

### 122) pods SSH wrappers could race-settle on spawn/close event overlap

**Finding:** `sshExec`, `sshExecStream`, and `scpFile` in `packages/pods/src/ssh.ts` resolved promises from both `error` and `close` paths without explicit single-settlement guards. Under spawn/exit edge cases this can create duplicate settle attempts and nondeterministic outcomes.

**Action:** Updated:

- `packages/pods/src/ssh.ts`
- `packages/pods/test/ssh-parse.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- add `resolveOnce(...)` single-settlement guards for SSH/SCP promise wrappers,
- keep existing exit-code semantics intact,
- add regression tests for missing-ssh-binary spawn-error paths in both `sshExec` and `sshExecStream`.

**Result:** Pods SSH execution wrappers now settle deterministically across spawn/close races and report missing-binary failures reliably.

---

### 123) coding-agent package-manager command runner could double-settle on process events

**Finding:** `DefaultPackageManager.runCommand(...)` resolved/rejected from separate spawn `error` and process-exit paths without an explicit single-settlement guard. This can create duplicate settle attempts on edge cases and less precise startup failure diagnostics.

**Action:** Updated:

- `packages/coding-agent/src/core/package-manager.ts`
- `packages/coding-agent/test/package-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add single-settlement (`resolveOnce`/`rejectOnce`) handling across `error` and `close` events,
- surface clearer startup failures (`Failed to start ...`) and signal-termination failures,
- add regression tests for zero-exit success, non-zero exits, and missing-binary spawn failures.

**Result:** Package-manager command execution now settles deterministically and reports command startup/exit failures with clearer context.

---

### 124) coding-agent rpc send path could race-settle timeout/write errors

**Finding:** `RpcClient.send(...)` maintained pending-request state with separate timeout/write-error branches but no explicit single-settlement guard, leaving room for duplicate reject attempts and stale pending map entries under edge-case timing.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `packages/coding-agent/test/rpc-client.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- use single-settlement resolve/reject helpers per request,
- clear pending-request entries deterministically on timeout and write errors,
- add regression tests for write-throw cleanup and timeout cleanup behavior.

**Result:** RPC request sending now handles timeout/write-failure races deterministically and cleans pending request state reliably.

---

### 125) rpc client send path could accept closed stdin and callback write errors

**Finding:** Even after single-settlement timeout/write-throw handling, `RpcClient.send(...)` could still attempt writes against closed stdin and lacked explicit handling for asynchronous write-callback errors, risking ambiguous failures and pending-request map drift.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `packages/coding-agent/test/rpc-client.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- reject immediately when stdin is already non-writable,
- reject and cleanup pending request entries when write callbacks report errors,
- add regression tests for closed-stdin and write-callback failure paths.

**Result:** RPC send now fails fast on closed pipes and cleans pending request state deterministically across both synchronous and callback-based write failure modes.

---

### 126) rpc client stop path could race-settle exit vs forced-kill timeout

**Finding:** `RpcClient.stop()` waited on both process `exit` and a forced-kill timeout without explicit single-settlement cleanup. In edge cases this can trigger duplicate resolve attempts and keep stale exit listeners attached after timeout resolution.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `packages/coding-agent/test/rpc-client.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add single-settlement stop handling (`resolveOnce`) with listener/timeouts cleanup,
- ensure timeout-forced `SIGKILL` and natural `exit` paths share deterministic cleanup behavior,
- add regression test proving forced-kill timeout path resolves cleanly and removes `exit` listeners.

**Result:** RPC client shutdown now handles timeout/exit races deterministically with proper listener/timer cleanup.

---

### 127) rpc client pending requests could linger after unexpected process exit

**Finding:** `RpcClient` rejected pending requests on explicit `stop()`, but unexpected child-process exits (crash/kill) could still leave in-flight requests waiting until per-request timeout.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `packages/coding-agent/test/rpc-client.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- attach an RPC process exit listener during startup,
- reject all pending requests immediately on unexpected child exit,
- close readline and clear process references on exit listener path,
- add regression coverage asserting pending requests are rejected/cleared on unexpected exit.

**Result:** RPC clients now fail fast when the child process exits unexpectedly, avoiding unnecessary timeout waits for in-flight requests.

---

### 128) package-manager sync command helper hid spawn startup failures

**Finding:** `DefaultPackageManager.runCommandSync(...)` handled non-zero statuses but did not explicitly branch on `spawnSync` startup errors (`result.error`) or signal-null status paths, making missing-binary failures less actionable.

**Action:** Updated:

- `packages/coding-agent/src/core/package-manager.ts`
- `packages/coding-agent/test/package-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- surface explicit startup errors (`Failed to start ...`) when sync spawn fails,
- guard null-status signal exits with clear signal diagnostics,
- add regression coverage for successful stdout path and missing-binary sync spawn failures.

**Result:** Package-manager sync command diagnostics now distinguish startup failures from command exit failures with clearer error context.

---

### 129) package-manager signal-exit diagnostics lacked direct regression coverage

**Finding:** After adding signal-aware async/sync command diagnostics in package-manager helpers, there was no direct regression test proving signal-terminated command paths continue reporting signal context.

**Action:** Updated:

- `packages/coding-agent/test/package-manager.test.ts`

to add targeted signal-exit coverage for both:

- async `runCommand(...)` signal rejection,
- sync `runCommandSync(...)` signal rejection,

with platform-safe skipping on Windows.

**Result:** Package-manager signal-exit diagnostics are now protected by explicit regression tests.

---

### 130) pods agent delegation spawn path could double-settle on `error`/`close` races

**Finding:** `promptModel(...)` delegated agent launch used a Promise that resolved/rejected directly from child `error` and `exit` handlers without a single-settlement guard, creating duplicate-settle race potential and less explicit startup diagnostics.

**Action:** Updated:

- `packages/pods/src/commands/prompt.ts`
- `packages/pods/test/prompt-model-validation.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- add single-settlement `resolveOnce` / `rejectOnce` handling for delegated process lifecycle,
- switch completion handling to `close` semantics with clear signal/exit reporting,
- emit explicit startup diagnostics when delegated CLI command fails to spawn,
- add regression test covering startup failure path (`PATH=""` / missing `npx`) with clear error output expectations.

**Result:** Pods agent delegation process handling now settles deterministically across spawn/close races and surfaces clearer startup failure diagnostics.

---

### 131) rpc start/exit listener lifecycle could retain stale handlers after failures

**Finding:** RPC process exit listeners were attached via `on("exit", ...)` and only detached in specific paths, so failed starts/exits could retain stale listener references longer than needed.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `packages/coding-agent/test/rpc-client.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- attach RPC process exit listener with `once("exit", ...)`,
- clear `processExitListener` state on exit callback,
- ensure failed start paths detach listener state reliably,
- add regression assertions that failed starts and unexpected exits leave no residual exit listeners.

**Result:** RPC exit-listener lifecycle is now deterministic across failed-start and unexpected-exit paths, reducing stale listener state risk between client restarts.

---

### 132) RPC extension TUI example did not handle spawn failures or signal-exit semantics

**Finding:** The RPC extension UI example did not register a child-process `error` handler and treated `code === null` exits as success (`0`), which can hide startup failures and signal-terminated exits during example usage.

**Action:** Updated:

- `packages/coding-agent/examples/rpc-extension-ui.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- handle agent spawn `error` events with explicit startup diagnostics and non-zero exit,
- map signal-terminated agent exits to non-zero process exit status,
- include explicit exit reason logging (`code` vs `signal`) for clearer troubleshooting in the example flow.

**Result:** The RPC extension example now reports startup/termination failures with accurate process semantics, aligning demo behavior with hardened runtime conventions used in production paths.

---

### 133) `spawnScript()` signal exits surfaced as ambiguous `null` status

**Finding:** `spawnScript()` in `packages/agent/src/sub-agent.ts` returned `exitCode: null` for signal-terminated children, leaving callers to infer failure semantics manually.

**Action:** Updated:

- `packages/agent/src/sub-agent.ts`
- `packages/agent/test/sub-agent.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- map `close(code=null, signal!=null)` to `exitCode: 1`,
- add a regression test covering child self-termination via `SIGTERM` (non-Windows),
- document the behavior in the agent changelog.

**Result:** `spawnScript()` now reports deterministic non-zero exit codes for signal terminations, aligning subprocess failure semantics with the rest of the monorepo hardening work.

---

### 134) subagent extension example had process-settlement and abort-listener race risks

**Finding:** The `examples/extensions/subagent` runner used raw `close`/`error` handlers without single-settlement guards, returned success for `code === null`, and left abort listeners/timeouts active after process completion.

**Action:** Updated:

- `packages/coding-agent/examples/extensions/subagent/index.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- introduce single-settlement `resolveOnce` handling for `close`/`error` races,
- map signal/null exits to non-zero exit codes,
- remove abort listeners and clear kill timers during cleanup,
- preserve startup diagnostics by appending explicit spawn-failure messages to stderr.

**Result:** Subagent example process lifecycle is now deterministic and cleanup-safe, matching the hardened cancellation/error semantics used elsewhere in the codebase.

---

### 135) grep tool could report success when cancellation arrived during post-process formatting

**Finding:** `grep` could receive cancellation after ripgrep exited but before async context-line formatting completed. Because the abort listener was removed at process-close time, late cancellation could be ignored and the tool could still resolve success.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/grep.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- keep abort listener active through the full async formatting phase,
- add explicit abort checks before/after each awaited formatting block,
- add a regression test that aborts during formatting and verifies deterministic rejection.

**Result:** `grep` now respects cancellation consistently even in late post-ripgrep formatting windows, avoiding stale successful results after abort.

---

### 136) bash tool accepted ambiguous null exit statuses from custom executors

**Finding:** `createBashTool()` treated `exitCode: null` from custom `operations.exec()` implementations as success, allowing ambiguous/unknown command terminations to pass as successful tool runs.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/bash.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize null/unknown exit statuses to non-zero (`1`) before success/failure evaluation,
- add regression coverage ensuring custom executors returning `null` are reported as failures.

**Result:** Bash tool now preserves deterministic failure semantics across both built-in and custom execution backends when command termination status is ambiguous.

---

### 137) `spawnScript()` could leave lingering children when `SIGTERM` was ignored

**Finding:** On abort/timeout, `spawnScript()` only sent `SIGTERM` and rejected. If child scripts ignored `SIGTERM`, they could continue running in the background after caller cancellation.

**Action:** Updated:

- `packages/agent/src/sub-agent.ts`
- `packages/agent/test/sub-agent.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- schedule a forced `SIGKILL` fallback after abort/timeout termination requests,
- clear forced-kill timers on normal close/error paths,
- add regression coverage with a child process that traps `SIGTERM` and verifies eventual termination.

**Result:** `spawnScript()` now avoids lingering abort-resistant child processes, improving cancellation hygiene and preventing orphaned subprocesses.

---

### 138) `execCommand()` force-kill fallback checked `proc.killed` instead of live process state

**Finding:** `execCommand()` used a `proc.killed` check before sending fallback `SIGKILL`. Because `proc.killed` flips to `true` as soon as `kill()` is invoked (not when the process actually exits), timeout/abort-resistant children could survive after ignored `SIGTERM`.

**Action:** Updated:

- `packages/coding-agent/src/core/exec.ts`
- `packages/coding-agent/test/exec.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- use live process-exit state (`exitCode`/`signalCode`) before escalating to `SIGKILL`,
- add optional `forceKillDelayMs` for deterministic testability while preserving default runtime behavior,
- add regression coverage with a SIGTERM-resistant process verifying forced termination.

**Result:** Shared command execution now reliably terminates timeout/abort-resistant subprocesses instead of leaving lingering children.

---

### 139) interactive extension dialogs could double-finalize under abort/UI race conditions

**Finding:** Extension selector/input dialog helpers resolved promises and performed hide/cleanup in multiple independent callbacks. Concurrent abort and UI completion paths could trigger duplicate finalization attempts.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add single-settlement guards for extension selector/input dialog completion,
- centralize resolve + cleanup through shared settle closures per dialog invocation,
- ensure abort listeners are removed exactly once on completion.

**Result:** Interactive extension dialogs now finalize deterministically across abort/complete races, reducing duplicate hide/render churn and listener cleanup ambiguity.

---

### 140) Linux clipboard fallback could surface uncaught child-process spawn errors

**Finding:** `copyToClipboard()` used spawned `wl-copy` with only stdin error handling. Unexpected spawn-time failures could emit unhandled child-process `error` events despite the clipboard path being best-effort.

**Action:** Updated:

- `packages/coding-agent/src/utils/clipboard.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- attach a no-op `error` listener to spawned `wl-copy` processes in the best-effort Linux fallback path.

**Result:** Clipboard copy fallback now suppresses uncaught spawn-error bubbling in degraded environments while preserving existing best-effort behavior.

---

### 141) sandbox extension example bash operations could race-settle on `error`/`close`

**Finding:** The sandbox extension example’s custom bash operations used separate `error`/`close` handlers without single-settlement guards, with cleanup spread across branches and raw `code` passthrough for signal exits.

**Action:** Updated:

- `packages/coding-agent/examples/extensions/sandbox/index.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add single-settlement resolve/reject helpers,
- centralize timeout/abort-listener cleanup,
- normalize signal/null close exits to non-zero semantics.

**Result:** Sandbox example command execution now settles deterministically across subprocess edge cases and aligns with hardened process-exit semantics used elsewhere in the codebase.

---

### 142) SSH extension example had racey subprocess settlement and null-exit passthrough

**Finding:** The SSH extension example used raw `error`/`close` promise settlement in both `sshExec()` and remote bash execution paths, with potential duplicate settlement attempts and direct passthrough of signal/null exits.

**Action:** Updated:

- `packages/coding-agent/examples/extensions/ssh.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add single-settlement helpers in SSH command and remote bash execution promises,
- normalize signal/null close exits to non-zero semantics,
- centralize timer/signal listener cleanup on all settle paths.

**Result:** SSH extension example subprocess handling is now deterministic and cleanup-safe, consistent with hardened process-lifecycle patterns applied across the codebase.

---

### 143) Antigravity image SSE parsing could drop terminal chunk without trailing newline

**Finding:** The Antigravity image-generation extension parsed only newline-terminated SSE lines, so a final `data:` chunk without trailing `\n` could be ignored, dropping final inline image payloads.

**Action:** Updated:

- `packages/coding-agent/examples/extensions/antigravity-image-gen.ts`
- `packages/coding-agent/test/antigravity-image-gen.test.ts` (new)
- `packages/coding-agent/CHANGELOG.md`

to:

- factor SSE line processing through a shared parser function,
- flush/process the remaining terminal buffer after stream completion,
- add regression tests for newline-less terminal image chunks and preceding text preservation.

**Result:** Antigravity image generation now reliably processes final SSE payload chunks even when streams end without newline terminators.

---

### 144) Windows process-tree cleanup paths could emit uncaught async `taskkill` spawn errors

**Finding:** Windows kill-tree helpers in coding-agent and mom launched `taskkill` as best-effort cleanup but did not attach child-process `error` listeners. Async spawn failures can bypass surrounding `try/catch` and surface as uncaught process errors.

**Action:** Updated:

- `packages/coding-agent/src/utils/shell.ts`
- `packages/mom/src/sandbox.ts`
- `packages/coding-agent/CHANGELOG.md`
- `packages/mom/CHANGELOG.md`

to:

- attach no-op async `error` listeners to spawned `taskkill` children,
- unref detached `taskkill` processes in these best-effort cleanup paths.

**Result:** Windows process-tree cleanup is now safer in degraded environments, avoiding uncaught async spawn-error bubbling during best-effort termination.

---

### 145) overlay QA extension lacked spawn-error handling for streaming process setup

**Finding:** The overlay QA extension’s streaming demo spawned a shell process without an `error` handler. Startup failures could surface as uncaught child-process errors instead of being reported in the overlay.

**Action:** Updated:

- `packages/coding-agent/examples/extensions/overlay-qa-tests.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add explicit stream-process spawn `error` handling,
- render startup error details inside the overlay and mark the stream as finished.

**Result:** Overlay QA streaming demo now degrades safely when process startup fails, with explicit in-overlay diagnostics instead of uncaught process errors.

---

### 146) pods model-log monitoring attached process-exit observation later than spawn

**Finding:** In pods model start/log streaming flows, SSH log-process output handlers were attached before `waitForProcessExit()` setup. Very-early spawn failures could race before the shared exit/error observer was attached.

**Action:** Updated:

- `packages/pods/src/commands/models.ts`
- `packages/pods/CHANGELOG.md`

to:

- start `waitForProcessExit(logProcess)` immediately after spawn in both model-start and log-view flows,
- await the pre-attached exit/error promise after stream wiring.

**Result:** Pods log monitoring now observes spawn/exit failures from the earliest point in process lifecycle, reducing startup race risk in SSH log streaming flows.

---

### 147) find tool could accept partial output from signal-terminated `fd` runs

**Finding:** `find` treated non-zero `fd` exits as ignorable when stdout contained partial output, so signal-terminated `fd` executions (`status === null`) could incorrectly resolve as success.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/find.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- treat signal/null `fd` exits as explicit errors,
- add injectable `spawnFd` operation hook for deterministic regression testing,
- add regression coverage asserting signal-terminated `fd` execution rejects even with partial stdout.

**Result:** Find tool now preserves deterministic failure semantics for interrupted `fd` executions and no longer reports stale partial results as successful output.

---

### 148) RPC mode could remain orphaned after stdin stream closure

**Finding:** RPC mode waited indefinitely even when stdin was closed, and pending extension UI dialog promises were not finalized during shutdown paths.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- finalize pending extension UI requests with shutdown errors before exit,
- trigger deterministic shutdown when stdin/readline closes,
- keep shutdown idempotent across command-driven and stream-close shutdown paths.

**Result:** RPC mode now terminates cleanly when input streams end, avoiding orphaned headless processes and pending request leaks.

---

### 149) RPC extension UI example had separate `error`/`exit` shutdown paths without settlement guard

**Finding:** The RPC extension TUI example handled child-process `error` and `exit` independently, which could trigger duplicated teardown/exit behavior if both events surfaced in edge startup/termination scenarios.

**Action:** Updated:

- `packages/coding-agent/examples/rpc-extension-ui.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add a single-settlement `settleAndExit()` helper,
- route both `error` and `exit` callbacks through the same guarded shutdown path.

**Result:** RPC extension example now performs deterministic one-time teardown and process exit across child-process event races.

---

### 150) interactive-shell extension surfaced ambiguous `null` exit output on spawn/signal failures

**Finding:** Interactive-shell extension reported `(interactive command exited with code null)` when shell startup failed or commands terminated by signal, obscuring the actual failure mode.

**Action:** Updated:

- `packages/coding-agent/examples/extensions/interactive-shell.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize spawn/signal outcomes to deterministic non-zero exit codes,
- emit explicit failure reason text for startup failures, signal terminations, and non-zero exits.

**Result:** Interactive-shell extension now reports clear, actionable failure diagnostics instead of ambiguous null-exit messaging.

---

### 151) pods `pi shell` child-process `error`/`exit` callbacks could race duplicate exit paths

**Finding:** `pi shell` handled SSH child-process `error` and `exit` independently with direct `process.exit` calls, allowing duplicate shutdown-path races in edge startup/termination timing.

**Action:** Updated:

- `packages/pods/src/cli.ts`
- `packages/pods/test/cli-shell.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- guard shell-child shutdown with single-settlement `exitOnce` handling,
- preserve existing startup-failure diagnostics and non-zero signal semantics,
- add regression coverage that validates non-zero SSH child exit codes are propagated verbatim.

**Result:** Pods shell command now exits deterministically once across child-process event races while preserving accurate SSH exit-code propagation.

---

### 152) RPC dialog/editor promises could race duplicate settlement under shutdown/timeout timing

**Finding:** RPC mode dialog and editor request promises relied on callback ordering without explicit single-settlement guards, so overlapping timeout/abort/shutdown response paths could attempt duplicate resolve/reject handling.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add single-settlement guards for dialog/editor RPC promise lifecycles,
- centralize cleanup (`pendingExtensionRequests`, timers, abort listeners) in guarded settle/reject paths.

**Result:** RPC extension UI request handling now settles exactly once across overlapping response/timeout/abort/shutdown paths, reducing promise race and cleanup ambiguity.

---

### 153) RPC shutdown path could hang if extension `session_shutdown` handlers threw

**Finding:** RPC mode shutdown awaited extension `session_shutdown` handlers without guarding handler failures, so thrown errors could prevent final readline close/process exit.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- catch and report `session_shutdown` handler failures via RPC error output,
- preserve deterministic readline close + process exit behavior even when shutdown handlers fail.

**Result:** RPC mode now exits reliably during shutdown even if extension cleanup handlers throw, avoiding stuck headless shutdowns.

---

### 154) bash executor local child-process lifecycle could race duplicate settle on spawn failure

**Finding:** `executeBash()` resolved/rejected directly from child `close` and `error` handlers without a shared single-settlement guard, allowing duplicate settle races in spawn-failure edge paths.

**Action:** Updated:

- `packages/coding-agent/src/core/bash-executor.ts`
- `packages/coding-agent/test/bash-executor.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add single-settlement resolve/reject helpers and centralized cleanup for local bash execution,
- add regression coverage for shell spawn startup failure handling.

**Result:** Local bash executor process handling now settles deterministically once across child lifecycle races, with preserved cancellation/output semantics.

---

### 155) RPC dialog response parsing could throw before promise settlement cleanup

**Finding:** RPC dialog response callbacks invoked parser logic inline without guarding parser exceptions. Unexpected payload shapes could throw before settle/reject cleanup, leaving pending dialog promises unresolved.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- guard dialog response parsing with try/catch,
- reject dialog promises deterministically on parser failures with full cleanup.

**Result:** RPC dialog request handling now remains settlement-safe even when response payload parsing fails unexpectedly.

---

### 156) RPC unknown-command responses dropped request correlation IDs

**Finding:** Unknown-command handling emitted error responses with `id: undefined`, even when clients supplied request IDs, making unsupported-command failures harder to correlate on the client side.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- propagate provided request IDs on unknown-command error responses.

**Result:** RPC clients now receive correlated unknown-command errors with original request IDs, improving protocol diagnostics and retry/error handling.

---

### 157) package-manager async command errors omitted full invocation context

**Finding:** `runCommand()` startup/signal/non-zero error messages in package manager only included the binary name in some paths, reducing diagnostic clarity for multi-arg command failures.

**Action:** Updated:

- `packages/coding-agent/src/core/package-manager.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- include full invoked command (`<binary> <args...>`) consistently across startup, signal, and non-zero failure diagnostics.

**Result:** Package-manager async command failures now provide richer invocation context, improving troubleshooting of install/update command failures.

---

### 158) interactive external-editor failures were silent

**Finding:** Interactive mode external-editor launch kept content unchanged on failure but did not surface startup/signal/non-zero editor exit diagnostics, leaving users without feedback when `$EDITOR` invocation failed.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- surface warning messages for external-editor startup failures, signal terminations, and non-zero exits,
- preserve current editor content on all failure paths.

**Result:** Interactive external-editor workflow now provides clear failure diagnostics without losing current editor state.

---

### 159) CLI session/config selector callbacks could race duplicate teardown paths

**Finding:** Session/config selector TUI entrypoints had separate select/cancel/exit callbacks performing independent stop/resolve/exit logic without shared settlement guards, allowing duplicate teardown attempts in callback race scenarios.

**Action:** Updated:

- `packages/coding-agent/src/cli/session-picker.ts`
- `packages/coding-agent/src/cli/config-selector.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- route all close/exit paths through single-settlement helpers,
- centralize one-time TUI/theme teardown and optional process exit behavior.

**Result:** CLI selector flows now perform deterministic one-time teardown across callback races, reducing duplicate UI shutdown/resolve/exit paths.

---

### 160) Qwen CLI provider example OAuth flow missed full abort propagation and sleep cleanup

**Finding:** The Qwen custom-provider OAuth example used a local sleep helper that did not remove abort listeners on success and did not consistently pass `AbortSignal` into device/token HTTP requests.

**Action:** Updated:

- `packages/coding-agent/examples/extensions/custom-provider-qwen-cli/index.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- harden local abortable sleep with deterministic listener cleanup,
- propagate abort signals to device-code and token polling requests,
- reject early for pre-aborted login signals.

**Result:** Qwen OAuth example now reacts to cancellation consistently across polling/network paths and avoids accumulating stale abort listeners.

---

### 161) package-manager diagnostic context fix needed explicit regression assertions

**Finding:** After improving package-manager async command diagnostics to include full invocation strings, existing tests only asserted generic failure substrings and did not lock in the richer command context.

**Action:** Updated:

- `packages/coding-agent/test/package-manager.test.ts`

to:

- assert full command-context diagnostics for non-zero exits and startup failures.

**Result:** Regression coverage now enforces full-invocation error context in package-manager async command failures.

---

### 162) login dialog browser launch used shell-composed command strings

**Finding:** Interactive OAuth login dialog launched browser URLs via `exec("${openCmd} \"${url}\"")`, which unnecessarily routed auth URLs through shell command parsing and increased command-injection risk for malformed URL payloads.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/components/login-dialog.ts`
- `packages/coding-agent/test/login-dialog-url-open.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- switch browser launch to argument-safe `spawn(command, args)` invocations,
- ignore launch errors safely while preserving manual URL fallback behavior,
- add regression tests for platform-specific open-command selection.

**Result:** OAuth login browser launch now avoids shell interpolation and remains cross-platform with deterministic invocation behavior.

---

### 163) login dialog cancellation/prompt replacement could leave duplicate completion or dangling input waits

**Finding:** Login dialog tracked prompt resolvers as single mutable handlers without rejecting superseded prompts; repeated cancel paths could also invoke completion callbacks multiple times.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/components/login-dialog.ts`
- `packages/coding-agent/test/login-dialog.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- centralize one-time completion signaling for cancel flows,
- reject prior pending prompt/input promises when a new manual prompt replaces them,
- add regression coverage for repeated cancellation and prompt replacement behavior.

**Result:** Login dialog now settles cancel completion exactly once and no longer leaves stale manual-input promises unresolved when prompt handlers are replaced.

---

### 164) piped-stdin reading in CLI main lacked stream-error handling and deterministic listener cleanup

**Finding:** CLI piped-stdin ingestion attached `data/end` listeners inline in `main.ts` without handling `error` events or centralizing listener cleanup, risking unresolved reads on stdin stream failures.

**Action:** Updated:

- `packages/coding-agent/src/cli/read-piped-stdin.ts` (new)
- `packages/coding-agent/src/main.ts`
- `packages/coding-agent/test/read-piped-stdin.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- extract piped-stdin reading into a dedicated helper,
- add single-settlement resolve/reject behavior with explicit `error` handling,
- ensure listeners are always removed once settled,
- add regression tests for TTY short-circuit, trimmed pipe reads, and error-path rejection.

**Result:** CLI stdin ingestion now settles deterministically across normal and error paths without dangling event listeners.

---

### 165) shared EventStream could leave `result()` pending forever on incomplete stream endings

**Finding:** `EventStream.end()` only resolved final results when an explicit result was provided; streams ending without a completion event/result left `result()` promises unresolved, causing silent hangs in incomplete stream lifecycles.

**Action:** Updated:

- `packages/ai/src/utils/event-stream.ts`
- `packages/ai/test/event-stream.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- add one-time final-result settlement guards,
- reject `result()` with explicit diagnostics when streams end without completion payloads,
- add regression tests for completion-event resolve, explicit end-result resolve, and incomplete-end rejection behavior.

**Result:** Shared event streams now fail fast on incomplete endings instead of hanging `result()` consumers indefinitely.

---

### 166) CLI fork-confirm prompt could hang when stdin closed before answer

**Finding:** Session fork confirmation prompt in CLI main used inline `readline.question(...)` without explicit close-path settlement handling, risking unresolved prompt promises when stdin closed unexpectedly.

**Action:** Updated:

- `packages/coding-agent/src/cli/prompt-confirm.ts` (new)
- `packages/coding-agent/src/main.ts`
- `packages/coding-agent/test/prompt-confirm.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- extract yes/no prompting into a dedicated helper,
- add single-settlement close handling that resolves `false` on early stdin close,
- add regression tests for yes/no responses and pre-answer input-close behavior.

**Result:** CLI session-fork confirmation now completes deterministically even when stdin closes before user input.

---

### 167) AI CLI interactive prompts could hang when readline closed before callback answer

**Finding:** AI CLI prompt helper relied on bare `rl.question(...)` promise resolution; if readline closed before an answer callback fired, interactive selection/login prompts could remain pending indefinitely.

**Action:** Updated:

- `packages/ai/src/utils/readline-prompt.ts` (new)
- `packages/ai/src/cli.ts`
- `packages/ai/test/readline-prompt.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- introduce a reusable prompt helper with close-fallback single-settlement behavior,
- route AI CLI prompt reads through the hardened helper,
- add regression tests for answer resolution, early-close fallback, and no-override-after-close behavior.

**Result:** AI CLI interactive prompting now settles deterministically even when readline closes before user input arrives.

---

### 168) web-ui permission dialogs could run duplicate resolve paths across success/deny/close transitions

**Finding:** `ApiKeyPromptDialog` and `PersistentStorageDialog` used separate success/deny/close resolution paths without centralized settlement guards, allowing duplicate completion attempts when dialogs closed after explicit outcome handling.

**Action:** Updated:

- `packages/web-ui/src/dialogs/ApiKeyPromptDialog.ts`
- `packages/web-ui/src/dialogs/PersistentStorageDialog.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- introduce one-time settlement helpers for dialog completion promises,
- clear pending resolver references on settlement,
- ensure close-path fallback resolution cannot override prior success/deny outcomes.

**Result:** web-ui permission dialogs now resolve promise outcomes deterministically once across success, deny, and close transitions.

---

### 169) CLI piped-stdin helper still depended on `end`/`error` only and could hang on close-only stream termination

**Finding:** After initial stdin helper extraction, settlement still relied on `end`/`error` events. Some stream shutdown paths can emit `close` without `end`, leaving the promise pending.

**Action:** Updated:

- `packages/coding-agent/src/cli/read-piped-stdin.ts`
- `packages/coding-agent/test/read-piped-stdin.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- settle on `close` events using buffered stdin content,
- add regression coverage for close-before-end behavior.

**Result:** Piped-stdin ingestion now settles deterministically across `end`, `error`, and `close` termination paths.

---

### 170) sandbox runtime message bridge left timeout timers alive after early responses

**Finding:** Sandboxed runtime request/response bridge resolved/rejected on message receipt but did not clear the 30s timeout timer, leaving unnecessary pending timers for each successful runtime message.

**Action:** Updated:

- `packages/web-ui/src/components/sandbox/RuntimeMessageBridge.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- guard runtime bridge promise settlement with a one-time settle helper,
- clear timeout handlers on both success and error response paths,
- ensure timeout/error/response handlers cannot double-settle.

**Result:** Runtime bridge messaging now cleans up timeout timers immediately on completion and avoids redundant late timeout callbacks.

---

### 171) sandbox runtime bridge assumed object-shaped postMessage payloads

**Finding:** Runtime bridge message handler accessed `e.data.type` directly; unrelated `postMessage` payloads like `null` or primitive values could throw and interrupt bridge response handling.

**Action:** Updated:

- `packages/web-ui/src/components/sandbox/RuntimeMessageBridge.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- ignore non-object message payloads before response-type checks.

**Result:** Runtime bridge handlers now safely ignore unrelated message payload shapes instead of throwing.

---

### 172) runtime message router assumed object payloads and could abort routing on handler exceptions

**Finding:** Global runtime router destructured `e.data`/`message` without payload-shape guards and awaited provider/consumer handlers without isolation, allowing malformed payloads or one handler exception to interrupt routing for all sandboxes.

**Action:** Updated:

- `packages/web-ui/src/components/sandbox/RuntimeMessageRouter.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- guard sandbox and user-script payloads for object shape before routing,
- isolate provider/consumer handler failures with local try/catch logging so routing continues.

**Result:** Runtime message routing is now resilient to malformed payloads and individual handler failures, preserving global router stability.

---

### 173) runtime message router could miss early responses when iframe reference was not yet attached

**Finding:** Router response delivery relied on `context.iframe?.contentWindow`; during early iframe lifecycle races, missing iframe references could drop runtime responses and force sandbox-side timeout failures.

**Action:** Updated:

- `packages/web-ui/src/components/sandbox/RuntimeMessageRouter.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- fall back to the incoming `MessageEvent.source` window when sandbox iframe references are not yet available.

**Result:** Runtime request/response flows now remain responsive during early iframe attachment races instead of timing out unnecessarily.

---

### 174) ProviderKeyInput failure-reset timers were not cleaned up across retries/disconnect

**Finding:** API key validation failures used raw `setTimeout` callbacks to clear error badges, but timers were not tracked/cleared on repeated failures or component unmount, allowing stale callbacks against detached state.

**Action:** Updated:

- `packages/web-ui/src/components/ProviderKeyInput.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- centralize failure-reset timer scheduling with replacement cleanup,
- clear pending timers in `disconnectedCallback()`.

**Result:** Provider key input failure-status reset is now lifecycle-safe and avoids stale timeout callbacks.

---

### 175) ConsoleBlock copy-feedback timer lacked lifecycle cleanup

**Finding:** Console copy feedback used a raw timeout to clear `copied` state without tracking/canceling prior timers, allowing stale callbacks after repeated copy actions or component unmount.

**Action:** Updated:

- `packages/web-ui/src/components/ConsoleBlock.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- track copy-feedback timeout handles,
- replace/clear timers on repeated copy actions,
- clear pending timers in `disconnectedCallback()`.

**Result:** Console copy-feedback state transitions are now timer-safe across repeated interactions and component teardown.

---

### 176) OAuth callback waiters for Gemini/Antigravity/Codex used polling loops instead of event-driven settlement

**Finding:** OAuth local callback server waiters in multiple providers polled shared state with short sleep loops, which added avoidable timer churn and delayed cancellation/close responsiveness.

**Action:** Updated:

- `packages/ai/src/utils/oauth/google-gemini-cli.ts`
- `packages/ai/src/utils/oauth/google-antigravity.ts`
- `packages/ai/src/utils/oauth/openai-codex.ts`
- `packages/ai/CHANGELOG.md`

to:

- replace polling-based callback waits with event-driven pending-promise settlement,
- settle waits immediately on callback receipt, cancellation, and server close,
- preserve Codex callback wait timeout behavior while removing sleep-loop polling.

**Result:** OAuth callback waiting now reacts immediately to completion/cancel/close events with lower timer overhead and deterministic settlement.

---

### 177) AttachmentOverlay cleanup depended on close-button path only

**Finding:** Attachment overlay removed global keydown listeners and preview-loading tasks in `close()`, but lacked `disconnectedCallback()` cleanup for external removal paths.

**Action:** Updated:

- `packages/web-ui/src/dialogs/AttachmentOverlay.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- run listener/task cleanup from `disconnectedCallback()`,
- ensure keydown handler references are cleared after explicit close.

**Result:** Attachment overlay now releases global listeners/loading resources even when removed outside the normal close-button flow.

---

### 178) ChatPanel deferred initial resize callback could outlive component mount

**Finding:** Chat panel scheduled a deferred initial width sync via `requestAnimationFrame` but did not cancel it on disconnect, allowing stale callbacks after rapid mount/unmount transitions.

**Action:** Updated:

- `packages/web-ui/src/ChatPanel.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- track the deferred resize frame ID,
- cancel pending frame callbacks during `disconnectedCallback()`.

**Result:** Chat panel now avoids stale deferred resize callbacks after unmount.

---

### 179) StreamingMessageContainer deferred batch updates were not canceled on disconnect/immediate clear

**Finding:** Streaming message batching scheduled animation-frame updates without tracking/canceling pending callbacks when immediate clear paths or component unmounts occurred.

**Action:** Updated:

- `packages/web-ui/src/components/StreamingMessageContainer.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- track pending animation-frame IDs,
- cancel pending frame callbacks on immediate clear and `disconnectedCallback()`.

**Result:** Streaming message batch updates now avoid stale deferred callbacks after clear/unmount transitions.

---

### 180) AgentInterface `setInput()` could spin deferred frame retries without disconnect cancellation

**Finding:** `setInput()` retried editor assignment via recursive `requestAnimationFrame` loops until the editor ref existed, but did not track/cancel pending frame retries on component teardown.

**Action:** Updated:

- `packages/web-ui/src/components/AgentInterface.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- coalesce pending set-input requests into tracked deferred frame callbacks,
- cancel pending callbacks and clear queued values in `disconnectedCallback()`.

**Result:** Agent interface input prefill now avoids runaway deferred frame retries and stale callbacks across disconnect cycles.

---

### 181) ConsoleRuntimeProvider accumulated global error listeners across repeated sandbox executions

**Finding:** Console runtime injection registered `window.error`/`window.unhandledrejection` listeners on every execution without removing prior handlers, causing listener accumulation across repeated HTML artifact runs in the same sandbox.

**Action:** Updated:

- `packages/web-ui/src/components/sandbox/ConsoleRuntimeProvider.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- remove prior runtime error listeners before adding new ones,
- clean up active runtime listeners after execution completion.

**Result:** Sandbox console runtime now avoids repeated global error-listener accumulation between executions.

---

### 182) ModelSelector custom-provider discovery could apply stale async results after dialog teardown

**Finding:** Model selector kicked off async custom-provider discovery without invalidating in-flight loads on disconnect, allowing stale load completions to mutate state after dialog close/remount races.

**Action:** Updated:

- `packages/web-ui/src/dialogs/ModelSelector.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- track discovery load sequence IDs,
- invalidate pending loads in `disconnectedCallback()`,
- apply discovery results only when the latest load is still active and component remains connected.

**Result:** Model selector custom-provider discovery now ignores stale async completions after teardown/reopen cycles.

---

### 183) ConsoleRuntimeProvider listener cleanup depended on successful runtime message delivery

**Finding:** Console runtime completion cleanup removed execution listeners after awaiting runtime message delivery; delivery failures could skip cleanup and leave listeners active until next execution.

**Action:** Updated:

- `packages/web-ui/src/components/sandbox/ConsoleRuntimeProvider.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- move runtime listener cleanup into a `finally` block in `complete()` so teardown always runs regardless of runtime message delivery outcome.

**Result:** Sandbox console runtime listener teardown now remains deterministic even when completion-message delivery fails.

---

### 184) runtime message router accepted iframe messages without source-window identity checks

**Finding:** Router sandbox message handling keyed only on `sandboxId`; when iframe references existed, cross-frame messages could be routed if they reused a known sandbox ID.

**Action:** Updated:

- `packages/web-ui/src/components/sandbox/RuntimeMessageRouter.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- require incoming iframe message `source` to match the registered sandbox iframe window before routing.

**Result:** Runtime routing now rejects spoofed cross-frame iframe messages that do not originate from the registered sandbox window.

---

### 185) runtime message router could leave bridge requests unresolved when providers omitted explicit responses

**Finding:** Sandbox/user-script runtime bridge calls always included `messageId` and awaited responses, but router paths depended on providers to call `respond(...)`; unhandled/fire-and-forget messages could otherwise time out unnecessarily.

**Action:** Updated:

- `packages/web-ui/src/components/sandbox/RuntimeMessageRouter.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- enforce one-time response semantics per message ID,
- emit default success acknowledgements when no provider response is produced.

**Result:** Runtime bridge request lifecycles now settle deterministically even when provider handlers do not explicitly respond.

---

### 186) user-script runtime bridge requests lacked message IDs and required explicit provider responses

**Finding:** User-script bridge calls did not include request IDs, making response correlation brittle and relying on provider-specific response behavior for `chrome.runtime.sendMessage` completion.

**Action:** Updated:

- `packages/web-ui/src/components/sandbox/RuntimeMessageBridge.ts`
- `packages/web-ui/src/components/sandbox/RuntimeMessageRouter.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- include generated `messageId` values for user-script runtime requests,
- enforce one-time default response settlement in user-script routing even when providers omit explicit replies.

**Result:** User-script runtime messaging now has explicit request correlation and deterministic `sendMessage` completion semantics.

---

### 187) TUI loader could start duplicate spinner intervals on repeated start calls

**Finding:** `Loader.start()` created a new interval each invocation without first clearing existing timers, allowing duplicate spinner loops when start was called reentrantly.

**Action:** Updated:

- `packages/tui/src/components/loader.ts`
- `packages/tui/CHANGELOG.md`

to:

- clear any existing interval before starting a new spinner timer.

**Result:** TUI loader now maintains a single spinner interval across repeated `start()` calls.

---

### 188) readline prompt helper did not short-circuit already-closed interfaces

**Finding:** Shared readline prompt helper handled close events during active questions but did not explicitly short-circuit already-closed interfaces, risking brittle behavior if callers prompt after prior closure.

**Action:** Updated:

- `packages/ai/src/utils/readline-prompt.ts`
- `packages/ai/test/readline-prompt.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- return fallback values immediately when the interface is already closed,
- guard `rl.question(...)` with fallback settlement on synchronous errors,
- add regression coverage for already-closed interface prompts.

**Result:** AI CLI prompt helper now settles predictably across both pre-closed and mid-close readline states.

---

### 189) AgentInterface async mount flow could attach listeners after disconnect

**Finding:** Agent interface awaited `updateComplete` inside `connectedCallback()` before attaching scroll/observer/session subscriptions, but lacked a post-await `isConnected` guard; rapid detach during await could lead to late listener attachment after teardown.

**Action:** Updated:

- `packages/web-ui/src/components/AgentInterface.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- short-circuit `connectedCallback()` post-render setup when the component is no longer connected.

**Result:** Agent interface no longer attaches post-render listeners/subscriptions after disconnect races.

---

### 190) ModelSelector post-render setup could run after disconnect

**Finding:** Model selector `firstUpdated()` awaited `updateComplete` before focusing search and wiring keyboard/mouse handlers without a post-await connectivity guard, allowing late setup when dialogs closed quickly.

**Action:** Updated:

- `packages/web-ui/src/dialogs/ModelSelector.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- short-circuit `firstUpdated()` setup when the component is no longer connected after `await updateComplete`.

**Result:** Model selector no longer performs delayed post-render setup after disconnect races.

---

### 191) runtime router default acknowledgements were not gated to request-shaped messages

**Finding:** After adding default runtime responses, iframe routing acknowledged all handled messages regardless of request identity, risking unsolicited responses for sandbox broadcasts lacking request IDs.

**Action:** Updated:

- `packages/web-ui/src/components/sandbox/RuntimeMessageRouter.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- restrict default acknowledgement behavior to messages carrying non-empty `messageId` request IDs.

**Result:** Runtime router now only emits fallback responses for request-shaped messages, preserving deterministic request settlement without acknowledging non-request broadcasts.

---

### 192) coding-agent fork confirmation prompts did not explicitly handle already-closed readline interfaces

**Finding:** Prompt-confirm helper handled close events during active prompts but did not short-circuit already-closed readline states or synchronous `question()` failures.

**Action:** Updated:

- `packages/coding-agent/src/cli/prompt-confirm.ts`
- `packages/coding-agent/test/prompt-confirm.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- short-circuit settled `false` when readline is already closed,
- guard `question()` calls with failure fallback settlement,
- add regression coverage for pre-closed input streams.

**Result:** Fork-confirm prompt handling now settles deterministically across active-close and already-closed readline edge cases.

---

### 193) piped-stdin helper did not short-circuit pre-closed streams

**Finding:** `readPipedStdin()` handled active `end`/`close` events but still attached listeners/resumed streams when stdin was already ended/destroyed before invocation.

**Action:** Updated:

- `packages/coding-agent/src/cli/read-piped-stdin.ts`
- `packages/coding-agent/test/read-piped-stdin.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- return early for already-ended/destroyed streams before listener registration,
- add regression coverage for pre-ended stream input.

**Result:** CLI piped-stdin handling now avoids unnecessary listener wiring and resolves immediately on pre-closed stream handles.

---

### 194) artifacts panel deferred animation-frame callbacks could run after detach

**Finding:** Artifacts panel used multiple `requestAnimationFrame` callbacks for DOM reattachment/show/scroll flows without tracking/canceling them on disconnect, allowing late callbacks to mutate detached trees.

**Action:** Updated:

- `packages/web-ui/src/tools/artifacts/artifacts.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- add centralized animation-frame scheduling with `isConnected` gating,
- track/cancel pending frame IDs in `disconnectedCallback()`,
- route panel reattach/show/scroll deferred work through the tracked scheduler.

**Result:** Artifact panel now avoids stale frame-driven DOM mutations after rapid unmount/remount sequences.

---

### 195) proxy settings tab could apply async load results after disconnect

**Finding:** Proxy settings tab loaded persisted values asynchronously in `connectedCallback()` without invalidating stale in-flight reads during unmount/remount races.

**Action:** Updated:

- `packages/web-ui/src/dialogs/SettingsDialog.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- sequence-tag proxy settings reads and ignore stale completions when disconnected/reconnected before async storage calls complete.

**Result:** Proxy settings tab no longer mutates component state from stale async loads after disconnect races.

---

### 196) providers/models tab could apply stale async provider/status loads after disconnect

**Finding:** Providers/models settings tab loaded custom providers and kicked off async status checks without invalidating stale completions when the tab disconnected or was remounted quickly.

**Action:** Updated:

- `packages/web-ui/src/dialogs/ProvidersModelsTab.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- add sequence-based invalidation for custom-provider loads and provider-status checks,
- bail out from async completions when the component is disconnected or a newer load supersedes the in-flight one.

**Result:** Providers/models tab now avoids stale provider/status state mutations across disconnect/remount races.

---

### 197) provider-key input could apply stale async key-check/save outcomes after disconnect

**Finding:** Provider key input component handled timeout cleanup but still allowed async key-status/test/save completions to write state after disconnect or superseded operations.

**Action:** Updated:

- `packages/web-ui/src/components/ProviderKeyInput.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- introduce operation-sequence invalidation across connect/disconnect and save attempts,
- bail out of async key-status/test/save completion handlers when detached or superseded.

**Result:** Provider key input now avoids stale async state mutations across disconnect races and overlapping key operations.

---

### 198) API key prompt polling could resolve from stale in-flight callbacks after detach

**Finding:** API key prompt dialog cleaned polling intervals on disconnect but still allowed already-running async poll callbacks to settle after detach, and did not explicitly settle pending prompt promises when removed externally.

**Action:** Updated:

- `packages/web-ui/src/dialogs/ApiKeyPromptDialog.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- gate async polling callback completion on connection/settled state checks,
- settle pending prompt promises with `false` during disconnect teardown.

**Result:** API key prompt dialogs now avoid stale poll-driven resolution after detach and no longer leave dangling prompt promises when removed externally.

---

### 199) persistent storage dialog could leave stale async request completions and dangling prompt promise on detach

**Finding:** Persistent storage dialog settled once on close, but did not invalidate in-flight permission requests when detached and did not explicitly settle pending request promises on external detach.

**Action:** Updated:

- `packages/web-ui/src/dialogs/PersistentStorageDialog.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- sequence-guard async `navigator.storage.persist()` completions,
- ignore stale completion paths after disconnect/superseding operations,
- settle pending request promises during disconnect teardown.

**Result:** Persistent storage dialog now avoids stale async state mutations and dangling request promises when dialogs are removed during in-flight permission checks.

---

### 200) custom provider dialog could apply stale async test/save completions after unmount

**Finding:** Custom provider dialog ran async model-discovery/save operations without invalidating stale completions when the dialog closed/disconnected mid-request.

**Action:** Updated:

- `packages/web-ui/src/dialogs/CustomProviderDialog.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- add operation-sequence invalidation across disconnects,
- guard async test/save completion paths against detached/superseded operations.

**Result:** Custom provider dialog no longer updates detached component state or executes stale callback/close paths from obsolete async operations.

---

### 201) session list dialog could apply stale async session loads after unmount

**Finding:** Session list dialog loaded metadata asynchronously without invalidating stale in-flight reads during close/unmount races.

**Action:** Updated:

- `packages/web-ui/src/dialogs/SessionListDialog.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- add sequence-based invalidation for async session metadata loads,
- guard success/error/finalization state writes against detached or superseded loads.

**Result:** Session list dialog no longer applies stale async session-list state updates after disconnect.

---

### 202) agent interface send flow could continue after disconnect/session swap during async key/prompt hooks

**Finding:** Agent interface `sendMessage()` awaited API-key reads and optional prompt hooks without invalidating stale in-flight sends, allowing late editor/session mutation after component disconnect or session replacement.

**Action:** Updated:

- `packages/web-ui/src/components/AgentInterface.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- add send-sequence invalidation on disconnect and per-send invocation,
- guard post-await send continuation paths against disconnect/session replacement.

**Result:** Agent interface send flows now abort safely when superseded or detached, avoiding stale async message-send side effects.

---

### 203) model selector deferred keyboard scroll callbacks could run after close

**Finding:** Model selector keyboard navigation scheduled `requestAnimationFrame` scroll callbacks without cancellation/coalescing, allowing stale post-close scroll work and redundant frame scheduling.

**Action:** Updated:

- `packages/web-ui/src/dialogs/ModelSelector.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- coalesce pending selection-scroll frames,
- cancel pending frame on disconnect,
- guard callback execution with connectivity checks.

**Result:** Model selector no longer runs stale deferred scroll callbacks after close/disconnect races.

---

### 204) message editor deferred model-selector open callback could fire after detach

**Finding:** Message editor deferred model-selector opens with `requestAnimationFrame` after focusing the textarea, but did not cancel pending frames on disconnect.

**Action:** Updated:

- `packages/web-ui/src/components/MessageEditor.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- coalesce pending model-selector open frames,
- cancel queued frame callbacks on disconnect,
- guard deferred callbacks with connectivity checks.

**Result:** Message editor no longer triggers stale model-selector open callbacks after component detach races.

---

### 205) message editor attachment ingestion could apply stale async file-processing results after disconnect

**Finding:** Message editor attachment flows (`paste`, file picker, drag/drop) awaited file-loading operations without invalidating stale completion paths, allowing detached state updates from in-flight processing.

**Action:** Updated:

- `packages/web-ui/src/components/MessageEditor.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- introduce sequence-guarded attachment-processing lifecycle,
- ignore stale async completion paths after disconnect/superseded operations,
- ensure processing indicator resets only for active operations.

**Result:** Message editor no longer applies stale async attachment updates after detach races during file ingestion.

---

### 206) mom docker preflight command failures had ambiguous close diagnostics

**Finding:** MOM sandbox docker preflight helper (`execSimple`) treated close errors generically and did not include signal-aware exit diagnostics, producing unclear failure messages when subprocesses terminated unexpectedly.

**Action:** Updated:

- `packages/mom/src/sandbox.ts`
- `packages/mom/CHANGELOG.md`

to:

- include signal-aware close handling in preflight command error paths,
- emit command-context-rich diagnostics (`command + args + exit/signal`) for non-zero preflight failures.

**Result:** MOM sandbox validation failures now report clearer diagnostics for unexpected docker preflight termination modes.

---

### 207) SCP wrapper close handling did not explicitly model signal-terminated copy subprocesses

**Finding:** Pods SCP helper relied on `code === 0` checks but did not explicitly account for `signal` in close-event semantics, leaving signal-interrupted transfer outcomes implicit rather than contractually encoded.

**Action:** Updated:

- `packages/pods/src/ssh.ts`
- `packages/pods/test/ssh-parse.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- treat signal-terminated `scp` subprocess exits as explicit failure outcomes,
- add regression coverage for signal-terminated SCP subprocess behavior.

**Result:** Pods SCP helper now explicitly reports interrupted transfer processes as failures with regression coverage for signal-exit behavior.

---

### 208) session list dialog close path could notify deletion callbacks multiple times

**Finding:** Session list dialog invoked deletion callbacks in `close()` without one-time guarding/cleanup, allowing duplicate delete notifications if close was triggered more than once.

**Action:** Updated:

- `packages/web-ui/src/dialogs/SessionListDialog.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- gate delete-callback notification to a single close path,
- clear tracked deleted-session/callback state after close notification.

**Result:** Session list dialog now emits delete notifications at most once per dialog lifecycle.

---

### 209) interactive `/share` auth preflight misclassified missing/interrupted `gh` checks as auth failures

**Finding:** Interactive share flow checked `gh auth status` via `spawnSync` but did not normalize spawn/signal outcomes, which could report missing/interrupted CLI checks as generic “not logged in” failures.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/gh-auth-status.ts` (new)
- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/test/gh-auth-status.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- centralize `gh auth status` result classification,
- distinguish spawn failures, signal interruptions, and actual unauthenticated states with explicit guidance,
- add focused regression tests for all classification branches.

**Result:** Interactive share preflight now surfaces accurate diagnostics for missing/interrupted GitHub CLI checks versus true authentication failures.

---

### 210) API key prompt polling could overlap async key reads and leak interval rejections

**Finding:** API key prompt dialog used an async `setInterval` callback without serializing polls or catching storage-read failures, allowing overlapping key-read requests and possible unhandled interval promise rejections.

**Action:** Updated:

- `packages/web-ui/src/dialogs/ApiKeyPromptDialog.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- serialize poll iterations with an in-flight guard,
- catch/log storage-read failures inside the interval callback,
- retain existing detach/settlement guards for stale poll callbacks.

**Result:** API key prompt polling now runs deterministically (no overlapping reads) and avoids unhandled async interval rejections on transient storage errors.

---

### 211) process-exit helper could hang when called after child process already terminated

**Finding:** Pods `waitForProcessExit()` waited on future `exit/error` events only; if a child process had already exited before listener attachment, callers could hang awaiting never-fired events.

**Action:** Updated:

- `packages/pods/src/process-exit.ts`
- `packages/pods/test/process-exit.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- add immediate-resolution fast path for already-exited child processes using `exitCode/signalCode`,
- add regression coverage verifying immediate settlement for pre-exited processes.

**Result:** Process-exit helper now settles deterministically even when attached after very fast child-process termination.

---

### 212) session list dialog callback exceptions could disrupt deterministic close/notification teardown

**Finding:** Session list dialog invoked selection/delete callbacks directly during close/select flows, so thrown consumer callback errors could interrupt dialog close sequencing or stop deleted-session callback fan-out.

**Action:** Updated:

- `packages/web-ui/src/dialogs/SessionListDialog.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- ensure selection flow closes dialog via `finally` even when `onSelect` throws,
- isolate delete-notification callback errors per session so fan-out continues and teardown completes.

**Result:** Session list dialog now preserves deterministic close/notification behavior even when consumer callbacks throw.

---

### 213) providers/models refresh action could apply stale async outcomes after disconnect

**Finding:** Providers/models tab refresh flow (`refreshProvider`) awaited model discovery without stale-completion guards, allowing detached status updates and stale alerts after dialog unmount/remount races.

**Action:** Updated:

- `packages/web-ui/src/dialogs/ProvidersModelsTab.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- sequence-guard async refresh completion paths with connectivity checks,
- suppress stale success/error UI updates when refresh completes after disconnect/remount.

**Result:** Provider refresh actions no longer apply stale async updates/alerts after component lifecycle races.

---

### 214) custom provider save flow could surface stale detached alerts and let callback exceptions disrupt close semantics

**Finding:** Custom provider save path guarded stale success completions but still showed catch-path alerts after detach and allowed `onSave` callback exceptions to disrupt deterministic post-save close behavior.

**Action:** Updated:

- `packages/web-ui/src/dialogs/CustomProviderDialog.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- suppress stale detached save-failure alerts with operation-sequence/connectivity checks,
- isolate `onSave` callback exceptions so successful saves still close the dialog.

**Result:** Custom provider save flow now preserves deterministic close semantics and avoids stale detached alerts in asynchronous save races.

---

### 215) interactive countdown timer callback failures could leak/continue timer intervals

**Finding:** Interactive countdown timer invoked external `onTick`/`onExpire` callbacks without exception isolation, allowing callback failures to propagate and potentially leave countdown interval behavior inconsistent.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/components/countdown-timer.ts`
- `packages/coding-agent/test/countdown-timer.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- isolate callback exceptions with defensive logging,
- stop timer progression safely on tick callback failure,
- add regression coverage for normal expiration, explicit dispose, and throwing callback cases.

**Result:** Interactive extension countdown timers now fail safely without leaking repeated interval-driven callback failures.

---

### 216) extension selector/input/editor dialog callbacks could throw through interactive key handling

**Finding:** Extension selector/input/editor components invoked extension-provided callbacks directly from input handlers, allowing callback exceptions to bubble through interactive key handling paths.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/components/extension-selector.ts`
- `packages/coding-agent/src/modes/interactive/components/extension-input.ts`
- `packages/coding-agent/src/modes/interactive/components/extension-editor.ts`
- `packages/coding-agent/test/extension-dialog-callbacks.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- wrap extension callback invocations in exception-isolating helper methods,
- retain interactive loop stability when extension callbacks throw,
- add regression coverage for throwing `onSelect` and `onSubmit` callbacks.

**Result:** Extension dialog callback failures now surface as logged errors without crashing interactive input processing.

---

### 217) selector replacement/disposal flow could leave stale selector timers/async loads active after close

**Finding:** Interactive selector replacement cleared editor containers without consistently disposing prior disposable selector components; session selector also lacked explicit disposal guards for pending status timers and in-flight load completions.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/src/modes/interactive/components/session-selector.ts`
- `packages/coding-agent/test/session-selector-path-delete.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- dispose current disposable selector components during selector swaps/teardown in interactive mode,
- add explicit session-selector dispose semantics (timer cleanup + stale-load suppression),
- add regression coverage ensuring pending async loads are ignored after selector disposal.

**Result:** Interactive selector teardown now cleans up disposable selectors deterministically and avoids stale post-dispose session-selector updates.

---

### 218) extension editor callbacks could still be invoked after component disposal

**Finding:** Extension editor callback isolation prevented throws from bubbling, but callbacks could still run after component disposal in stale invocation paths.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/components/extension-editor.ts`
- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/test/extension-dialog-callbacks.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add explicit disposed-state guarding in extension editor callback paths,
- expose disposal-driven callback suppression semantics,
- ensure interactive hide flow disposes extension editor instances deterministically.

**Result:** Extension editor callbacks are now suppressed after disposal, avoiding stale post-teardown callback execution.

---

### 219) extension selector/input callbacks could still run after disposal

**Finding:** Selector/input dialogs isolated callback exceptions but did not explicitly suppress callback invocation after component disposal.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/components/extension-selector.ts`
- `packages/coding-agent/src/modes/interactive/components/extension-input.ts`
- `packages/coding-agent/test/extension-dialog-callbacks.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add disposed-state guards for selector/input callback paths and key handling,
- suppress callback invocation after teardown,
- extend regression coverage for post-dispose selector/input callback suppression.

**Result:** Extension selector/input callbacks are now reliably ignored after disposal, preventing stale callback execution during teardown races.

---

### 220) extension editor prompt completion lacked instance-aware single-settlement guarding

**Finding:** Extension editor prompt flow resolved callbacks by directly hiding current editor instance, without instance-aware single-settlement guards, allowing stale callbacks to potentially tear down a newer editor instance.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- enforce single-settlement completion for extension editor prompt callbacks,
- route hide operations through instance-aware guards to suppress stale editor callback teardown.

**Result:** Extension editor prompt completion now settles once and ignores stale callbacks targeting replaced editor instances.

---

### 221) tree/user-message selector auto-cancel/callback paths could fire unsafely after teardown

**Finding:** Tree/user-message selectors schedule delayed auto-cancel on empty data and invoke external callbacks directly; without disposal-aware guards and callback isolation, stale timers/callback exceptions could disrupt teardown.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/components/tree-selector.ts`
- `packages/coding-agent/src/modes/interactive/components/user-message-selector.ts`
- `packages/coding-agent/test/selector-autocancel-dispose.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add disposal-aware timer cleanup for empty-state auto-cancel timeouts,
- suppress selector callback invocation after disposal,
- isolate selector callback exceptions during interactive key handling,
- add regression coverage proving auto-cancel timers are ignored after dispose and callback exceptions are contained.

**Result:** Tree/user-message selectors no longer emit stale callbacks after teardown and no longer propagate callback exceptions through interactive key handling.

---

### 222) provider-key input could retain stale `testing` UI state across disconnect/remount cycles

**Finding:** Provider key input invalidated async operations on disconnect, but did not reset transient `testing` UI state during teardown.

**Action:** Updated:

- `packages/web-ui/src/components/ProviderKeyInput.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- clear `testing` state in `disconnectedCallback()` alongside operation invalidation/timer cleanup.

**Result:** Provider key input no longer carries stale loading indicators across detach/remount cycles.

---

### 223) interactive chat/pending container clears could orphan disposable child components

**Finding:** Interactive mode cleared chat/pending containers directly, which removed children without disposing disposable components and risked leaking timers/listeners from detached transient UI components.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/test/interactive-mode-container-dispose.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- route chat/pending container clears through disposal-aware cleanup helper,
- add regression coverage verifying disposable children are disposed before container clear.

**Result:** Interactive mode now disposes disposable transient components before container clears, preventing stale background activity after UI teardown.

---

### 224) mac-system-theme extension example could accumulate overlapping async poll intervals

**Finding:** mac-system-theme example started an async polling interval on `session_start` without clearing prior intervals or serializing in-flight polls, risking interval accumulation and overlapping `osascript` checks.

**Action:** Updated:

- `packages/coding-agent/examples/extensions/mac-system-theme.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- clear existing interval before starting a new session poller,
- serialize asynchronous poll cycles with an in-flight guard.

**Result:** mac-system-theme example now runs a single serialized theme poll loop per session lifecycle.

---

### 225) mac-system-theme poll loop could stall if UI theme application threw

**Finding:** mac-system-theme poll loop used an in-flight guard but reset it only on happy-path completion, so unexpected callback errors could leave polling permanently stalled.

**Action:** Updated:

- `packages/coding-agent/examples/extensions/mac-system-theme.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- wrap poll body in `try/finally` so in-flight guard always resets,
- log poll-loop failures without halting subsequent polling cycles.

**Result:** mac-system-theme example poll loop now recovers from transient callback errors instead of stalling.

---

### 226) tui autocomplete fd subprocess handling lacked explicit signal/error-path coverage

**Finding:** `walkDirectoryWithFd` relied on status checks only and did not explicitly model `spawnSync` signal/error exits, making edge-case behavior less explicit and harder to regression-test.

**Action:** Updated:

- `packages/tui/src/autocomplete.ts`
- `packages/tui/test/autocomplete.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- introduce an injectable fd runner in `CombinedAutocompleteProvider` for deterministic subprocess-path testing,
- explicitly treat spawn error/signal/null-status outcomes as empty result sets,
- add regression tests for signal-exit safety and injected successful output parsing.

**Result:** autocomplete fd path handling now has explicit signal/error semantics and dedicated regression coverage.

---

### 227) coding-agent tool bootstrap spawnSync paths had ambiguous signal diagnostics

**Finding:** tools bootstrap command checks/extraction paths used `spawnSync` but did not consistently surface signal/null-status outcomes, causing ambiguous diagnostics in command discovery or tar extraction failures.

**Action:** Updated:

- `packages/coding-agent/src/utils/tools-manager.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- treat signal/null-status command checks as command-unavailable,
- include signal/exit-code-aware extraction diagnostics for tar failures.

**Result:** managed tool bootstrap now reports clearer subprocess failure causes and avoids false-positive command availability under abnormal process exits.

---

### 228) `extract_document` pre-download size checks accepted malformed `Content-Length` prefixes

**Finding:** web-ui `extract_document` tool parsed `Content-Length` with permissive integer coercion, which could partially accept malformed headers (for example `123abc`) during pre-download size gating.

**Action:** Updated:

- `packages/web-ui/src/tools/extract-document.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- introduce strict `Content-Length` header parsing (`^\d+$` + safe-integer validation),
- ignore malformed header values instead of partially coercing numeric prefixes.

**Result:** document-size preflight checks now only trust strictly valid numeric `Content-Length` values.

---

### 229) terminal background auto-detection accepted malformed `COLORFGBG` tokens

**Finding:** coding-agent theme auto-detection parsed `COLORFGBG` background tokens with permissive integer coercion, which could mis-detect light/dark defaults for malformed values.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/theme/theme.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add strict background-index parsing (`^\d+$`) for `COLORFGBG`,
- fall back deterministically when the environment token is malformed.

**Result:** terminal theme auto-detection now ignores malformed `COLORFGBG` background values instead of partially coercing them.

---

### 230) AI usage/pricing numeric normalization still admitted malformed external number fields

**Finding:** AI Cloud Code Assist usage metadata accepted negative/fractional token values, and model-catalog generation used permissive float parsing for provider pricing fields.

**Action:** Updated:

- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/google-gemini-cli-usage-metadata.test.ts`
- `packages/ai/scripts/generate-models.ts`
- `packages/ai/CHANGELOG.md`

to:

- normalize usage metadata to non-negative integer token counts (reject negatives, truncate fractional values),
- add regression coverage for malformed/negative usage metadata payloads,
- parse external pricing metadata with strict numeric conversion (`Number(...)`) instead of partial float coercion.

**Result:** AI usage accounting and model-catalog price ingestion now handle malformed numeric payloads more defensively and deterministically.

---

### 231) mom API key resolution was hardcoded to Anthropic regardless of selected model provider

**Finding:** mom resolved model provider/model ID via environment overrides, but runtime API-key lookup always requested Anthropic credentials, breaking non-Anthropic provider selection and contradicting configurable model intent.

**Action:** Updated:

- `packages/mom/src/agent.ts`
- `packages/mom/test/agent-model.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- make API-key lookup provider-aware (`getMomApiKey(..., model.provider)`),
- add provider-specific missing-key diagnostics,
- normalize env override parsing by trimming and ignoring blank values before fallback/validation,
- add regression tests for provider-aware key lookup and env override handling.

**Result:** mom model/provider configuration now drives matching credential lookup reliably instead of always requiring Anthropic keys.

---

### 232) pods CLI silently ignored missing required option values for setup/start flags

**Finding:** pods CLI option parsing accepted `--memory`, `--context`, `--gpus`, `--name`, `--mount`, `--models-path`, and `--vllm` flags without enforcing required values, allowing accidental silent fallback behavior when values were omitted.

**Action:** Updated:

- `packages/pods/src/cli-options.ts`
- `packages/pods/src/cli.ts`
- `packages/pods/test/cli-options.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- centralize required-option value parsing in a shared helper,
- reject missing option values (including option-like next tokens),
- add unit coverage for accepted/missing/option-like-value cases,
- preserve top-level CLI error handling flow via thrown parse errors.

**Result:** pods CLI now fails fast with explicit option-value diagnostics instead of silently ignoring missing required values.

---

### 233) `start --vllm` accepted empty passthrough arg lists

**Finding:** `pi start ... --vllm` switched parsing into passthrough mode but did not require any trailing arguments, so a bare `--vllm` silently fell back to standard launch settings.

**Action:** Updated:

- `packages/pods/src/cli.ts`
- `packages/pods/CHANGELOG.md`

to:

- reject `start --vllm` when no passthrough arguments are provided,
- surface explicit `Option --vllm requires at least one argument.` diagnostics.

**Result:** `--vllm` passthrough mode now has explicit argument requirements and no longer silently degrades to default launch behavior.

---

### 234) coding-agent CLI silently ignored missing values for value-backed flags

**Finding:** coding-agent CLI parser ignored value-backed flags when values were omitted (including extension string flags), which could silently drop user intent without diagnostics.

**Action:** Updated:

- `packages/coding-agent/src/cli/args.ts`
- `packages/coding-agent/test/args.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- centralize value extraction for value-backed flags,
- emit explicit warnings when required flag values are missing,
- apply the same missing-value warnings to extension-registered string flags,
- add regression coverage for missing-value warning behavior.

**Result:** coding-agent CLI now surfaces actionable diagnostics when value-backed flags are missing arguments instead of silently ignoring them.

---

### 235) coding-agent value-backed flags could consume following flags as values

**Finding:** value-backed CLI flags accepted option-like next tokens as values (for example `--model --print`), causing subsequent flags to be swallowed instead of parsed.

**Action:** Updated:

- `packages/coding-agent/src/cli/args.ts`
- `packages/coding-agent/test/args.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- reject option-like tokens for value-backed flags by default,
- preserve option-like value support for system prompt flags (`--system-prompt`, `--append-system-prompt`),
- add regression coverage confirming non-swallowed follow-up flags and preserved system-prompt behavior.

**Result:** coding-agent CLI no longer swallows subsequent flags as accidental option values in common value-backed flag paths.

---

### 236) mom CLI silently accepted missing `--sandbox` / `--download` values

**Finding:** mom CLI argument parsing accepted `--sandbox` and `--download` without required values, which could silently fall back to default behavior rather than failing with actionable diagnostics.

**Action:** Updated:

- `packages/mom/src/cli-args.ts` (new)
- `packages/mom/src/main.ts`
- `packages/mom/test/cli-args.test.ts` (new)
- `packages/mom/CHANGELOG.md`

to:

- extract CLI parsing into a dedicated helper module,
- enforce required values for `--sandbox` and `--download` (including option-like token rejection),
- add focused regression tests for valid and missing-value scenarios,
- keep startup flow unchanged apart from explicit parse errors for invalid CLI usage.

**Result:** mom CLI now rejects incomplete option invocations deterministically instead of silently ignoring missing required values.

---

### 237) mom required-option parsing still accepted single-dash option tokens as values

**Finding:** mom required-option parsing rejected `--option`-style tokens as missing values but still accepted single-dash option-like tokens (for example `--sandbox -h`) as literal values.

**Action:** Updated:

- `packages/mom/src/cli-args.ts`
- `packages/mom/test/cli-args.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- treat any leading-dash token as option-like for required option values,
- add regression coverage for single-dash token rejection.

**Result:** mom required-option parsing now rejects both single-dash and double-dash option-like tokens as missing values.

---

### 238) agent project-runner option parsing accepted option-like tokens as values

**Finding:** `project-runner` parsed `--iterations`, `--max-tasks`, and `--provider` values by position only, so option-like next tokens (for example `--provider --max-tasks`) could be consumed as values and suppress intended flag parsing.

**Action:** Updated:

- `packages/agent/src/project-runner.ts`
- `packages/agent/test/project-runner.test.ts` (new)
- `packages/agent/CHANGELOG.md`

to:

- centralize required option-value parsing with option-like token rejection,
- expose `parseProjectRunnerArgs(...)` for focused parser coverage,
- guard CLI entrypoint execution so parser utilities can be imported in tests without running `main()`,
- add regression tests for valid parsing and missing/option-like value rejection.

**Result:** project-runner CLI parsing now fails fast on malformed option values and no longer swallows subsequent flags as accidental option values.

---

### 239) pods required-option parsing still accepted single-dash option-like tokens

**Finding:** shared pods required-option parsing rejected `--option` next tokens but still accepted single-dash option-like tokens (for example `--context -m`) as literal values.

**Action:** Updated:

- `packages/pods/src/cli-options.ts`
- `packages/pods/test/cli-options.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- treat any leading-dash next token as invalid for required option values,
- add focused regression coverage for single-dash rejection.

**Result:** pods required-option parsing now consistently rejects both single-dash and double-dash option-like tokens as missing required values.

---

### 240) pods `--pod <name>` parsing still accepted single-dash option-like values

**Finding:** pods `extractPodOverride(...)` rejected missing/`--option` values for `--pod` but still accepted single-dash option-like tokens (for example `--pod -h`) as pod names.

**Action:** Updated:

- `packages/pods/src/cli-args.ts`
- `packages/pods/test/cli-args.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- reject any leading-dash token as invalid `--pod` value,
- add regression coverage for single-dash option-like value rejection.

**Result:** pods `--pod` parsing now consistently rejects both single- and double-dash option-like tokens as missing required pod names.

---

### 241) pods `--pod=<name>` parsing still accepted single-dash option-like values

**Finding:** pods `extractPodOverride(...)` handled `--pod <name>` single-dash rejection, but `--pod=<name>` still accepted single-dash option-like values (for example `--pod=-h`) as pod names.

**Action:** Updated:

- `packages/pods/src/cli-args.ts`
- `packages/pods/test/cli-args.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- apply leading-dash rejection consistently to both `--pod <name>` and `--pod=<name>` forms,
- add regression coverage for the equals-form edge case.

**Result:** pods pod-override parsing now enforces identical value validation semantics across both flag syntaxes.

---

### 242) mom read-tool line counting overestimated files with trailing newlines

**Finding:** mom read-tool estimated total line counts as `wc -l + 1`, which overcounted files that end with trailing newlines and allowed out-of-range offsets (for example offset `2` on a one-line file).

**Action:** Updated:

- `packages/mom/src/tools/read.ts`
- `packages/mom/test/read-tool.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- switch to exact line counting via `sed -n '$='`,
- treat empty line-count output as zero lines,
- enforce offset-bounds checks against exact line counts while still allowing offset-less empty-file reads,
- add regression tests for empty files and trailing-newline offset bounds.

**Result:** read-tool now reports/enforces correct line boundaries and no longer accepts false extra-line offsets caused by newline-count approximation.

---

### 243) coding-agent read-tool treated trailing newline as extra readable line

**Finding:** coding-agent read-tool split text with `text.split("\n")`, which treated trailing newlines as additional empty lines and allowed out-of-range offsets (for example offset `2` on `hello\n`).

**Action:** Updated:

- `packages/coding-agent/src/core/tools/read.ts`
- `packages/coding-agent/test/read-tool.test.ts` (new)
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize text into logical lines (drop only terminal split-empty segment),
- enforce offset bounds only for explicitly provided offsets against exact logical line counts,
- preserve offset-less empty-file reads,
- add regression coverage for trailing-newline, empty-file, and empty-file-offset scenarios.

**Result:** coding-agent read-tool now enforces exact line-offset boundaries and no longer exposes false extra-line offsets from trailing newline artifacts.

---

### 244) shared AI usage metadata parsers still accepted negative/fractional token values

**Finding:** shared usage metadata parsers for Google/Bedrock/OpenAI-Responses accepted any finite numeric value, so malformed provider payloads could produce negative or fractional token accounting values.

**Action:** Updated:

- `packages/ai/src/providers/google-shared.ts`
- `packages/ai/src/providers/amazon-bedrock.ts`
- `packages/ai/src/providers/openai-responses-shared.ts`
- `packages/ai/test/google-usage-metadata.test.ts`
- `packages/ai/test/amazon-bedrock-usage.test.ts`
- `packages/ai/test/openai-responses-shared-usage.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- normalize parsed usage values to non-negative integers (`Math.trunc` + lower-bound guard),
- ignore malformed/negative values by falling back to computed safe totals,
- add regression coverage for malformed, negative, and fractional token-value inputs.

**Result:** shared AI usage accounting now avoids negative/fractional token drift and remains stable when compatible providers emit malformed token metadata.

---

### 245) coding-agent read-tool accepted non-integer/non-positive offset and limit values

**Finding:** coding-agent read-tool accepted arbitrary numeric `offset`/`limit` values and silently coerced them during slicing, allowing malformed ranges (for example `offset=0`, `offset=1.2`, `limit=-3`) to produce ambiguous read behavior.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/read.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/test/read-tool.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- constrain read schema `offset`/`limit` fields to positive integers,
- validate range parameters at runtime with explicit errors for malformed values,
- add regression tests for non-positive/non-integer offset/limit inputs.

**Result:** coding-agent read-tool now fails fast on malformed range inputs instead of silently coercing invalid numeric values.

---

### 246) mom read-tool accepted non-integer/non-positive offset and limit values

**Finding:** mom read-tool accepted arbitrary numeric `offset`/`limit` values and coerced them in range logic, allowing malformed values to produce unpredictable slices.

**Action:** Updated:

- `packages/mom/src/tools/read.ts`
- `packages/mom/test/read-tool.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- constrain read schema `offset`/`limit` fields to positive integers,
- validate optional range parameters with explicit parse errors before command execution,
- add regression coverage for non-positive/non-integer values.

**Result:** mom read-tool now rejects malformed read ranges deterministically and preserves clear caller diagnostics.

---

### 247) AI OpenAI Completions/Anthropic streams still accepted negative/fractional usage values

**Finding:** OpenAI Completions and Anthropic stream usage normalization accepted any finite numeric value, allowing malformed provider payloads to produce negative or fractional token accounting.

**Action:** Updated:

- `packages/ai/src/providers/openai-completions.ts`
- `packages/ai/src/providers/anthropic.ts`
- `packages/ai/test/openai-completions-tool-choice.test.ts`
- `packages/ai/test/github-copilot-anthropic.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- normalize usage counters to non-negative integers (`Math.trunc` + lower-bound guard),
- ignore malformed/negative values by falling back to safe computed totals,
- add regression tests for malformed/fractional/negative usage payloads in both OpenAI Completions and Anthropic stream paths.

**Result:** OpenAI Completions and Anthropic usage accounting now avoids negative/fractional drift under malformed metadata and remains consistent with integer token semantics.

---

### 248) coding-agent grep tool accepted malformed numeric `context`/`limit` values

**Finding:** coding-agent grep tool accepted arbitrary numeric `context`/`limit` values and silently coerced out-of-range/non-integer inputs (for example `context=-1`, `context=1.5`, `limit=0`) instead of failing fast.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/grep.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- constrain schema-level `context`/`limit` to integer domains,
- validate runtime values with explicit non-negative/positive integer requirements,
- add regression tests covering malformed numeric range inputs.

**Result:** grep tool now rejects malformed numeric range inputs deterministically instead of silently coercing them.

---

### 249) coding-agent/mom bash tools silently accepted non-positive timeout values

**Finding:** coding-agent and mom bash tools accepted non-positive timeout values, which silently disabled timeout behavior instead of rejecting malformed inputs.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/bash.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`
- `packages/mom/src/tools/bash.ts`
- `packages/mom/test/bash-tool.test.ts` (new)
- `packages/mom/CHANGELOG.md`

to:

- constrain timeout schema to positive numbers (`exclusiveMinimum: 0`),
- add runtime timeout validation with explicit parse errors for non-positive values,
- add regression coverage for invalid timeout values in both packages.

**Result:** coding-agent and mom bash tools now reject malformed timeout values deterministically instead of silently running without timeout limits.

---

### 250) coding-agent find tool accepted malformed numeric `limit` values

**Finding:** coding-agent find tool accepted arbitrary numeric `limit` inputs and silently coerced invalid values (for example `limit=0`, `limit=2.5`) instead of failing fast.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/find.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- constrain schema/runtime `limit` to positive integers,
- reject malformed values with explicit diagnostics,
- add regression coverage for invalid numeric limits.

**Result:** find tool now rejects malformed numeric limit inputs deterministically rather than silently coercing them.

---

### 251) coding-agent ls tool accepted malformed numeric `limit` values

**Finding:** coding-agent ls tool accepted arbitrary numeric `limit` values and silently coerced invalid inputs (for example `limit=0`, `limit=3.2`) instead of failing fast.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/ls.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- constrain schema/runtime `limit` to positive integers,
- reject malformed values with explicit diagnostics,
- add regression coverage for invalid numeric limits.

**Result:** ls tool now rejects malformed numeric limit inputs deterministically instead of silently coercing them.

---

### 252) coding-agent execution-plan updates accepted non-integer task indices

**Finding:** execution-plan progress updates accepted non-integer `task_index` values, which could bypass index intent checks and fail later with ambiguous runtime errors.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/execution-plan.ts`
- `packages/coding-agent/test/execution-plan.test.ts` (new)
- `packages/coding-agent/CHANGELOG.md`

to:

- constrain `task_index` schema to non-negative integers,
- validate runtime task indices explicitly before bounds checks,
- add regression coverage for non-integer index rejection and valid-index update behavior.

**Result:** execution-plan progress updates now reject malformed indices deterministically and preserve clear index-validation diagnostics.

---

### 253) pods memory option accepted non-decimal numeric formats

**Finding:** pods `--memory` normalization used broad numeric coercion, so non-decimal formats (for example `1e2`, `0x10`, `.5`) were accepted even though CLI guidance expects decimal percentages.

**Action:** Updated:

- `packages/pods/src/model-options.ts`
- `packages/pods/test/model-options.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require decimal numeric format (`digits` with optional decimal fraction) before numeric conversion,
- reject scientific/hex/shorthand numeric formats with explicit validation errors,
- add regression coverage for malformed numeric-format inputs.

**Result:** pods memory parsing now accepts only intended decimal percentage input formats and rejects non-decimal numeric coercions deterministically.

---

### 254) Gemini CLI retry-delay headers accepted non-decimal numeric formats

**Finding:** Gemini CLI retry-delay parsing used broad numeric coercion for `Retry-After` and `x-ratelimit-reset-after` headers, so non-decimal numeric formats (for example `0x10`) were accepted instead of falling back to other delay hints.

**Action:** Updated:

- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/google-gemini-cli-retry-delay.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require decimal numeric format for delay-second headers before numeric conversion,
- ignore non-decimal header values and continue fallback parsing (date/body patterns),
- add regression tests for non-decimal header-value rejection.

**Result:** retry-delay parsing now rejects non-decimal header formats deterministically and preserves fallback delay extraction behavior.

---

### 255) agent runner executed side-effectful `main()` when imported

**Finding:** `packages/agent/src/runner.ts` invoked `main()` unconditionally at module load, causing side effects when imported for testing or helper reuse.

**Action:** Updated:

- `packages/agent/src/runner.ts`
- `packages/agent/test/runner.test.ts` (new)
- `packages/agent/CHANGELOG.md`

to:

- guard direct CLI execution behind an `import.meta.url` entrypoint check,
- expose reusable `parseRunnerArgs(...)` helper for focused parser coverage,
- add regression tests for argument normalization behavior.

**Result:** runner utilities can now be imported safely without accidental process-side effects, while preserving direct CLI invocation behavior.

---

### 256) AI CLI provider selection accepted unsafe integer inputs

**Finding:** interactive provider-selection parsing validated decimal formatting/range but did not reject unsafe integers, allowing oversized values to round before range checks.

**Action:** Updated:

- `packages/ai/src/cli-selection.ts`
- `packages/ai/test/cli-selection.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require safe-integer parsing for numeric provider selections,
- reject oversized numeric selections deterministically (`undefined` fallback),
- add regression coverage for unsafe integer selection input.

**Result:** provider-selection parsing now rejects unsafe integer values instead of accepting rounded coercions.

---

### 257) coding-agent `COLORFGBG` theme auto-detection accepted unsafe integer background indices

**Finding:** theme background-index parsing validated decimal strings but accepted oversized integers that could round before dark/light classification.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/theme/theme.ts`
- `packages/coding-agent/test/theme-colorfgbg.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require safe integers for `COLORFGBG` background indices,
- preserve dark fallback on malformed/unsafe index values,
- add regression tests for both valid light detection and unsafe-index fallback behavior.

**Result:** theme auto-detection now ignores unsafe background indices and falls back deterministically.

---

### 258) coding-agent ANSI HTML export accepted out-of-range/unsafe SGR color values

**Finding:** ANSI-to-HTML SGR parsing accepted numeric color parameters without byte-range guards, allowing invalid CSS color outputs for out-of-range/unsafe values.

**Action:** Updated:

- `packages/coding-agent/src/core/export-html/ansi-to-html.ts`
- `packages/coding-agent/test/ansi-to-html.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- parse SGR tokens with safe-integer checks,
- validate 256-color and RGB components to byte ranges before applying styles,
- add regression coverage for out-of-range/unsafe SGR color payloads.

**Result:** ANSI export now rejects malformed/out-of-range SGR color values instead of emitting invalid CSS styles.

---

### 259) web-ui model-discovery metadata parsing accepted unsafe integer context/token values

**Finding:** remote model metadata integer parsing validated decimal formats but allowed unsafe integer values, enabling rounded context/token coercions.

**Action:** Updated:

- `packages/web-ui/src/utils/model-discovery.ts`
- `packages/web-ui/test/model-discovery.test.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- require safe integers for discovered numeric metadata fields,
- fall back to defaults when unsafe values are encountered,
- add regression tests for valid parsing and unsafe fallback behavior.

**Result:** model discovery now rejects unsafe integer metadata deterministically.

---

### 260) changelog version parsing accepted unsafe integer version segments

**Finding:** changelog parsing and last-version filtering converted version segments directly with `parseInt`, allowing unsafe version coercion.

**Action:** Updated:

- `packages/coding-agent/src/utils/changelog.ts`
- `packages/coding-agent/test/changelog-utils.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- centralize safe semantic-version parsing helpers,
- ignore changelog headers with unsafe version segments,
- fall back to `0.0.0` when stored last-version input is malformed/unsafe.

**Result:** changelog filtering now rejects unsafe version numerics and preserves deterministic update-entry selection.

---

### 261) MOM Slack timestamp conversion accepted unsafe millisecond outputs

**Finding:** decimal/integer Slack timestamp conversion paths could produce millisecond values beyond safe-integer precision.

**Action:** Updated:

- `packages/mom/src/slack-timestamp.ts`
- `packages/mom/test/slack-timestamp.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- enforce safe-integer checks on computed millisecond outputs for decimal and integer-second conversion paths,
- return `undefined` for oversized timestamp values,
- add regression tests for oversized decimal/integer timestamp rejection.

**Result:** Slack timestamp normalization now rejects unsafe millisecond values instead of returning rounded coercions.

---

### 262) web-ui PPTX slide/notes ordering accepted unsafe archive index numbers

**Finding:** PPTX slide and notes sorting extracted numeric indices directly with `parseInt`, allowing unsafe archive indices to round.

**Action:** Updated:

- `packages/web-ui/src/utils/archive-index.ts` (new)
- `packages/web-ui/src/utils/attachment-utils.ts`
- `packages/web-ui/test/archive-index.test.ts` (new)
- `packages/web-ui/CHANGELOG.md`

to:

- centralize safe archive-index parsing with strict decimal + safe-integer validation,
- use guarded index parsing for slide/notes ordering,
- add regression tests for valid, malformed, and unsafe archive index values.

**Result:** PPTX ordering now ignores unsafe indices and avoids rounded sort-order coercions.

---

### 263) coding-agent HTML export color parsing accepted malformed/unsafe `rgb(...)` components

**Finding:** export color parsing accepted raw numeric RGB components without range-safe guards, allowing malformed values to propagate into derived export colors.

**Action:** Updated:

- `packages/coding-agent/src/core/export-html/index.ts`
- `packages/coding-agent/test/export-html-color-parsing.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- validate decimal RGB components as safe integers within `[0,255]`,
- reuse guarded parsing in brightness/derived-export color calculations,
- add regression tests for out-of-range and unsafe RGB component rejection.

**Result:** HTML export color derivation now rejects malformed/unsafe RGB components deterministically.

---

### 264) TUI editor Kitty CSI-u parsing accepted unsafe integer modifier payloads

**Finding:** Kitty CSI-u printable-key decoding parsed modifier/codepoint fields without safe-integer guards, allowing oversized modifier payloads to be misinterpreted as valid key events.

**Action:** Updated:

- `packages/tui/src/components/editor.ts`
- `packages/tui/test/editor-kitty-csiu.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- add safe-integer parsing for Kitty codepoint/modifier fields,
- reject malformed/unsafe modifier tokens explicitly,
- add regression tests for valid printable CSI-u behavior and unsafe-modifier rejection.

**Result:** editor CSI-u decoding now ignores malformed oversized numeric payloads instead of inserting unintended characters.

---

### 265) TUI overlay percentage parsing accepted overflow/out-of-range percentage values

**Finding:** overlay width/row/col/maxHeight percentage parsing relied on raw `parseFloat` and accepted overflow/out-of-range percentages, coercing invalid values into clamped edge placement/sizing.

**Action:** Updated:

- `packages/tui/src/tui.ts`
- `packages/tui/test/overlay-options.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- centralize percentage parsing with finite range validation (`0-100`),
- reject malformed/overflow/out-of-range percentages and fall back to default/anchor layout behavior,
- add regression tests for overflow width fallback and overflow row-percent center fallback behavior.

**Result:** overlay layout now treats overflow/out-of-range percentages as invalid and avoids coercive edge clamping from malformed numeric inputs.

---

### 266) TUI cell-size response parsing accepted unsafe integer dimension payloads

**Finding:** terminal cell-size response parsing converted captured numeric fields directly and accepted oversized integer payloads, allowing malformed responses to update global image cell dimensions with rounded values.

**Action:** Updated:

- `packages/tui/src/tui.ts`
- `packages/tui/test/tui-cell-size-response.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- parse response width/height fields as positive safe integers,
- ignore malformed/unsafe response payloads while still draining response frames,
- add regression tests for valid updates and unsafe-response rejection behavior.

**Result:** TUI now ignores malformed oversized cell-size payloads and only applies validated positive safe-integer dimensions.

---

### 267) Gemini CLI retry-delay parsing accepted oversized delay values beyond safe millisecond precision

**Finding:** retry-delay normalization accepted finite positive delays without safe-integer millisecond bounds, allowing oversized header/body delay values to produce rounded unsafe wait durations.

**Action:** Updated:

- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/google-gemini-cli-retry-delay.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require normalized retry delays to be finite positive safe-integer milliseconds,
- ignore oversized delay hints and continue fallback behavior when available,
- add regression coverage for unsafe `x-ratelimit-reset-after` and oversized body retry values.

**Result:** retry-delay extraction now rejects oversized unsafe millisecond delays instead of returning rounded coercions.

---

### 268) coding-agent tool numeric parameters accepted unsafe integers

**Finding:** execution-plan/read/ls/find/grep parameter validation accepted `Number.isInteger(...)` values, allowing unsafe integers (`> Number.MAX_SAFE_INTEGER`) to pass task-index/limit/context/offset checks via rounded coercion.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/execution-plan.ts`
- `packages/coding-agent/src/core/tools/read.ts`
- `packages/coding-agent/src/core/tools/ls.ts`
- `packages/coding-agent/src/core/tools/find.ts`
- `packages/coding-agent/src/core/tools/grep.ts`
- `packages/coding-agent/test/execution-plan.test.ts`
- `packages/coding-agent/test/read-tool.test.ts`
- `packages/coding-agent/test/tool-numeric-parameter-safety.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require safe-integer validation for task-index and read/ls/find/grep numeric parameters,
- reject oversized integer inputs with existing deterministic parameter errors,
- add focused regression coverage for unsafe task-index/offset/limit/context inputs.

**Result:** coding-agent tool parameter parsing now rejects unsafe integers instead of accepting rounded coercions.

---

### 269) TUI Kitty key parsing accepted unsafe integer CSI-u/modifyOtherKeys fields

**Finding:** `packages/tui/src/keys.ts` parsed CSI-u and modifyOtherKeys numeric fields with `parseInt(...)` and no safe-integer bounds, allowing oversized modifier/codepoint payloads into modifier bitmasking and key-id synthesis paths.

**Action:** Updated:

- `packages/tui/src/keys.ts`
- `packages/tui/test/keys.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- centralize Kitty numeric parsing through safe-integer helpers,
- reject unsafe/invalid modifier and Unicode codepoint fields before sequence parsing succeeds,
- add regression tests asserting unsafe modifier sequences do not match parsed key IDs.

**Result:** malformed oversized Kitty numeric fields are now rejected before key matching/parsing, preventing false synthesized modifier combinations from unsafe integer coercion.

---

### 270) coding-agent settings-selector numeric options accepted permissive integer coercion

**Finding:** `packages/coding-agent/src/modes/interactive/components/settings-selector.ts` parsed `editor-padding` and `autocomplete-max-visible` values with direct `parseInt(...)`, which could forward malformed or unsafe integer coercions into settings callbacks.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/components/settings-selector.ts`
- `packages/coding-agent/test/settings-selector.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- centralize numeric option parsing via strict decimal safe-integer validation,
- reject malformed/unsafe values before invoking settings callbacks,
- add regression coverage for valid and malformed/unsafe numeric option values.

**Result:** settings-selector numeric options now reject malformed/unsafe integer payloads instead of forwarding permissive numeric coercions.

---

### 271) TUI ANSI wrap style tracker accepted malformed/unsafe SGR color payloads

**Finding:** `packages/tui/src/utils.ts` tracked active wrap styles by parsing SGR parameters with permissive integer coercion, allowing malformed/unsafe 256-color/RGB numeric payloads to be re-emitted in continuation-line style state.

**Action:** Updated:

- `packages/tui/src/utils.ts`
- `packages/tui/test/wrap-ansi.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- parse SGR tokens via strict decimal safe-integer parsing,
- require byte-range validation for tracked 256-color/RGB parameters,
- add regression coverage ensuring malformed/unsafe 256-color values are not carried into wrapped continuation segments.

**Result:** wrap-style state tracking now ignores malformed/unsafe SGR color payloads instead of re-emitting invalid carried-over ANSI color sequences.

---

### 272) coding-agent theme hex parsing accepted malformed trailing-character coercions

**Finding:** `packages/coding-agent/src/modes/interactive/theme/theme.ts` parsed `#RRGGBB` channels with permissive base-16 `parseInt(...)`, allowing malformed tokens like `#ff00f-` to partially coerce instead of failing validation.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/theme/theme.ts`
- `packages/coding-agent/test/theme-hex-validation.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict 6-digit hex validation before channel parsing,
- reject malformed trailing-character hex tokens deterministically,
- add regression coverage for malformed hex-color rejection during theme loading.

**Result:** theme loading now rejects malformed `#RRGGBB` tokens instead of accepting partial base-16 coercions.

---

### 273) coding-agent COLORFGBG theme auto-detection accepted out-of-range palette indices

**Finding:** `packages/coding-agent/src/modes/interactive/theme/theme.ts` accepted any safe integer `COLORFGBG` background index, including out-of-range values outside ANSI palette bounds (`0-255`), causing malformed environment payloads to influence light/dark detection.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/theme/theme.ts`
- `packages/coding-agent/test/theme-colorfgbg.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- enforce `0-255` bounds for parsed `COLORFGBG` background indices,
- fall back to default theme detection when the index is out-of-range,
- add regression coverage for out-of-range background index rejection.

**Result:** theme auto-detection now ignores malformed out-of-range `COLORFGBG` values instead of treating oversized palette indices as valid.

---

### 274) AI usage metadata parsers accepted unsafe integer token values

**Finding:** OpenAI/Anthropic/Google/Bedrock usage normalization paths accepted finite numeric values without safe-integer bounds, allowing oversized token counters to be rounded and incorporated into usage totals.

**Action:** Updated:

- `packages/ai/src/providers/openai-completions.ts`
- `packages/ai/src/providers/anthropic.ts`
- `packages/ai/src/providers/openai-responses-shared.ts`
- `packages/ai/src/providers/google-shared.ts`
- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/src/providers/amazon-bedrock.ts`
- `packages/ai/test/openai-completions-tool-choice.test.ts`
- `packages/ai/test/github-copilot-anthropic.test.ts`
- `packages/ai/test/openai-responses-shared-usage.test.ts`
- `packages/ai/test/google-usage-metadata.test.ts`
- `packages/ai/test/google-gemini-cli-usage-metadata.test.ts`
- `packages/ai/test/amazon-bedrock-usage.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- validate truncated token counters as safe integers before acceptance,
- ignore malformed oversized token counters in all shared usage parser paths,
- add regression tests for unsafe integer token fields across provider usage metadata and stream usage events.

**Result:** AI usage accounting now rejects unsafe oversized token counters instead of accepting rounded coercions.

---

### 275) coding-agent export theme overrides did not resolve variable references consistently

**Finding:** `getThemeExportColors(...)` resolved `export.pageBg/cardBg/infoBg` variables only when prefixed with `$`, while theme schema/docs allow plain variable references; unresolved var names could leak directly into HTML export CSS color values.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/theme/theme.ts`
- `packages/coding-agent/test/theme-export-colors.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- resolve export colors from plain variable names and legacy `$var` notation,
- support nested variable references and numeric palette variable conversion,
- add regression coverage for export variable resolution semantics.

**Result:** HTML export theme override colors now resolve variable references deterministically instead of emitting unresolved variable tokens.

---

### 276) coding-agent export theme `$missingVar` references leaked unresolved tokens

**Finding:** After adding export-color variable resolution support, legacy dollar-prefixed missing variables (for example `$missingVar`) could still pass through as unresolved literal strings instead of resolving to undefined.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/theme/theme.ts`
- `packages/coding-agent/test/theme-export-colors.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- return `undefined` for missing `$var` export references,
- preserve plain unresolved non-prefixed values as literals,
- add regression coverage for missing dollar-prefixed export-variable behavior.

**Result:** invalid `$missingVar` export references no longer leak unresolved tokens into generated export colors.

---

### 277) pods memory-option normalization contained redundant branch logic

**Finding:** `normalizeMemoryOption(...)` used a redundant integer/non-integer branch with identical outcomes (`String(value)` in both paths), obscuring normalization intent and leaving canonicalization behavior implicit.

**Action:** Updated:

- `packages/pods/src/model-options.ts`
- `packages/pods/test/model-options.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- simplify memory normalization to direct validated numeric-string conversion,
- explicitly regress-test canonical formatting of integer-equivalent decimal input (e.g. `50.0% -> 50%`).

**Result:** memory-option normalization behavior remains unchanged but is now explicit and simpler to maintain.

---

### 278) coding-agent export theme colors accepted malformed hex overrides

**Finding:** `getThemeExportColors(...)` could return malformed hex strings (for example `#ff00f-`) from direct export overrides or variable references, leaking invalid color values into generated HTML export CSS.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/theme/theme.ts`
- `packages/coding-agent/test/theme-export-colors.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- validate export hex strings as strict `#RRGGBB` values,
- return `undefined` for malformed direct or variable-resolved hex export colors,
- add regression coverage for malformed export hex fallback behavior.

**Result:** malformed export hex colors are now ignored safely instead of propagating invalid CSS color values.

---

### 279) pods process-identifier helpers accepted unsafe integer values

**Finding:** `packages/pods/src/process-identifiers.ts` validated pid/port values using `Number.isInteger(...)`, which could accept unsafe integers (`> Number.MAX_SAFE_INTEGER`) before range checks in helper call paths.

**Action:** Updated:

- `packages/pods/src/process-identifiers.ts`
- `packages/pods/test/process-identifiers.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require safe integers for pid/port validation helpers,
- reject oversized unsafe numeric values in pid/port helper assertions,
- add regression coverage for unsafe-integer pid/port rejection.

**Result:** pods pid/port validator helpers now reject unsafe integers deterministically before any command-assembly usage of process identifiers.

---

### 280) coding-agent export theme plain missing variable references still leaked unresolved tokens

**Finding:** export color resolution hardened `$missingVar` handling, but plain missing variable references (without `$`) could still pass unresolved token strings through to HTML export color values.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/theme/theme.ts`
- `packages/coding-agent/test/theme-export-colors.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- return `undefined` for both plain and `$` missing export variable references,
- isolate variable-resolution failures per export color override,
- add regression coverage for plain missing export-variable fallback.

**Result:** missing export variable references (plain or `$`-prefixed) now resolve safely to undefined rather than leaking unresolved token strings.

---

### 281) pods memory percentage parsing could accept precision-rounded values above 100

**Finding:** `packages/pods/src/model-options.ts` and `packages/pods/src/commands/models.ts` relied on `Number(...)` range checks for memory percentages; values like `100.0000000000000000001` could round down to `100` and be accepted incorrectly.

**Action:** Updated:

- `packages/pods/src/model-options.ts`
- `packages/pods/src/commands/models.ts`
- `packages/pods/test/model-options.test.ts`
- `packages/pods/test/models-ssh-status.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- centralize memory percentage parsing in `parseMemoryPercentage(...)`,
- enforce pre-conversion decimal range bounds using whole/fractional string checks,
- reject fractional overflow above `100` before floating-point conversion,
- reuse the hardened parser in both option normalization and model-start memory fraction resolution,
- add regression tests for precision-rounding overflow inputs.

**Result:** pods memory parsing now rejects precision-rounded overflow values deterministically instead of accepting them as `100%`.

---

### 282) tui overlay percentage parsing could accept precision-rounded values above 100%

**Finding:** `packages/tui/src/tui.ts` parsed overlay percentage values via float conversion after regex validation; precision-overflow values such as `100.0000000000000000001%` could round down to `100` and be accepted in width/position parsing.

**Action:** Updated:

- `packages/tui/src/tui.ts`
- `packages/tui/test/overlay-options.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- tighten percentage parsing to split whole/fractional components explicitly,
- reject values above `100` using pre-conversion BigInt + fractional digit checks,
- keep existing percentage behavior for valid values (`0%` through `100%`, including `100.0%`),
- add regression coverage for precision-overflow width and row percentage fallbacks.

**Result:** overlay percentage parsing now rejects precision-rounded overflow inputs deterministically, preserving fallback layout behavior for invalid values.

---

### 283) ai model-catalog script accepted non-decimal pricing strings and auto-ran on import

**Finding:** `packages/ai/scripts/generate-models.ts` parsed string pricing values with broad `Number(...)` coercion and executed `generateModels()` unconditionally at module load, allowing non-decimal string formats (`0x10`, `1e2`) and making safe test imports impossible without triggering network fetches.

**Action:** Updated:

- `packages/ai/scripts/generate-models.ts`
- `packages/ai/test/generate-models.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- export and harden `parseNonNegativeNumericValue(...)` to accept only decimal numeric strings,
- return safe `0` fallback for malformed/non-decimal pricing strings,
- guard script execution behind an entrypoint check so imports do not auto-run fetch/generation side effects,
- add regression tests for strict decimal parsing behavior.

**Result:** model-catalog pricing parsing now rejects non-decimal coercions, and the generator module can be imported in tests without unintentionally executing network/model generation side effects.

---

### 284) coding-agent bash tool accepted timeout values beyond Node timer range

**Finding:** `packages/coding-agent/src/core/tools/bash.ts` only validated timeout values as positive finite numbers; extremely large timeout seconds could overflow Node's timer range and be clamped into unintended runtime behavior.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/bash.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- enforce an upper bound aligned with Node's maximum timer delay (`2,147,483,647ms`),
- reject oversize timeout seconds before process execution starts,
- add regression coverage for oversized timeout rejection.

**Result:** coding-agent bash timeout parsing now rejects oversized timeout values deterministically instead of relying on implicit runtime timer clamping.

---

### 285) mom bash tool accepted timeout values beyond Node timer range

**Finding:** `packages/mom/src/tools/bash.ts` only validated timeout values as positive finite numbers; oversized timeout seconds could exceed Node timer bounds and lead to implicit runtime clamping behavior.

**Action:** Updated:

- `packages/mom/src/tools/bash.ts`
- `packages/mom/test/bash-tool.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- enforce Node timer upper-bound validation during timeout parsing,
- reject oversized timeout seconds before command execution,
- add regression coverage for oversized timeout rejection.

**Result:** mom bash timeout parsing now rejects oversized timeout values explicitly, preventing implicit timer clamping edge cases.

---

### 286) coding-agent shared exec timeout accepted oversized timer values

**Finding:** `packages/coding-agent/src/core/exec.ts` forwarded timeout milliseconds directly to `setTimeout(...)`; oversized values beyond Node timer limits could be runtime-clamped and trigger unintended premature process termination.

**Action:** Updated:

- `packages/coding-agent/src/core/exec.ts`
- `packages/coding-agent/test/exec.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize timeout values with explicit Node timer-range bounds,
- ignore oversized/invalid timeout values instead of forwarding them to runtime clamping behavior,
- add regression coverage proving oversized timeouts no longer force premature process kills.

**Result:** shared command execution now handles oversized timeout inputs safely and deterministically, avoiding runtime timer clamp side effects.

---

### 287) agent sub-process script timeout accepted oversized timer values

**Finding:** `packages/agent/src/sub-agent.ts` passed `timeoutMs` directly to `setTimeout(...)` in `spawnScript(...)`; oversized timeout values beyond Node timer bounds could be runtime-clamped and prematurely abort delegated scripts.

**Action:** Updated:

- `packages/agent/src/sub-agent.ts`
- `packages/agent/test/sub-agent.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- normalize script timeout values with explicit Node timer-range bounds,
- ignore oversized/invalid timeout values rather than forwarding runtime-clamped timers,
- add regression coverage proving oversized timeout inputs no longer cause unintended timeout rejection.

**Result:** `spawnScript(...)` now handles oversized timeout inputs predictably and avoids premature timer-clamped abort behavior.

---

### 288) mom sandbox executor timeout accepted oversized timer values

**Finding:** `packages/mom/src/sandbox.ts` forwarded `ExecOptions.timeout` directly to `setTimeout(...)`; oversized timeout values beyond Node timer limits could be runtime-clamped and prematurely terminate sandboxed commands.

**Action:** Updated:

- `packages/mom/src/sandbox.ts`
- `packages/mom/test/sandbox.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- normalize sandbox timeout seconds against Node timer-range bounds before scheduling timers,
- ignore oversized/invalid timeout values instead of forwarding runtime-clamped timers,
- add regression coverage proving oversized timeout inputs no longer force premature sandbox command termination.

**Result:** mom sandbox command execution now handles oversized timeout inputs safely and avoids runtime timer clamp side effects.

---

### 289) coding-agent shared sleep helper accepted oversized timer values

**Finding:** `packages/coding-agent/src/utils/sleep.ts` forwarded sleep durations directly to `setTimeout(...)`; oversized values beyond Node timer limits could be runtime-clamped and resolve far earlier than intended.

**Action:** Updated:

- `packages/coding-agent/src/utils/sleep.ts`
- `packages/coding-agent/test/sleep.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- clamp oversized sleep durations to Node timer bounds before scheduling timers,
- preserve abort semantics for oversized durations,
- add regression coverage proving oversized sleeps no longer resolve before abort.

**Result:** coding-agent shared sleep now handles oversized durations deterministically and avoids early-resolution timer clamp behavior.

---

### 290) ai shared abortable sleep helper accepted oversized timer values

**Finding:** `packages/ai/src/utils/abortable-sleep.ts` passed raw delay values to `setTimeout(...)`; oversized values beyond Node timer limits could be runtime-clamped and resolve much earlier than intended retry/polling delays.

**Action:** Updated:

- `packages/ai/src/utils/abortable-sleep.ts`
- `packages/ai/test/abortable-sleep.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- clamp oversized abortable sleep durations to Node timer bounds,
- preserve cancellation behavior for oversized delays,
- add regression coverage proving oversized delays remain pending until aborted.

**Result:** shared AI abortable sleep now avoids implicit timer-clamp early completion for oversized durations.

---

### 291) coding-agent RPC extension dialog timeout fallback accepted oversized timer values

**Finding:** `packages/coding-agent/src/modes/rpc/rpc-mode.ts` used extension-provided dialog timeout values directly in local fallback `setTimeout(...)`; oversized values beyond Node timer limits could be runtime-clamped and trigger unintended early dialog timeout settlement.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `packages/coding-agent/test/rpc-mode-timeout.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize/clamp RPC extension dialog timeout values to Node timer bounds before scheduling fallback timers,
- emit normalized timeout values in outgoing extension UI requests,
- add regression tests covering undefined/invalid/valid/oversized timeout normalization behavior.

**Result:** RPC extension dialog timeout fallbacks now avoid premature timer-clamped settlement for oversized timeout inputs.

---

### 292) coding-agent RPC client wait helpers accepted oversized timer values

**Finding:** `packages/coding-agent/src/modes/rpc/rpc-client.ts` used caller-provided wait timeout values directly in `waitForIdle(...)` / `collectEvents(...)`; oversized values beyond Node timer bounds could be runtime-clamped and trigger premature timeout rejections.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `packages/coding-agent/test/rpc-client-timeout.test.ts` (new)
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize/clamp RPC client wait timeout values to Node timer bounds before scheduling timers,
- add regression tests covering in-range and oversized timeout normalization behavior.

**Result:** RPC client wait-timeout helpers now avoid early timer-clamped timeout failures for oversized timeout inputs.

---

### 293) mom one-shot event scheduler accepted invalid/oversized timer inputs

**Finding:** `packages/mom/src/events.ts` scheduled one-shot events with direct `setTimeout(delay)` from parsed timestamps; invalid timestamps (`NaN`) or delays above Node timer limits could be runtime-clamped and execute immediately instead of waiting/deleting safely.

**Action:** Updated:

- `packages/mom/src/events.ts`
- `packages/mom/test/events-scheduling.test.ts` (new)
- `packages/mom/CHANGELOG.md`

to:

- validate one-shot timestamp parsing before scheduling,
- normalize one-shot delays and chunk scheduling when delay exceeds Node timer bounds,
- add regression tests for timestamp parsing and delay normalization edge cases.

**Result:** one-shot events now avoid immediate execution from malformed timestamps or oversized delays and schedule safely across Node timer limits.

---

### 294) tui stdin buffering accepted invalid/oversized timeout options

**Finding:** `packages/tui/src/stdin-buffer.ts` accepted `StdinBufferOptions.timeout` as-is and forwarded it directly to `setTimeout(...)`; non-positive/invalid values could force immediate flushes, and oversized values could be runtime-clamped into unintended near-immediate flush behavior.

**Action:** Updated:

- `packages/tui/src/stdin-buffer.ts`
- `packages/tui/test/stdin-buffer.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- normalize buffer timeout options with positive/finite validation and default fallback behavior,
- clamp oversized timeout values to Node timer bounds before scheduling flush timers,
- add regression coverage ensuring oversized timeout inputs do not flush buffered escape sequences early.

**Result:** stdin buffering now handles malformed/oversized timeout options deterministically without relying on implicit Node timer clamping semantics.

---

### 295) pods GPU CSV parser could mis-split memory values with thousands separators

**Finding:** `packages/pods/src/commands/pods.ts` parsed `nvidia-smi` CSV lines by splitting on commas and treating the last segment as memory; memory values formatted with thousands separators (for example `80,000 MiB`) were split into name/memory fragments and persisted incorrectly.

**Action:** Updated:

- `packages/pods/src/commands/pods.ts`
- `packages/pods/test/pods-gpu-output.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- parse GPU id from the first CSV field deterministically,
- parse trailing memory-with-units patterns (including grouped thousands separators) before fallback splitting,
- preserve GPU names containing commas while correctly preserving memory fields like `80,000 MiB`,
- add regression coverage for memory-thousands-separator parsing.

**Result:** pod setup GPU detection now handles comma-formatted memory values without corrupting GPU name/memory fields.

---

### 296) coding-agent RPC wait timeout helper accepted invalid non-positive timeout inputs

**Finding:** `packages/coding-agent/src/modes/rpc/rpc-client.ts` normalized only oversized timeout values in `normalizeRpcTimeoutMs(...)`; invalid `0`/negative/`NaN` timeout inputs were forwarded to `setTimeout(...)` coercion, causing unintended immediate timeout failures in `waitForIdle(...)`/`collectEvents(...)`.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `packages/coding-agent/test/rpc-client-timeout.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize non-positive/`NaN` timeout values to default RPC wait timeout behavior,
- preserve existing oversized-timeout clamping to Node timer bounds,
- keep optional custom fallback support for timeout normalization callers,
- add regression coverage for invalid-timeout fallback behavior.

**Result:** RPC wait helpers now avoid accidental immediate timeout failures from invalid timeout inputs while preserving max-range timeout clamping.

---

### 297) tui terminal drain-input timing accepted invalid/oversized timeout inputs

**Finding:** `packages/tui/src/terminal.ts` used raw `drainInput(maxMs, idleMs)` values directly in timer arithmetic and sleep scheduling; invalid/non-positive/oversized values could produce immediate loop exits or rely on implicit timer clamping behavior.

**Action:** Updated:

- `packages/tui/src/terminal.ts`
- `packages/tui/test/terminal-timeouts.test.ts` (new)
- `packages/tui/CHANGELOG.md`

to:

- normalize `drainInput(...)` timing inputs to positive finite defaults,
- clamp oversized values to Node timer bounds,
- bound idle drain duration to the normalized max drain window,
- add focused regression coverage for invalid, in-range, and oversized timing normalization.

**Result:** terminal input drain timing now behaves deterministically for malformed/oversized timeout arguments without relying on runtime timer coercion/clamping.

---

### 298) coding-agent comma-list CLI parsing accepted blank model/tool entries

**Finding:** `packages/coding-agent/src/cli/args.ts` parsed `--models` / `--tools` by naive comma-split/trim; blank entries (`--models ",,"`, `--tools "read,,bash"`) were preserved, enabling unintended empty model patterns and noisy unknown-tool warnings for empty tokens.

**Action:** Updated:

- `packages/coding-agent/src/cli/args.ts`
- `packages/coding-agent/test/args.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize comma-separated values by trimming and removing blank entries,
- warn when `--models` resolves to no non-empty patterns,
- keep valid model/tool entries while skipping empty tokens,
- add regression coverage for blank-entry filtering and empty-`--models` warning behavior.

**Result:** comma-list CLI flags now parse deterministically without empty-token side effects in model scoping or tool warnings.

---

### 299) ai Azure deployment-name map parser accepted whitespace-only keys/values

**Finding:** `packages/ai/src/providers/azure-openai-responses.ts` parsed `AZURE_OPENAI_DEPLOYMENT_NAME_MAP` entries by validating raw split segments before trim; mappings like `" =deployment"` / `"model= "` could pass initial checks and create empty-key or empty-value entries after trimming.

**Action:** Updated:

- `packages/ai/src/providers/azure-openai-responses.ts`
- `packages/ai/test/azure-openai-responses-deployment-map.test.ts` (new)
- `packages/ai/test/azure-utils.ts`
- `packages/ai/CHANGELOG.md`

to:

- trim deployment-map model/deployment segments before validation,
- skip entries with blank trimmed model IDs or deployment names,
- keep test helper parsing behavior aligned with runtime provider parsing,
- add regression coverage for valid mappings and whitespace-only entry rejection.

**Result:** Azure deployment mapping now ignores whitespace-only key/value entries instead of persisting empty-string map entries from malformed environment configuration.

---

### 300) coding-agent extension countdown dialogs accepted invalid/oversized timeout inputs

**Finding:** `packages/coding-agent/src/modes/interactive/components/extension-input.ts` and `extension-selector.ts` passed extension-provided timeout values directly into `CountdownTimer`; malformed timeout values (`0`, negative, `NaN`, oversized) could create non-expiring countdown behavior or rely on implicit timer coercion/clamping.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/components/countdown-timer.ts`
- `packages/coding-agent/src/modes/interactive/components/extension-input.ts`
- `packages/coding-agent/src/modes/interactive/components/extension-selector.ts`
- `packages/coding-agent/test/countdown-timer.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize extension countdown timeout values before timer creation,
- reject invalid/non-positive/non-finite values and clamp oversized values to Node timer bounds,
- only initialize countdown UI timers when normalized timeout input is valid,
- add regression coverage for invalid, in-range, and oversized timeout normalization behavior.

**Result:** extension dialog countdown timers now behave deterministically for malformed/oversized timeout inputs without relying on runtime timer coercion.

---

### 301) coding-agent `--tools` comma-list parsing still accepted blank-only values

**Finding:** after initial comma-list hardening, `packages/coding-agent/src/cli/args.ts` still allowed `--tools ",,"` to resolve to an empty tool array without an explicit warning, which could silently disable built-in tools from malformed CLI input.

**Action:** Updated:

- `packages/coding-agent/src/cli/args.ts`
- `packages/coding-agent/test/args.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- warn when `--tools` resolves to no non-empty tool names,
- skip applying tool overrides for blank-only `--tools` values,
- add regression coverage for blank-only tool-list warning behavior.

**Result:** malformed blank-only `--tools` inputs now produce explicit warnings and no longer silently alter tool activation behavior.

---

### 302) coding-agent RPC dialog timeout normalization treated `Infinity` as disabled timeout

**Finding:** `packages/coding-agent/src/modes/rpc/rpc-mode.ts` normalized dialog timeout values by rejecting all non-finite numbers; a positive-infinite timeout would be treated as `undefined` (disabled timeout) instead of being bounded like other oversized timeout inputs.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `packages/coding-agent/test/rpc-mode-timeout.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- treat `NaN` and non-positive values as invalid,
- clamp positive-infinite and other oversized values to Node timer bounds,
- add explicit regression coverage for `Infinity` timeout normalization behavior.

**Result:** RPC dialog timeout normalization now consistently bounds oversized values (including `Infinity`) instead of accidentally disabling timeout enforcement.

---

### 303) coding-agent interactive countdown timeout normalization treated `Infinity` as disabled timeout

**Finding:** `packages/coding-agent/src/modes/interactive/components/countdown-timer.ts` originally rejected all non-finite values; this caused positive-infinite extension timeout values to normalize to `undefined` (no countdown timer) instead of being bounded like other oversized timeout inputs.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/components/countdown-timer.ts`
- `packages/coding-agent/test/countdown-timer.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- reject only `NaN` and non-positive timeout values,
- clamp positive-infinite and other oversized timeout inputs to Node timer bounds,
- add explicit regression coverage for `Infinity` countdown timeout normalization.

**Result:** interactive extension countdown timers now keep timeout enforcement for `Infinity` inputs by clamping them instead of disabling the timer path.

## Validation Evidence

- Root quality gate passes:
  - `npm run check`
- ai CLI selection parser regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/cli-selection.test.ts`
- ai model-generator numeric parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/generate-models.test.ts`
- ai Azure deployment-map parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/azure-openai-responses-deployment-map.test.ts`
- mom slack timestamp normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/slack-timestamp.test.ts`
- web-ui model discovery + archive-index numeric parsing regression tests pass:
  - `cd packages/web-ui && npx tsx --test test/model-discovery.test.ts test/archive-index.test.ts`
- tui kitty CSI-u + overlay percentage parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test -- test/editor-kitty-csiu.test.ts`
  - `cd packages/tui && node --test --import tsx test/overlay-options.test.ts`
- tui overlay precision-overflow percentage regression tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test -- test/overlay-options.test.ts`
- tui key parser Kitty unsafe-integer regression tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test -- test/keys.test.ts`
- tui ANSI wrap style-tracker regression tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test -- test/wrap-ansi.test.ts`
- tui cell-size response parsing regression tests pass:
  - `cd packages/tui && node --test --import tsx test/tui-cell-size-response.test.ts`
- tui stdin-buffer timeout normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test -- test/stdin-buffer.test.ts`
- tui terminal drain-input timeout normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test -- test/terminal-timeouts.test.ts`
- coding-agent changelog/export-color parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/changelog-utils.test.ts test/export-html-color-parsing.test.ts`
- coding-agent CLI comma-list parsing regression tests pass (including blank-only `--models`/`--tools` warning behavior):
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/args.test.ts`
- coding-agent tool numeric-parameter safety regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/execution-plan.test.ts test/read-tool.test.ts test/tool-numeric-parameter-safety.test.ts`
- coding-agent settings-selector numeric parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/settings-selector.test.ts`
- coding-agent theme hex validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-hex-validation.test.ts test/theme-colorfgbg.test.ts`
- coding-agent COLORFGBG range regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-colorfgbg.test.ts`
- coding-agent export theme color resolution regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-export-colors.test.ts test/theme-hex-validation.test.ts test/theme-colorfgbg.test.ts`
- coding-agent export missing `$var` regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-export-colors.test.ts`
- coding-agent export malformed hex-color regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-export-colors.test.ts`
- coding-agent export plain missing-variable regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-export-colors.test.ts`
- ai usage metadata regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-gemini-cli-usage-metadata.test.ts`
- ai Gemini retry-delay (including safe-millisecond bounds) regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-gemini-cli-retry-delay.test.ts`
- ai usage safe-integer parser regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-responses-shared-usage.test.ts test/amazon-bedrock-usage.test.ts test/google-usage-metadata.test.ts test/google-gemini-cli-usage-metadata.test.ts test/openai-completions-tool-choice.test.ts test/github-copilot-anthropic.test.ts`
- ai shared usage parser regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-usage-metadata.test.ts test/amazon-bedrock-usage.test.ts test/openai-responses-shared-usage.test.ts`
- ai OpenAI/Anthropic usage parser regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-completions-tool-choice.test.ts test/github-copilot-anthropic.test.ts`
- mom model/key resolution regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/agent-model.test.ts`
- pods required-option parser regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/cli-options.test.ts test/cli-args.test.ts`
- pods model-option parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/model-options.test.ts`
- pods memory normalization canonical-format regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/model-options.test.ts`
- pods memory precision-overflow regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/model-options.test.ts test/models-ssh-status.test.ts`
- pods process-identifier safe-integer regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/process-identifiers.test.ts`
- pods GPU CSV parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/pods-gpu-output.test.ts`
- pods required-option smoke checks pass:
  - `npx tsx packages/pods/src/cli.ts start demo-model --name demo --memory`
  - `npx tsx packages/pods/src/cli.ts pods setup demo "ssh host" --vllm`
- pods `start --vllm` arg-requirement smoke check passes:
  - `npx tsx packages/pods/src/cli.ts start demo-model --name demo --vllm`
- coding-agent CLI args regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/args.test.ts`
- coding-agent read-tool line-count regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/read-tool.test.ts`
- coding-agent read-tool range validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/read-tool.test.ts test/tools.test.ts`
- coding-agent grep range validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts`
- coding-agent bash timeout validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts`
- coding-agent bash oversized-timeout regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts`
- coding-agent shared exec oversized-timeout regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/exec.test.ts`
- coding-agent shared sleep oversized-timeout regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/sleep.test.ts`
- coding-agent RPC dialog timeout normalization tests pass (including positive-infinite timeout clamping):
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/rpc-mode-timeout.test.ts`
- coding-agent RPC client timeout normalization tests pass (including invalid non-positive fallback behavior):
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/rpc-client-timeout.test.ts`
- agent spawnScript oversized-timeout regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/sub-agent.test.ts`
- ai abortable sleep oversized-timeout regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/abortable-sleep.test.ts`
- coding-agent find limit validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts`
- coding-agent ls limit validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts`
- coding-agent execution-plan task-index validation tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/execution-plan.test.ts test/tools.test.ts`
- mom CLI args/model regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/cli-args.test.ts test/agent-model.test.ts`
- mom CLI args parser regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/cli-args.test.ts`
- mom bash oversized-timeout regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/bash-tool.test.ts`
- mom sandbox oversized-timeout regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/sandbox.test.ts`
- mom one-shot scheduling helper tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/events-scheduling.test.ts`
- mom read-tool line-count regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/read-tool.test.ts`
- mom bash timeout validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/bash-tool.test.ts`
- agent project-runner args regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/project-runner.test.ts`
- agent runner args regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/runner.test.ts`
- mom sandbox regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/sandbox.test.ts`
- pods SSH/SCP parser regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/ssh-parse.test.ts`
- AI package tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test`
- agent spawnScript regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/sub-agent.test.ts` (includes signal-exit non-zero semantics and forced-kill fallback for SIGTERM-resistant children)
- coding-agent RPC startup/shutdown regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/rpc-client.test.ts` (includes startup failures, pending-request rejection on stop and unexpected exit, stop timeout forced-kill cleanup, send timeout/write-error cleanup, closed-stdin send handling, and exit-listener cleanup assertions)
- coding-agent login dialog browser-invocation regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/login-dialog-url-open.test.ts` (includes macOS/Windows/Linux command invocation mapping)
- coding-agent login dialog lifecycle regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/login-dialog.test.ts test/login-dialog-url-open.test.ts` (includes single-settlement cancel behavior and prompt-replacement rejection coverage)
- coding-agent piped-stdin helper regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/read-piped-stdin.test.ts` (includes TTY short-circuit, trimmed piped content, stdin error rejection, and close-before-end settlement coverage)
- coding-agent prompt-confirm/read-piped-stdin helper regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/prompt-confirm.test.ts test/read-piped-stdin.test.ts` (includes yes/no parsing, early stdin-close settlement, pre-closed prompt handling, and pre-ended piped-stdin coverage)
- coding-agent gh auth-status classification regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/gh-auth-status.test.ts` (includes missing gh spawn failure, signal interruption, non-zero auth status, and success cases)
- coding-agent countdown timer regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/countdown-timer.test.ts` (includes normal expiry, manual dispose stop, onTick-throw safety coverage, and timeout normalization coverage including positive-infinite clamping)
- coding-agent extension dialog callback regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/extension-dialog-callbacks.test.ts` (includes throwing selector/input/editor callback safety and post-dispose callback suppression across selector/input/editor dialogs)
- coding-agent session selector disposal regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/session-selector-path-delete.test.ts test/extension-dialog-callbacks.test.ts` (includes stale-load suppression after selector dispose)
- coding-agent selector auto-cancel disposal regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/selector-autocancel-dispose.test.ts test/tree-selector.test.ts` (includes tree/user-message empty-state auto-cancel suppression after dispose and callback-exception isolation)
- coding-agent interactive container-disposal regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/interactive-mode-container-dispose.test.ts` (verifies disposable children are disposed before container clear and during selector swaps)
- coding-agent antigravity image SSE parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/antigravity-image-gen.test.ts` (includes terminal `data:` chunk without trailing newline and text+image ordering coverage)
- coding-agent sleep helper regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/sleep.test.ts` (includes listener cleanup on resolve + abort paths)
- ai abortable sleep + retry stream regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/abortable-sleep.test.ts test/google-gemini-cli-retry-delay.test.ts test/openai-codex-stream.test.ts`
- ai shared event-stream lifecycle regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/event-stream.test.ts test/openai-codex-stream.test.ts test/google-gemini-cli-empty-stream.test.ts` (includes incomplete-end rejection and stream consumer compatibility coverage)
- ai readline prompt lifecycle regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/readline-prompt.test.ts` (includes close-fallback settlement, answered-value stability, and already-closed interface fallback)
- ai copilot/oauth-related regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/abortable-sleep.test.ts test/github-copilot-anthropic.test.ts`
- ai oauth cancellation regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/anthropic-oauth-abort.test.ts test/openai-codex-oauth-abort.test.ts test/google-antigravity-oauth-abort.test.ts test/google-gemini-cli-oauth-abort.test.ts`
- ai oauth callback waiter regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-codex-oauth-abort.test.ts test/google-gemini-cli-oauth-abort.test.ts test/google-antigravity-oauth-abort.test.ts`
- ai google oauth hash-fragment parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-gemini-cli-oauth-abort.test.ts test/google-antigravity-oauth-abort.test.ts`
- ai google oauth url-only manual-input contract regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-gemini-cli-oauth-abort.test.ts test/google-antigravity-oauth-abort.test.ts`
- ai shared oauth authorization-input utility regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/oauth-authorization-input.test.ts`
- ai anthropic oauth parsing/state-validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/anthropic-oauth-abort.test.ts`
- ai openai-codex oauth startup/manual-flow/cancellation/base64url-decoding/hash-fragment parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-codex-oauth-abort.test.ts`
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes pre-aborted write coverage)
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes pre-aborted read + write coverage)
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes pre-aborted read + write + edit coverage)
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes signal-terminated bash command coverage)
- pods process-exit regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/process-exit.test.ts` (includes signal-exit non-zero assertion and already-exited immediate-settlement coverage)
- coding-agent bash executor regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/bash-executor.test.ts` (includes signal/null exit non-zero semantics and shell spawn-startup failure coverage)
- agent proxy stream regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/proxy.test.ts` (includes trailing SSE line without newline)
- ai Gemini CLI SSE regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-gemini-cli-empty-stream.test.ts` (includes terminal `data:` line without trailing newline)
- ai Codex/Gemini SSE regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-codex-stream.test.ts test/google-gemini-cli-empty-stream.test.ts`
- coding-agent exec regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/exec.test.ts` (includes signal-terminated subprocess failure semantics and forced-kill fallback for SIGTERM-resistant processes)
- coding-agent execCommand regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/exec.test.ts`
- web-ui package checks pass:
  - `cd packages/web-ui && npm run check`
- coding-agent interactive status tests pass after share flow command-exec refactor:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/exec.test.ts test/interactive-mode-status.test.ts`
- pods process-exit helper regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/process-exit.test.ts`
- pods interactive shell spawn-error regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/process-exit.test.ts test/cli-shell.test.ts` (includes SSH spawn failure, signal-exit non-zero semantics, and propagated non-zero SSH exit-code coverage)
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
- pods SSH single-settlement spawn-error regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/ssh-parse.test.ts`
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes pre-aborted bash + grep startup-abort race coverage)
- mom sandbox signal-exit regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/sandbox.test.ts` (includes signal-terminated host command case)
- coding-agent tools regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts` (includes bash/grep/find/ls cancellation coverage, grep late-abort during post-process formatting, bash null-exit normalization coverage for custom executors, and find signal-exit rejection coverage)
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
- coding-agent package-manager command-settlement regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/package-manager.test.ts` (includes async settlement coverage, full async command-invocation diagnostics, sync spawn-start failure diagnostics, and signal-exit rejection diagnostics)
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
  - `npm --workspace "@mariozechner/pi" test -- test/prompt-model-validation.test.ts` (includes invalid ssh/port guards and delegated-cli spawn startup failure diagnostics)
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
