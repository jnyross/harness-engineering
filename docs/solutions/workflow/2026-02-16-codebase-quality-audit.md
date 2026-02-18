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

---

### 304) tui stdin-buffer timeout normalization treated `Infinity` as default short timeout

**Finding:** `packages/tui/src/stdin-buffer.ts` normalized buffer timeout values by rejecting all non-finite numbers; positive-infinite timeout values were treated as invalid and fell back to the default short timeout, which could prematurely flush partial escape-sequence buffers.

**Action:** Updated:

- `packages/tui/src/stdin-buffer.ts`
- `packages/tui/test/stdin-buffer.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- reject only `NaN` and non-positive timeout inputs,
- clamp positive-infinite and other oversized timeout values to Node timer bounds,
- add regression coverage for positive-infinite timeout normalization behavior.

**Result:** stdin buffering now keeps long-timeout semantics for oversized/`Infinity` inputs by clamping instead of silently falling back to an immediate/default flush window.

---

### 305) tui `drainInput()` timeout normalization treated `Infinity` as fallback defaults

**Finding:** `packages/tui/src/terminal.ts` normalized `drainInput(maxMs, idleMs)` durations by rejecting all non-finite values; positive-infinite values were treated as invalid and fell back to default short drain windows instead of being bounded as oversized inputs.

**Action:** Updated:

- `packages/tui/src/terminal.ts`
- `packages/tui/test/terminal-timeouts.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- reject only `NaN` and non-positive durations,
- clamp positive-infinite and other oversized durations to Node timer bounds,
- add regression coverage for positive-infinite `drainInput()` duration normalization.

**Result:** `drainInput()` now preserves long drain semantics for `Infinity`/oversized inputs by clamping, rather than unexpectedly reverting to short default timing windows.

---

### 306) mom one-shot delay normalization treated `Infinity` as invalid instead of oversized

**Finding:** `packages/mom/src/events.ts` normalized one-shot delay values by rejecting all non-finite numbers; positive-infinite delays were treated as invalid (`undefined`) instead of being bounded/chunked like other oversized delay values.

**Action:** Updated:

- `packages/mom/src/events.ts`
- `packages/mom/test/events-scheduling.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- reject only `NaN` and non-positive delay values,
- clamp positive-infinite and other oversized delays to Node timer bounds with `needsReschedule=true`,
- add regression coverage for positive-infinite one-shot delay normalization behavior.

**Result:** one-shot scheduling now treats `Infinity` delays as oversized (chunked safely) instead of invalid, preserving deterministic long-delay behavior.

---

### 307) coding-agent retry settings accepted malformed delay/count values from settings files

**Finding:** `packages/coding-agent/src/core/settings-manager.ts` returned retry settings (`maxRetries`, `baseDelayMs`, `maxDelayMs`) directly from parsed settings without numeric normalization; malformed values (negative, `NaN`, oversized) could propagate into retry scheduling behavior and disable/short-circuit expected backoff semantics.

**Action:** Updated:

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/settings-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize retry count values to non-negative safe integers with defaults,
- normalize retry delays to positive safe integers with defaults and Node timer-bound clamping for oversized values (including `Infinity`),
- add regression coverage for invalid fallback behavior and oversized delay clamping behavior.

**Result:** retry scheduling now uses deterministic, bounded numeric settings even when settings files contain malformed retry values.

---

### 308) coding-agent editor layout settings accepted malformed numeric values from settings files

**Finding:** `packages/coding-agent/src/core/settings-manager.ts` returned `editorPaddingX` / `autocompleteMaxVisible` directly from settings files; malformed/non-finite or out-of-range manual edits could propagate invalid layout values into interactive rendering.

**Action:** Updated:

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/settings-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize `editorPaddingX` and `autocompleteMaxVisible` values from settings reads,
- clamp in-range numeric values to supported bounds (`0-3` and `3-20` respectively),
- fall back to defaults for malformed/non-finite values,
- add regression coverage for oversized, decimal/negative, and malformed value cases.

**Result:** interactive editor layout settings now remain deterministic and within supported bounds even with malformed manual settings-file edits.

---

### 309) coding-agent token-budget settings accepted malformed values from settings files

**Finding:** `packages/coding-agent/src/core/settings-manager.ts` returned `compaction.reserveTokens`, `compaction.keepRecentTokens`, and `branchSummary.reserveTokens` directly from settings files; malformed/non-positive values could propagate into compaction token-budget logic.

**Action:** Updated:

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/settings-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize token-budget settings to positive safe integers with defaults,
- reject malformed/non-positive values from settings reads by falling back to established defaults,
- add regression coverage for invalid fallback behavior and valid-value preservation.

**Result:** compaction/branch-summary token budgets now remain safe and deterministic even when settings files contain malformed numeric values.

---

### 310) coding-agent thinking-budget settings accepted malformed values from settings files

**Finding:** `packages/coding-agent/src/core/settings-manager.ts` forwarded `thinkingBudgets` settings entries directly from parsed settings files; malformed values (`NaN`, negative, non-safe integers, `Infinity`) could propagate into provider thinking-budget overrides.

**Action:** Updated:

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/settings-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize thinking-budget entries to non-negative safe integers,
- discard malformed thinking-budget entries from settings reads,
- fall back to provider defaults when all configured thinking-budget entries are invalid,
- add regression coverage for malformed-entry dropping and valid-entry preservation.

**Result:** thinking-budget overrides from settings files are now deterministic and bounded, preventing malformed numeric values from altering provider thinking-budget behavior.

---

### 311) coding-agent editor layout setting mutators accepted malformed non-finite values

**Finding:** `packages/coding-agent/src/core/settings-manager.ts` setter methods `setEditorPaddingX(...)` / `setAutocompleteMaxVisible(...)` used direct `Math.floor(...)` clamping; passing malformed non-finite values (`NaN`) could store invalid numeric state via mutator calls.

**Action:** Updated:

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/settings-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- reuse normalized editor layout helpers in mutator paths,
- normalize malformed non-finite mutator inputs to established defaults before persistence,
- add regression coverage for setter-path malformed numeric input handling.

**Result:** editor layout setters now apply the same deterministic numeric normalization as settings-file reads, preventing malformed non-finite values from persisting through runtime mutator calls.

---

### 312) coding-agent boolean settings reads accepted malformed non-boolean values

**Finding:** `packages/coding-agent/src/core/settings-manager.ts` boolean getters relied on nullish defaults without runtime type checks; malformed settings-file values (for example `"false"` string, numeric `0/1`) could bypass defaults via truthy/falsy coercion and alter toggle semantics unexpectedly.

**Action:** Updated:

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/settings-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize boolean settings reads via explicit runtime type checks,
- apply defaults when values are present but non-boolean,
- preserve valid boolean settings values unchanged,
- add regression coverage for malformed-value fallback and valid-value preservation across compaction/retry/display/image/editor toggles.

**Result:** malformed non-boolean toggle values from settings files now safely fall back to defaults instead of changing runtime behavior through implicit truthy/falsy coercion.

---

### 313) coding-agent enum settings reads accepted malformed values from settings files

**Finding:** `packages/coding-agent/src/core/settings-manager.ts` enum-oriented getters (`defaultThinkingLevel`, steering/follow-up mode, transport, double-escape action) returned parsed values directly; malformed settings-file strings could propagate unsupported enum values into runtime behavior.

**Action:** Updated:

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/settings-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize enum settings reads through explicit allowed-value checks,
- fall back to established defaults/`undefined` for malformed enum values,
- preserve valid enum settings values unchanged,
- add regression coverage for malformed fallback and valid-value preservation paths.

**Result:** malformed enum values from settings files no longer propagate into runtime mode/transport/thinking/action selection paths.

---

### 314) coding-agent string/list settings reads accepted malformed runtime types from settings files

**Finding:** `packages/coding-agent/src/core/settings-manager.ts` string/list getters (`defaultProvider`, `defaultModel`, `theme`, shell path/prefix, extension/skill/prompt/theme paths, enabled model patterns, package source arrays) returned parsed values directly; malformed settings-file types (numbers/objects/non-array tokens) could propagate incompatible runtime values into startup/session/resource-loading flows.

**Action:** Updated:

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/settings-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize optional string settings to trimmed non-empty strings,
- normalize list settings to trimmed string arrays (dropping malformed entries),
- normalize package-source arrays to valid string/object package-source entries only (including filtered nested list fields),
- add regression coverage for malformed fallback behavior and valid-value preservation.

**Result:** malformed string/list settings-file entries now sanitize to safe runtime values instead of forwarding incompatible types into coding-agent startup/runtime selection paths.

---

### 315) coding-agent keybindings config loading accepted malformed JSON/value shapes

**Finding:** `packages/coding-agent/src/core/keybindings.ts` loaded keybindings JSON without structural/value normalization; malformed root/value types (non-object roots, non-string key entries, unknown actions) could be forwarded into runtime keybinding maps and editor keybinding initialization.

**Action:** Updated:

- `packages/coding-agent/src/core/keybindings.ts`
- `packages/coding-agent/test/keybindings.test.ts` (new)
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize keybindings config root shape before use,
- normalize keybinding values to trimmed `KeyId` lists while preserving explicit empty arrays for intentional unbinds,
- ignore malformed entries and unknown actions while keeping valid overrides,
- add regression coverage for malformed root/value handling and valid override preservation.

**Result:** malformed keybindings JSON now fails safely (with defaults/valid subset preserved) instead of propagating incompatible runtime keybinding values.

---

### 316) coding-agent markdown settings read accepted malformed non-string indent values

**Finding:** `packages/coding-agent/src/core/settings-manager.ts` returned `markdown.codeBlockIndent` directly from parsed settings; malformed non-string values could propagate into interactive markdown formatting settings.

**Action:** Updated:

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/settings-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize `markdown.codeBlockIndent` to string-only values,
- fall back to default indentation when settings-file values are malformed non-strings,
- add regression coverage for malformed fallback and valid string preservation.

**Result:** markdown code-block indentation settings now remain deterministic for malformed settings-file edits instead of forwarding incompatible runtime values.

---

### 317) pods config loading accepted malformed persisted JSON shapes

**Finding:** `packages/pods/src/config.ts` returned parsed `pods.json` data directly; malformed root/object shapes and invalid pod/model/GPU entries could propagate incompatible runtime values into active-pod selection and downstream command flows.

**Action:** Updated:

- `packages/pods/src/config.ts`
- `packages/pods/test/config.test.ts` (new)
- `packages/pods/CHANGELOG.md`

to:

- normalize parsed config root/pods/active fields before runtime use,
- normalize pod/model/GPU entries to validated shapes (dropping malformed entries),
- only preserve `active` when it points to a normalized existing pod,
- add regression coverage for invalid root handling, entry normalization, and invalid-active fallback behavior.

**Result:** malformed persisted pods configuration now fails safely with normalized subsets/defaults instead of forwarding incompatible runtime config values.

---

### 318) mom channel-store last-timestamp lookup accepted malformed timestamp payloads

**Finding:** `packages/mom/src/store.ts` parsed the last `log.jsonl` entry and returned `message.ts` via a broad cast; malformed last-line payloads (missing/non-string/blank `ts`) could leak invalid timestamp values instead of safely returning no timestamp.

**Action:** Updated:

- `packages/mom/src/store.ts`
- `packages/mom/test/store.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- parse/validate last-line timestamp payloads as non-empty strings,
- return `null` for malformed last-line timestamp shapes,
- add regression coverage for non-string/blank timestamp payload behavior.

**Result:** channel-store last-timestamp reads now fail safely on malformed log entries instead of forwarding invalid timestamp values.

---

### 319) pods built-in model-config loading accepted malformed `models.json` entry shapes

**Finding:** `packages/pods/src/model-configs.ts` parsed `models.json` directly and assumed schema shape at runtime; malformed model/config entry types could propagate incompatible launch-config values into model selection logic.

**Action:** Updated:

- `packages/pods/src/model-configs.ts`
- `packages/pods/test/model-configs.test.ts` (new)
- `packages/pods/CHANGELOG.md`

to:

- normalize parsed models data to validated model/config records,
- drop malformed model/config entries (including malformed args/env/gpuTypes),
- safely return an empty model map for malformed JSON/root shapes,
- add regression coverage for malformed JSON handling and normalized-entry preservation behavior.

**Result:** built-in model configuration loading now fails safely on malformed `models.json` content instead of propagating incompatible runtime launch-config values.

---

### 320) mom settings loading accepted malformed value types/ranges from settings.json

**Finding:** `packages/mom/src/context.ts` `MomSettingsManager` loaded settings JSON without runtime normalization; malformed value types/ranges (provider/model strings, thinking level, compaction/retry fields) could propagate incompatible runtime settings behavior.

**Action:** Updated:

- `packages/mom/src/context.ts`
- `packages/mom/test/context-settings.test.ts` (new)
- `packages/mom/CHANGELOG.md`

to:

- normalize settings-file values for provider/model/thinking-level fields,
- normalize compaction/retry settings to valid booleans and positive safe integers with defaults fallback for malformed values,
- normalize invalid thinking-level setter inputs to safe default (`off`),
- add regression coverage for malformed fallback and valid-value preservation.

**Result:** mom settings now load deterministically from malformed settings-file edits instead of forwarding incompatible values into runtime compaction/retry/model preference behavior.

---

### 321) mom log-to-session sync accepted malformed log-line timestamp payloads and could coerce epoch timestamps

**Finding:** `packages/mom/src/context.ts` sync logic parsed log lines with broad casts and computed message times via `new Date(date).getTime() || Date.now()`, which allowed malformed timestamp payloads and could coerce valid epoch timestamp `0` to current time.

**Action:** Updated:

- `packages/mom/src/context.ts`
- `packages/mom/test/context-sync.test.ts` (new)
- `packages/mom/CHANGELOG.md`

to:

- parse/validate sync log-line timestamp shapes before use,
- skip malformed timestamp payloads safely,
- preserve valid epoch timestamp `0` values,
- keep malformed date fallback behavior deterministic (`Date.now()`),
- add regression coverage for malformed timestamp skipping, malformed-date fallback, and epoch preservation.

**Result:** log-to-session sync now handles malformed timestamp payloads safely and preserves valid epoch timestamps instead of coercing them to current time.

---

### 322) coding-agent auth storage reload accepted malformed credential entry shapes

**Finding:** `packages/coding-agent/src/core/auth-storage.ts` loaded parsed `auth.json` data directly; malformed root/credential entry shapes could propagate incompatible runtime credential objects into auth lookup/refresh code paths.

**Action:** Updated:

- `packages/coding-agent/src/core/auth-storage.ts`
- `packages/coding-agent/test/auth-storage.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize parsed auth-storage root shape to object records only,
- normalize credential entries to valid api-key/oauth shapes and ignore malformed entries,
- trim non-empty credential token/key strings during normalization,
- add regression coverage for malformed-entry filtering and malformed-root fallback behavior.

**Result:** auth storage reload now fails safely on malformed `auth.json` content and only preserves valid credential entries for runtime auth lookup.

---

### 323) pods known-model listing path still parsed raw `models.json` without normalization

**Finding:** `packages/pods/src/commands/models.ts` `showKnownModels()` loaded `models.json` via raw `JSON.parse(...)` even after shared models parsing hardening, so malformed built-in model data could still crash model-listing output paths.

**Action:** Updated:

- `packages/pods/src/commands/models.ts`
- `packages/pods/CHANGELOG.md`

to:

- reuse shared `parseModelsData(...)` normalization in the known-model listing path,
- avoid direct raw JSON assumptions in the display flow.

**Result:** known-model listing now shares the same malformed-input-safe models parsing path as launch config selection.

---

### 324) pods CLI package metadata loading accepted malformed package-json shapes

**Finding:** `packages/pods/src/cli.ts` parsed `package.json` directly at module load for version/help output; malformed package metadata could crash startup/help/version flows.

**Action:** Updated:

- `packages/pods/src/package-metadata.ts` (new)
- `packages/pods/src/cli.ts`
- `packages/pods/test/package-metadata.test.ts` (new)
- `packages/pods/CHANGELOG.md`

to:

- normalize package metadata parsing for CLI version extraction,
- fall back safely when metadata is malformed/non-string,
- add focused regression coverage for valid parsing and malformed fallback behavior.

**Result:** CLI version/help paths now fail safely on malformed package metadata instead of crashing on raw parse assumptions.

---

### 325) ai OAuth CLI auth-file loading accepted malformed credential entry shapes

**Finding:** `packages/ai/src/cli.ts` loaded `auth.json` via direct `JSON.parse(...)` without runtime normalization; malformed root/provider/credential shapes could propagate incompatible auth data into CLI credential reads.

**Action:** Updated:

- `packages/ai/src/auth-file.ts` (new)
- `packages/ai/src/cli.ts`
- `packages/ai/test/auth-file.test.ts` (new)
- `packages/ai/CHANGELOG.md`

to:

- add auth-file parsing normalization for provider keys and oauth credential fields,
- drop malformed root/entry shapes during CLI auth-file reads,
- trim non-empty provider/token fields,
- add focused regression coverage for malformed fallback and valid-entry preservation behavior.

**Result:** OAuth CLI auth-file loading now fails safely on malformed `auth.json` content and only preserves valid normalized credential entries.

---

### 326) coding-agent CLI package metadata loading accepted malformed package-json shapes

**Finding:** `packages/coding-agent/src/config.ts` parsed `package.json` directly for app/config/version constants; malformed root/value shapes could propagate invalid metadata into CLI startup/version/config-path behavior.

**Action:** Updated:

- `packages/coding-agent/src/config.ts`
- `packages/coding-agent/test/config-package-metadata.test.ts` (new)
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize parsed package metadata (`piConfig.name`, `piConfig.configDir`, `version`) with string-shape checks,
- fall back to safe defaults (`pi`, `.pi`, `0.0.0`) for malformed root/value shapes,
- add focused regression coverage for valid preservation and malformed fallback behavior.

**Result:** coding-agent package metadata reads now fail safely and preserve deterministic app/version/config defaults on malformed package-json content.

---

### 327) coding-agent extension discovery accepted malformed `pi.extensions` manifest entry shapes

**Finding:** `packages/coding-agent/src/core/extensions/loader.ts` consumed `package.json` `pi.extensions` arrays without runtime entry normalization; non-string/blank manifest entries could disrupt extension path resolution and discovery behavior.

**Action:** Updated:

- `packages/coding-agent/src/core/extensions/loader.ts`
- `packages/coding-agent/test/extensions-discovery.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize `pi` manifest arrays to string-only trimmed non-empty entries,
- ignore malformed manifest values (non-array roots, non-string/blank entries),
- preserve explicit valid extension paths while filtering malformed siblings,
- add regression coverage for malformed manifest entries alongside valid entries.

**Result:** extension discovery now tolerates malformed manifest entry shapes and still resolves valid declared extension paths deterministically.

---

### 328) mom Slack timestamp latest-value selection could crash on malformed runtime iterable entries

**Finding:** `packages/mom/src/slack-timestamp.ts` latest-timestamp comparison assumed iterable entries were always strings; malformed runtime values (for example, non-string `ts` payloads leaking through persisted sets) could trigger `.trim()` type errors during backfill cursor selection.

**Action:** Updated:

- `packages/mom/src/slack-timestamp.ts`
- `packages/mom/test/slack-timestamp.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- harden timestamp sort-value parsing with runtime string checks,
- ignore malformed non-string iterable entries during latest timestamp selection,
- add regression coverage validating mixed valid + malformed iterable handling.

**Result:** Slack backfill/latest timestamp selection now skips malformed runtime entry types safely instead of throwing during comparison.

---

### 329) agent project-loop JSON task parsing accepted malformed runtime task entry shapes

**Finding:** `packages/agent/src/project-loop.ts` parsed JSON task lists using static casts only; malformed task entry shapes (non-object entries, non-string title/description/criteria values) could propagate invalid task payloads into downstream TDD execution/commit flows.

**Action:** Updated:

- `packages/agent/src/project-loop.ts`
- `packages/agent/test/project-loop.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- normalize JSON task entries through runtime shape checks,
- trim/validate task title/description strings and acceptance criteria arrays,
- ignore non-object JSON list entries while preserving valid tasks,
- ignore empty JSON task entries and fall back to markdown task parsing when JSON snippets yield no actionable tasks,
- add regression coverage for mixed valid+malformed JSON task arrays.

**Result:** project-loop JSON decomposition now fails safely on malformed task entry fields and preserves deterministic fallback behavior to markdown task extraction when JSON snippets are non-actionable.

---

### 330) coding-agent package-manager manifest parsing accepted malformed `pi.*` entry shapes

**Finding:** `packages/coding-agent/src/core/package-manager.ts` consumed `package.json` `pi` resource arrays (`extensions`/`skills`/`prompts`/`themes`) via unchecked casts; malformed non-string entries could trigger runtime failures during pattern checks/path resolution (`startsWith`, `resolve`, glob filtering).

**Action:** Updated:

- `packages/coding-agent/src/core/package-manager.ts`
- `packages/coding-agent/test/package-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize parsed manifest resource arrays to string-only trimmed non-empty entries,
- ignore malformed/non-string manifest entries during both extension discovery and package resource resolution paths,
- reuse normalized package-manifest parsing for both directory discovery and package loading flows,
- add regression coverage for malformed `pi.extensions` values and mixed valid+invalid manifest pattern entries.

**Result:** package-manager manifest loading now tolerates malformed `pi.*` entry shapes without crashing while preserving valid manifest resource directives.

---

### 331) agent proxy SSE parser rejected valid `data:` lines without a post-colon space

**Finding:** `packages/agent/src/proxy.ts` parsed SSE chunks only when lines started with `data: ` (space required), so compliant `data:<json>` lines were silently ignored and could drop terminal proxy events.

**Action:** Updated:

- `packages/agent/src/proxy.ts`
- `packages/agent/test/proxy.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- accept both `data: <json>` and `data:<json>` SSE data-line variants,
- preserve existing buffer/end-of-stream handling semantics,
- add focused regression coverage for no-space `data:` SSE payload parsing.

**Result:** proxy stream event parsing now handles both valid SSE `data:` line formats and no longer drops events when servers omit the optional post-colon space.

---

### 332) agent proxy SSE malformed JSON payloads produced low-signal parse diagnostics

**Finding:** `packages/agent/src/proxy.ts` forwarded raw `JSON.parse` failures for proxy SSE lines, producing low-context syntax errors that made malformed-stream debugging difficult.

**Action:** Updated:

- `packages/agent/src/proxy.ts`
- `packages/agent/test/proxy.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- wrap SSE data-line JSON parsing with explicit malformed-payload diagnostics,
- include parse-error details and payload previews in failure messages,
- add regression coverage for malformed SSE JSON payload handling in proxy streams.

**Result:** malformed proxy SSE payloads now return clear, actionable error diagnostics instead of ambiguous JSON parse failures.

---

### 333) coding-agent package-manager installed-version parsing accepted malformed `package.json` version shapes

**Finding:** `packages/coding-agent/src/core/package-manager.ts` read installed npm package versions via unchecked casts; malformed/non-string/blank `version` values could propagate invalid version shapes into update checks and create inconsistent update decisions.

**Action:** Updated:

- `packages/coding-agent/src/core/package-manager.ts`
- `packages/coding-agent/test/package-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize installed package `version` values to non-empty trimmed strings only,
- ignore malformed/blank version values by treating them as missing,
- add focused regression coverage for valid, blank, non-string, and malformed-JSON package version reads.

**Result:** package-manager npm installed-version detection now handles malformed package metadata safely and consistently.

---

### 334) mom events payload parsing accepted malformed runtime JSON shapes

**Finding:** `packages/mom/src/events.ts` parsed event files with unchecked JSON field access; malformed runtime payloads (non-object roots or non-string `type/channelId/text/schedule` fields) could propagate incompatible values into event scheduling/execution paths.

**Action:** Updated:

- `packages/mom/src/events.ts`
- `packages/mom/test/events-parse.test.ts` (new)
- `packages/mom/CHANGELOG.md`

to:

- normalize event payload parsing with runtime object/string shape validation,
- reject malformed event payloads before scheduling logic,
- add regression coverage for valid immediate/one-shot/periodic payloads and malformed JSON/payload fallback behavior.

**Result:** events watcher payload parsing now fails safely on malformed runtime JSON shapes and only schedules valid normalized event payloads.

---

### 335) coding-agent startup migrations accepted malformed auth/session JSON shapes

**Finding:** `packages/coding-agent/src/migrations.ts` migrated legacy auth/session files using unchecked JSON casts; malformed provider keys/api-key values/session-header `cwd` payloads could inject invalid entries into migrated auth data or trigger brittle session relocation behavior.

**Action:** Updated:

- `packages/coding-agent/src/migrations.ts`
- `packages/coding-agent/test/migrations.test.ts` (new)
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize oauth/settings migration provider keys to non-empty strings,
- normalize migrated api key values to non-empty strings and ignore malformed entries,
- normalize session-header migration payloads (type/cwd) before path derivation,
- add focused regression coverage for malformed auth/session migration payloads.

**Result:** startup migrations now tolerate malformed auth/session JSON shapes safely and only persist normalized migration entries.

---

### 336) mom backfill timestamp extraction accepted malformed `log.jsonl` line shapes

**Finding:** `packages/mom/src/slack.ts` collected existing backfill timestamps via unchecked `JSON.parse` field access (`entry.ts`), so malformed/non-string/invalid timestamp entries in persisted logs could leak incompatible values into duplicate suppression and backfill cursor selection.

**Action:** Updated:

- `packages/mom/src/slack.ts`
- `packages/mom/test/slack-log-timestamp-parse.test.ts` (new)
- `packages/mom/CHANGELOG.md`

to:

- normalize backfill timestamp extraction from log lines to valid non-empty Slack timestamp strings only,
- ignore malformed JSON roots and malformed timestamp shapes during existing-log timestamp scans,
- add focused regression coverage for valid normalization and malformed fallback behavior.

**Result:** backfill timestamp extraction now tolerates malformed `log.jsonl` lines safely and only forwards valid timestamp values into cursor/dedup logic.

---

### 337) coding-agent session-manager JSONL parsing accepted malformed non-entry line shapes

**Finding:** `packages/coding-agent/src/core/session-manager.ts` parsed session JSONL lines with unchecked casts; malformed non-object/type-less lines could propagate incompatible entry shapes into migration/load/list-validation flows.

**Action:** Updated:

- `packages/coding-agent/src/core/session-manager.ts`
- `packages/coding-agent/test/session-manager/file-operations.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize parsed JSONL lines to object entries with non-empty `type` fields before accepting them,
- reuse normalized entry parsing across `parseSessionEntries`, `loadEntriesFromFile`, `isValidSessionFile`, and session info loading,
- add regression coverage for non-object and missing-type JSONL lines in session file loading.

**Result:** session-manager now safely ignores malformed JSONL line shapes and only processes valid session entry objects in migration/discovery paths.

---

### 338) coding-agent session header validation accepted blank session IDs

**Finding:** `packages/coding-agent/src/core/session-manager.ts` accepted session headers with blank `id` strings as valid during load/recent/list checks, allowing malformed headers to appear as valid persisted sessions.

**Action:** Updated:

- `packages/coding-agent/src/core/session-manager.ts`
- `packages/coding-agent/test/session-manager/file-operations.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require non-empty session IDs in session-header validation paths,
- reject blank-id headers in `loadEntriesFromFile` and `findMostRecentSession` checks,
- skip blank-id sessions in `SessionManager.list(...)` discovery paths,
- add regression coverage for blank-id header rejection behavior.

**Result:** session loading/discovery now ignores malformed blank-id session headers and only treats valid persisted session IDs as discoverable sessions.

---

### 339) coding-agent RPC mode command parsing accepted malformed non-object command payload shapes

**Finding:** `packages/coding-agent/src/modes/rpc/rpc-mode.ts` parsed each stdin line with `JSON.parse(...)` and immediately treated the result as a command/extension-response object. Valid JSON primitives (numbers/arrays/null) and object payloads missing `type` were accepted into downstream command handling, producing low-signal errors and malformed unknown-command responses.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `packages/coding-agent/test/rpc-mode-timeout.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- add `parseRpcLine(...)` parsing/normalization with explicit object-shape and non-empty `type` validation,
- require non-empty string `id` values for `extension_ui_response` payloads before resolving pending extension UI requests,
- return explicit parse diagnostics for malformed JSON and malformed command payload shapes,
- add regression tests for malformed payload rejection and valid command/extension-response parsing.

**Result:** RPC mode now rejects malformed command payload shapes up front and emits clear parse errors, while preserving normal handling of valid command and extension UI response payloads.

---

### 340) coding-agent RPC client stream parser accepted malformed payload shapes and leaked unmatched responses into event listeners

**Finding:** `packages/coding-agent/src/modes/rpc/rpc-client.ts` parsed each stdout line with `JSON.parse(...)` and forwarded non-object payloads and unmatched `response` frames into event listeners as if they were valid `AgentEvent` payloads.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `packages/coding-agent/test/rpc-client.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require object payloads with non-empty `type` values before processing parsed stream lines,
- require non-empty string response IDs and matching pending request IDs before resolving response waiters,
- ignore unmatched/malformed response frames instead of forwarding them to event listeners,
- add regression coverage for non-object payload rejection, unmatched response-frame suppression, and valid pending-response resolution.

**Result:** RPC client event streams now ignore malformed line payload shapes and only resolve matching pending responses, preventing malformed response leakage into event listeners.

---

### 341) ai OpenAI Responses replay conversion crashed on malformed persisted thinking signatures

**Finding:** `packages/ai/src/providers/openai-responses-shared.ts` parsed assistant `thinkingSignature` values with direct `JSON.parse(...)` during history replay conversion. Malformed persisted signature payloads crashed `convertResponsesMessages(...)`, aborting request construction for otherwise valid replay contexts.

**Action:** Updated:

- `packages/ai/src/providers/openai-responses-shared.ts`
- `packages/ai/test/openai-responses-shared-usage.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- normalize and validate parsed `thinkingSignature` payloads as reasoning-object records before replay insertion,
- skip malformed or non-reasoning signature payloads instead of throwing parse exceptions,
- add regression coverage for malformed-signature suppression and valid-signature preservation.

**Result:** OpenAI Responses replay conversion now tolerates malformed persisted thinking signatures and continues message conversion without crashing.

---

### 342) coding-agent settings manager accepted malformed non-object settings-file roots in migration/load paths

**Finding:** `packages/coding-agent/src/core/settings-manager.ts` passed parsed JSON roots directly into migration/load paths as object-shaped settings. Non-object roots (for example scalar/array JSON roots) could propagate incompatible shapes into settings merges or throw during migration checks, disabling persistence flows for otherwise recoverable malformed files.

**Action:** Updated:

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/settings-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize parsed settings roots to object records before migration/load processing,
- treat non-object roots as empty settings objects in both global and project settings file loaders,
- add regression coverage for malformed global/project settings root shapes (including persistence behavior after recovery).

**Result:** settings loading now tolerates malformed non-object settings-file roots safely, preserving persistence and merge behavior with normalized empty settings fallbacks.

---

### 343) ai OpenAI Codex Responses JWT account-id extraction rejected base64url payload segments

**Finding:** `packages/ai/src/providers/openai-codex-responses.ts` extracted Codex JWT payloads with direct `atob(...)` decoding, which assumes padded standard base64 input. Base64url JWT payload segments (unpadded and using `-` / `_`) could fail account-id extraction and abort Codex request setup.

**Action:** Updated:

- `packages/ai/src/providers/openai-codex-responses.ts`
- `packages/ai/test/openai-codex-stream.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- normalize/decode JWT payload segments using base64url-safe decoding with padding restoration,
- validate decoded payload and auth-claim object shapes before reading `chatgpt_account_id`,
- add regression coverage for base64url token payload decoding in Codex streaming request setup.

**Result:** Codex request setup now accepts base64url JWT payload segments reliably when extracting ChatGPT account IDs.

---

### 344) ai Google Gemini CLI credential parsing accepted malformed JSON credential field shapes

**Finding:** `packages/ai/src/providers/google-gemini-cli.ts` parsed JSON apiKey payloads and used `token`/`projectId` fields without runtime string-shape validation. Malformed parsed credential fields (objects/arrays/blank strings) could propagate into request headers/body construction as invalid credential values.

**Action:** Updated:

- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/google-gemini-cli-empty-stream.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- normalize credential payload parsing to object roots with non-empty string `token` and `projectId` fields,
- reject malformed credential field shapes before request dispatch,
- add regression coverage for malformed credential-shape rejection (including no outbound fetch on invalid payloads).

**Result:** Gemini CLI/Antigravity provider setup now rejects malformed credential payload shapes early and avoids issuing requests with invalid auth/project identifiers.

---

### 345) ai streaming JSON argument parsing accepted malformed non-object root shapes

**Finding:** `packages/ai/src/utils/json-parse.ts` returned parsed JSON payloads without root-shape normalization. Streaming tool-argument fragments that parsed to primitives/arrays could propagate non-object argument roots into provider/tool-call processing paths expecting object-shaped arguments.

**Action:** Updated:

- `packages/ai/src/utils/json-parse.ts`
- `packages/ai/test/json-parse.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- normalize parsed streaming JSON values to object roots only,
- treat parsed primitive/array roots as empty objects,
- add regression coverage for complete/partial object parsing and malformed primitive/array root fallback behavior.

**Result:** streaming tool-argument parsing now enforces object-shaped argument roots and safely falls back to empty objects for malformed root shapes.

---

### 346) ai OpenAI Completions reasoning-detail replay accepted malformed non-object `thoughtSignature` payload roots

**Finding:** `packages/ai/src/providers/openai-completions.ts` parsed tool-call `thoughtSignature` JSON and accepted any truthy parsed value into `reasoning_details`. Malformed non-object signature roots (for example JSON strings/numbers) could propagate invalid reasoning-detail payload shapes into completions request construction.

**Action:** Updated:

- `packages/ai/src/providers/openai-completions.ts`
- `packages/ai/test/openai-completions-tool-result-images.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- parse `thoughtSignature` payloads with object-root validation,
- ignore malformed/non-object parsed signature roots when building `reasoning_details`,
- add regression coverage for malformed signature suppression and valid object-signature preservation.

**Result:** OpenAI Completions history conversion now filters malformed `thoughtSignature` payload roots and only forwards valid object-shaped reasoning details.

---

### 347) coding-agent grep tool accepted malformed ripgrep JSON event payload shapes

**Finding:** `packages/coding-agent/src/core/tools/grep.ts` parsed ripgrep JSON lines with broad `any` casts and accessed nested match fields without root-shape validation. Malformed non-object/missing-type event payloads could bypass strict shape expectations and propagate incompatible match metadata.

**Action:** Updated:

- `packages/coding-agent/src/core/tools/grep.ts`
- `packages/coding-agent/test/grep-json-parse.test.ts` (new)
- `packages/coding-agent/CHANGELOG.md`

to:

- add strict JSON-line parsing helper with object/type validation for ripgrep events,
- validate `match` event metadata (`data.path.text`, `data.line_number`) before formatting blocks,
- add regression coverage for malformed JSON roots, malformed metadata fields, and valid match-event parsing.

**Result:** grep tool event parsing now enforces ripgrep event payload shape expectations and safely ignores malformed line payloads.

---

### 348) agent proxy stream parser accepted malformed SSE JSON root shapes

**Finding:** `packages/agent/src/proxy.ts` parsed proxy SSE `data:` payload JSON and cast it directly to `ProxyAssistantMessageEvent`. Valid-but-malformed JSON roots like `null`, numbers, or objects missing a string `type` could propagate to `processProxyEvent(...)`, causing runtime failures (for example null-property access) instead of being safely ignored.

**Action:** Updated:

- `packages/agent/src/proxy.ts`
- `packages/agent/test/proxy.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- add strict proxy-event payload parsing (`parseProxyEventPayload`) that requires object roots with non-empty string `type`,
- ignore malformed JSON root shapes while preserving existing explicit errors for syntactically invalid JSON payloads,
- add regression coverage proving malformed-root frames are ignored and valid trailing `done` frames still complete successfully.

**Result:** proxy streaming now tolerates malformed SSE JSON root payloads without crashing stream processing and continues handling valid events.

---

### 349) ai OpenAI Codex OAuth token parsing accepted malformed token-response root shapes

**Finding:** `packages/ai/src/utils/oauth/openai-codex.ts` token exchange and refresh logic cast `response.json()` payloads directly and dereferenced token fields without root-shape validation. Non-object JSON roots (`null`, numbers) could trigger runtime null-property access errors instead of returning structured OAuth failures.

**Action:** Updated:

- `packages/ai/src/utils/oauth/openai-codex.ts`
- `packages/ai/test/openai-codex-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- normalize token exchange/refresh JSON roots via object-shape parsing before field extraction,
- require non-empty `access_token`/`refresh_token` strings and positive numeric `expires_in` values,
- add regression coverage proving malformed non-object JSON roots are treated as failed token exchange/refresh results rather than runtime crashes.

**Result:** OpenAI Codex OAuth now converts malformed token payload roots into deterministic login/refresh failures with stable error semantics.

---

### 350) coding-agent auth migration renamed oauth.json even when no oauth entries were migrated

**Finding:** `packages/coding-agent/src/migrations.ts` always renamed legacy `oauth.json` to `oauth.json.migrated` whenever parsing succeeded, even when no valid oauth provider entries were migrated. This could hide malformed/empty legacy oauth files despite producing no migrated auth state.

**Action:** Updated:

- `packages/coding-agent/src/migrations.ts`
- `packages/coding-agent/test/migrations.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- track whether any oauth providers were actually migrated from legacy `oauth.json`,
- only rename `oauth.json` to `.migrated` when at least one provider entry was migrated,
- add regression coverage for non-migratable oauth payloads to ensure legacy file preservation when migration yields no credentials.

**Result:** oauth migration now preserves unmigrated legacy oauth files and only archives legacy auth data when actual provider migration occurred.

---

### 351) ai Gemini CLI SSE parser accepted malformed non-object JSON chunk roots

**Finding:** `packages/ai/src/providers/google-gemini-cli.ts` parsed SSE `data:` payloads with direct `JSON.parse` casts and immediately dereferenced `chunk.response`. Valid-but-malformed JSON roots like `null`, numbers, or arrays could throw at runtime and terminate the stream before subsequent valid chunks.

**Action:** Updated:

- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/google-gemini-cli-empty-stream.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- add strict object-root chunk parsing (`parseCloudCodeAssistChunk`) for Cloud Code Assist SSE payloads,
- ignore malformed non-object chunk roots and non-object `response` shapes during SSE processing,
- add regression coverage for malformed-root chunk parsing and mixed malformed+valid SSE streams to verify recovery.

**Result:** Gemini CLI / Antigravity stream parsing now tolerates malformed non-object SSE chunk payloads and continues processing later valid response chunks.

---

### 352) ai OpenAI Codex Responses parser accepted malformed non-object SSE/WebSocket event roots

**Finding:** `packages/ai/src/providers/openai-codex-responses.ts` parsed SSE/WebSocket event payloads via direct `JSON.parse(...) as Record<string, unknown>` casts. Malformed non-object payload roots were inconsistently handled, and malformed usage-limit error field shapes (`plan_type`, `resets_at`, `message`) could suppress user-facing friendly limit diagnostics.

**Action:** Updated:

- `packages/ai/src/providers/openai-codex-responses.ts`
- `packages/ai/test/openai-codex-responses-parsing.test.ts` (new)
- `packages/ai/CHANGELOG.md`

to:

- add shared strict object-root Codex event parser (`parseCodexEventPayload`) and use it for both SSE and WebSocket event ingestion,
- normalize usage-limit error parsing to string/number-safe field extraction (`code`, `type`, `message`, `plan_type`, `resets_at`),
- add regression coverage for malformed event-root parsing and malformed usage-limit error-field shapes while preserving friendly usage-limit guidance.

**Result:** OpenAI Codex Responses stream/error parsing now ignores malformed non-object event roots consistently and preserves friendly usage-limit diagnostics under malformed error payload field shapes.

---

### 353) coding-agent extension discovery fell back to index entrypoints despite explicit malformed `pi.extensions` declarations

**Finding:** `packages/coding-agent/src/core/extensions/loader.ts` normalized malformed `pi.extensions` entries but still fell back to `index.ts`/`index.js` when no valid declared entries resolved. Packages explicitly declaring extension entrypoints could therefore load unintended index fallbacks when manifest entries were malformed or missing.

**Action:** Updated:

- `packages/coding-agent/src/core/extensions/loader.ts`
- `packages/coding-agent/test/extensions-discovery.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- treat explicit `pi.extensions` declarations as authoritative even when normalization yields zero valid entries,
- keep fallback-to-index behavior only for packages without explicit `pi.extensions` declarations,
- add regression coverage ensuring malformed-only manifest declarations do not load fallback index entrypoints.

**Result:** extension discovery now honors explicit manifest intent and avoids unintended index fallback loading when `pi.extensions` declarations are present but invalid.

---

### 354) coding-agent npm update checks accepted malformed npm-registry `version` payload shapes

**Finding:** `packages/coding-agent/src/core/package-manager.ts` assumed npm registry `/latest` responses always provided a string `version` field. Malformed registry payload shapes could propagate invalid version values into update comparisons, producing unstable npm package update decisions.

**Action:** Updated:

- `packages/coding-agent/src/core/package-manager.ts`
- `packages/coding-agent/test/package-manager-registry-version.test.ts` (new)
- `packages/coding-agent/CHANGELOG.md`

to:

- parse npm-registry `version` from object payloads as non-empty trimmed strings only,
- treat malformed/missing/non-string `version` payloads as explicit fetch failures,
- add regression coverage for malformed registry response roots/fields and valid trimmed version parsing.

**Result:** npm update checks now reject malformed registry version payloads deterministically and avoid propagating invalid latest-version values into package update logic.

---

### 355) mom one-shot event parsing accepted ambiguous non-timezone timestamps

**Finding:** `packages/mom/src/events.ts` accepted any non-empty one-shot `at` string in payload parsing, deferring validation until scheduling. Ambiguous timestamps without timezone offsets (or numeric timestamp-like strings) could pass initial parsing and be interpreted with local timezone semantics.

**Action:** Updated:

- `packages/mom/src/events.ts`
- `packages/mom/test/events-parse.test.ts`
- `packages/mom/test/events-scheduling.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- require one-shot timestamps to match ISO-8601 datetime format with explicit timezone (`Z` or `±HH:MM`),
- reject malformed/ambiguous `at` values directly in payload parsing,
- add regression coverage for timezone-less and numeric timestamp rejection while preserving valid timestamp parsing and delay normalization.

**Result:** one-shot events now require explicit timezone-aware timestamps at parse time, preventing ambiguous local-time scheduling semantics.

---

### 356) coding-agent model-registry accepted malformed `models.json` provider-map keys

**Finding:** `packages/coding-agent/src/core/model-registry.ts` trusted `models.json` provider-map keys as-is. Blank keys or keys with surrounding whitespace could pass schema validation and be treated as provider identifiers, producing malformed provider namespaces for custom models/overrides.

**Action:** Updated:

- `packages/coding-agent/src/core/model-registry.ts`
- `packages/coding-agent/test/model-registry.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- validate provider-map keys as non-empty strings without surrounding whitespace,
- surface explicit load errors for malformed provider keys while preserving built-in model availability,
- add regression coverage for blank and whitespace-padded provider keys.

**Result:** model-registry now rejects malformed provider-map keys in `models.json`, preventing invalid provider identifier shapes from entering custom model/override resolution.

---

### 357) mom decimal Slack timestamp parsing used floating-point conversion near safe-integer boundary

**Finding:** `packages/mom/src/slack-timestamp.ts` converted decimal Slack timestamps with `Number.parseFloat(...)*1000`, which can round near `Number.MAX_SAFE_INTEGER` boundaries and produce off-by-one millisecond values for otherwise valid timestamps.

**Action:** Updated:

- `packages/mom/src/slack-timestamp.ts`
- `packages/mom/test/slack-timestamp.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- parse decimal/integer Slack timestamps with exact string + `BigInt` conversion,
- preserve floor-to-millisecond semantics without floating-point rounding drift,
- keep safe-integer overflow rejection and integer-second magnitude handling,
- add regression coverage for a near-boundary decimal timestamp (`9007199254740.001123`).

**Result:** Slack timestamp millisecond normalization now preserves exact flooring behavior near safe-integer precision limits instead of drifting by 1ms from floating-point rounding.

---

### 358) web-ui model-discovery parsing accepted malformed discovery payload rows

**Finding:** `packages/web-ui/src/utils/model-discovery.ts` trusted `llama.cpp`/`vLLM` `/v1/models` row shapes and model IDs. Non-object rows or blank/malformed `id` values could produce invalid discovered model entries or fail parsing paths unexpectedly.

**Action:** Updated:

- `packages/web-ui/src/utils/model-discovery.ts`
- `packages/web-ui/test/model-discovery.test.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- validate discovery response roots as object payloads with array `data`,
- ignore malformed/non-object model rows and rows missing non-empty string `id`,
- preserve strict numeric parsing fallbacks for context/token metadata,
- add regression coverage for malformed response roots and mixed valid+invalid row filtering.

**Result:** web-ui model discovery now rejects malformed response-root shapes deterministically and filters invalid row entries instead of returning malformed model IDs.

---

### 359) ai Anthropic OAuth accepted malformed token exchange/refresh payload shapes

**Finding:** `packages/ai/src/utils/oauth/anthropic.ts` trusted token JSON payload fields via direct type assertions during login exchange and refresh flows. Malformed/non-object payload roots or empty token fields could propagate invalid credentials or throw late runtime errors.

**Action:** Updated:

- `packages/ai/src/utils/oauth/anthropic.ts`
- `packages/ai/test/anthropic-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- validate token payload roots as objects before field extraction,
- require non-empty `access_token`/`refresh_token` strings and positive finite `expires_in`,
- throw explicit malformed-payload errors for exchange/refresh parsing failures,
- add regression coverage for non-object exchange payload roots and malformed refresh-field shapes.

**Result:** Anthropic OAuth token exchange/refresh now rejects malformed token payload roots/fields deterministically before credential persistence.

---

### 360) agent proxy SSE typed-event parsing accepted malformed required field shapes

**Finding:** `packages/agent/src/proxy.ts` only validated SSE payload root/type before casting to `ProxyAssistantMessageEvent`. Typed frames with malformed required fields (for example non-numeric `contentIndex`, non-string `delta`, blank tool metadata, malformed usage objects) could still reach `processProxyEvent(...)` and throw during partial-message reconstruction.

**Action:** Updated:

- `packages/agent/src/proxy.ts`
- `packages/agent/test/proxy.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- validate required fields per proxy event type before dispatch (`contentIndex`, deltas, tool metadata, done/error reasons, usage objects),
- ignore malformed typed proxy frames instead of throwing stream-level runtime errors,
- normalize proxy HTTP error payload parsing to require non-empty string `error` fields,
- add regression coverage proving malformed typed events are skipped while subsequent valid `done` events still complete.

**Result:** proxy streaming now rejects malformed typed SSE frames safely and continues processing subsequent valid events without collapsing the stream.

---

### 361) coding-agent managed-tool version checks accepted malformed GitHub release payload shapes

**Finding:** `packages/coding-agent/src/utils/tools-manager.ts` assumed GitHub latest-release responses always contained a string `tag_name` and called `.replace(...)` directly. Malformed/non-object payload roots (or non-string/blank tags) surfaced low-signal runtime errors instead of explicit version-parse failures.

**Action:** Updated:

- `packages/coding-agent/src/utils/tools-manager.ts`
- `packages/coding-agent/test/tools-manager-version-parse.test.ts` (new)
- `packages/coding-agent/CHANGELOG.md`

to:

- normalize release payload roots as objects before extracting `tag_name`,
- require non-empty string tags and normalize optional `v` prefixes safely,
- reject malformed/missing tag shapes with explicit latest-release parse errors,
- add regression coverage for valid tag normalization and malformed payload rejection.

**Result:** managed-tool version checks now validate GitHub release payload shape deterministically and avoid null-property runtime parsing errors from malformed latest-release responses.

---

### 362) ai Antigravity OAuth accepted malformed token exchange/refresh payload shapes

**Finding:** `packages/ai/src/utils/oauth/google-antigravity.ts` parsed OAuth token exchange/refresh responses with direct shape assumptions. Malformed/non-object payload roots or missing required token fields could propagate invalid credentials or fail with low-signal runtime errors.

**Action:** Updated:

- `packages/ai/src/utils/oauth/google-antigravity.ts`
- `packages/ai/test/google-antigravity-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- validate token payload roots as objects before extracting fields,
- require non-empty `access_token` and positive finite `expires_in` for exchange/refresh flows,
- preserve explicit `refresh_token` requirement for exchange while allowing refresh fallback to existing refresh token,
- normalize optional user/project payload fields via string-shape parsing helpers,
- add regression coverage for malformed exchange-root and malformed refresh-field payload rejection.

**Result:** Antigravity OAuth token exchange/refresh now rejects malformed token payload shapes deterministically before credential persistence.

---

### 363) ai Gemini CLI OAuth accepted malformed token exchange/refresh payload shapes

**Finding:** `packages/ai/src/utils/oauth/google-gemini-cli.ts` parsed OAuth token exchange/refresh and onboarding payloads with direct shape assumptions. Malformed/non-object token payload roots could produce low-signal runtime errors or propagate invalid credential fields.

**Action:** Updated:

- `packages/ai/src/utils/oauth/google-gemini-cli.ts`
- `packages/ai/test/google-gemini-cli-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- validate token payload roots before field extraction and require non-empty `access_token` + positive finite `expires_in`,
- keep explicit refresh-token requirement for exchange while allowing refresh fallback to existing refresh token,
- normalize onboarding/userinfo payload roots before reading project/email string fields,
- add regression coverage for malformed exchange-root and malformed refresh-field payload rejection.

**Result:** Gemini CLI OAuth token exchange/refresh now rejects malformed token payload shapes deterministically before credential persistence.

---

### 364) ai GitHub Copilot OAuth accepted malformed device-code/token payload field shapes

**Finding:** `packages/ai/src/utils/oauth/github-copilot.ts` relied on loose runtime field checks when parsing device-code and Copilot token responses. Blank token/code strings or malformed numeric interval/expiry fields could pass partially and degrade polling/token persistence behavior.

**Action:** Updated:

- `packages/ai/src/utils/oauth/github-copilot.ts`
- `packages/ai/test/github-copilot-oauth-payload.test.ts` (new)
- `packages/ai/CHANGELOG.md`

to:

- add reusable payload parsers for device-code and Copilot token responses,
- require non-empty string token/code fields and positive numeric interval/expiry values (safe integer for epoch expiry),
- reject malformed roots/fields before polling/token refresh persistence,
- add regression coverage for valid payload normalization and malformed payload rejection.

**Result:** GitHub Copilot OAuth now validates device/token payload fields deterministically and rejects malformed payload shapes before they influence polling or credential persistence.

---

### 365) ai OpenAI Codex OAuth surfaced raw JSON-parse exceptions on malformed token bodies

**Finding:** `packages/ai/src/utils/oauth/openai-codex.ts` expected successful token responses to contain parseable JSON. Invalid JSON response bodies from exchange/refresh endpoints surfaced raw parser exceptions instead of deterministic OAuth failure handling.

**Action:** Updated:

- `packages/ai/src/utils/oauth/openai-codex.ts`
- `packages/ai/test/openai-codex-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- parse token payloads through a shared validator requiring non-empty token fields and positive finite `expires_in`,
- catch JSON parse failures for exchange/refresh responses and convert them into structured failed-token outcomes with diagnostics,
- add regression coverage for invalid JSON exchange and refresh response bodies.

**Result:** OpenAI Codex OAuth now treats malformed token JSON bodies as structured exchange/refresh failures instead of bubbling raw parse exceptions through login/refresh flows.

---

### 366) ai GitHub Copilot OAuth poll responses accepted malformed access/error payload fields

**Finding:** `packages/ai/src/utils/oauth/github-copilot.ts` polled device-token responses using loose shape checks. Blank access tokens or malformed `error`/`interval` fields could pass inconsistent branches during device-flow polling.

**Action:** Updated:

- `packages/ai/src/utils/oauth/github-copilot.ts`
- `packages/ai/test/github-copilot-oauth-payload.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- add strict poll-payload parsing that distinguishes success (`access_token`) vs error (`error`, optional positive interval),
- reject malformed poll payload roots/fields before poll-loop branching,
- normalize slow-down interval handling by combining server-provided interval (when valid) with required backoff growth,
- add regression coverage for valid and malformed poll payloads.

**Result:** GitHub Copilot OAuth polling now handles malformed poll payloads deterministically and only transitions on validated success/error fields.

---

### 367) tui overlay numeric size parsing propagated non-finite values into layout calculations

**Finding:** `packages/tui/src/tui.ts` accepted raw numeric overlay `width` / `maxHeight` values without finite-number validation. Passing `NaN`/`Infinity` could propagate invalid numeric state into overlay layout resolution and silently suppress overlay rendering.

**Action:** Updated:

- `packages/tui/src/tui.ts`
- `packages/tui/test/overlay-options.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- validate numeric `SizeValue` inputs as finite numbers before use,
- treat non-finite numeric `width` / `maxHeight` values as invalid and fall back to default sizing behavior,
- add regression coverage for non-finite width/max-height handling.

**Result:** Overlay layout now rejects non-finite numeric size inputs deterministically and preserves default overlay rendering behavior.

---

### 368) ai auth-file parsing normalized whitespace-padded provider keys into canonical IDs

**Finding:** `packages/ai/src/auth-file.ts` trimmed provider keys while loading OAuth credential maps. Whitespace-padded keys (for example `" anthropic "`) were silently coalesced into canonical provider IDs, which could mask malformed key entries and create normalization collisions.

**Action:** Updated:

- `packages/ai/src/auth-file.ts`
- `packages/ai/test/auth-file.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require provider keys to be non-empty strings without surrounding whitespace,
- drop whitespace-padded provider-key entries instead of trimming/coalescing them,
- add regression coverage for whitespace-padded provider-key rejection.

**Result:** OAuth auth-file parsing now preserves strict provider-key identity and rejects malformed whitespace-padded provider keys during credential loading.

---

### 369) coding-agent auth-storage parsing normalized whitespace-padded provider keys into canonical IDs

**Finding:** `packages/coding-agent/src/core/auth-storage.ts` trimmed provider keys while normalizing `auth.json`, so whitespace-padded keys (for example `" anthropic "`) were silently coalesced into canonical provider IDs. This could mask malformed key entries and create provider-key normalization collisions during runtime auth lookup.

**Action:** Updated:

- `packages/coding-agent/src/core/auth-storage.ts`
- `packages/coding-agent/test/auth-storage.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require provider keys to be non-empty strings without surrounding whitespace during auth-storage normalization,
- drop whitespace-padded provider-key entries instead of trimming/coalescing them,
- add regression coverage for whitespace-padded provider-key rejection in auth-storage normalization.

**Result:** coding-agent auth-storage parsing now preserves strict provider-key identity and rejects malformed whitespace-padded provider keys while loading persisted credentials.

---

### 370) coding-agent auth migration trimmed whitespace-padded provider keys during oauth/apiKey migration

**Finding:** `packages/coding-agent/src/migrations.ts` trimmed provider keys while migrating legacy `oauth.json` and `settings.json.apiKeys` entries. Whitespace-padded provider keys could be silently coalesced into canonical IDs during migration, masking malformed keys and creating normalization-collision risk.

**Action:** Updated:

- `packages/coding-agent/src/migrations.ts`
- `packages/coding-agent/test/migrations.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require provider keys to be non-empty strings without surrounding whitespace during migration,
- drop whitespace-padded provider keys from both oauth and api-key migration sources,
- add regression coverage that migration preserves strict provider-key identity while still trimming key values.

**Result:** Legacy auth migration now rejects whitespace-padded provider keys and preserves strict provider-key identity when building migrated `auth.json` entries.

---

### 371) pods model-config normalization trimmed whitespace-padded model/env keys

**Finding:** `packages/pods/src/model-configs.ts` trimmed model IDs and env keys while normalizing built-in `models.json`. Whitespace-padded keys could be silently coalesced into canonical keys during parsing, masking malformed config keys and creating key-collision risk in normalized model definitions.

**Action:** Updated:

- `packages/pods/src/model-configs.ts`
- `packages/pods/test/model-configs.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require model IDs and env keys to be non-empty strings without surrounding whitespace,
- drop whitespace-padded model/env keys instead of trimming/coalescing them during normalization,
- add regression coverage for whitespace-padded key rejection while preserving normal value trimming.

**Result:** pods built-in model-config parsing now preserves strict key identity for model IDs and env keys, rejecting malformed whitespace-padded key entries.

---

### 372) pods config normalization trimmed whitespace-padded pod/model key names and active selector values

**Finding:** `packages/pods/src/config.ts` trimmed pod/model map keys (and `active` selector values) during persisted config normalization. Whitespace-padded key values could be silently coalesced into canonical identifiers, masking malformed persisted config keys and creating key-collision risk.

**Action:** Updated:

- `packages/pods/src/config.ts`
- `packages/pods/test/config.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require pod/model keys and active pod selectors to be non-empty strings without surrounding whitespace,
- drop whitespace-padded key entries/selectors instead of trimming/coalescing them,
- add regression coverage for whitespace-padded pod/model key rejection and active-selector rejection.

**Result:** pods config normalization now preserves strict pod/model key identity and rejects malformed whitespace-padded active selectors during persisted config loading.

---

### 373) tui overlay layout options accepted non-finite numeric positioning/margin inputs

**Finding:** `packages/tui/src/tui.ts` only normalized non-finite numeric values for overlay width/max-height. Other numeric layout inputs (`minWidth`, numeric `row`/`col`, `margin`, `offsetX`/`offsetY`) still accepted `NaN`/`Infinity`, allowing invalid numeric state to propagate through overlay layout resolution.

**Action:** Updated:

- `packages/tui/src/tui.ts`
- `packages/tui/test/overlay-options.test.ts`
- `packages/tui/CHANGELOG.md`

to:

- normalize all numeric overlay layout inputs to finite values (`width`, `minWidth`, `maxHeight`, numeric `row`/`col`, margins, offsets),
- fall back to default/anchor positioning and default margins when non-finite values are provided,
- add regression coverage for non-finite `minWidth`, `margin`, and numeric `row`/`col` handling.

**Result:** Overlay layout now rejects non-finite numeric sizing/positioning inputs consistently across all numeric layout options.

---

### 374) coding-agent header resolution accepted whitespace-padded/blank header names

**Finding:** `packages/coding-agent/src/core/resolve-config-value.ts` resolved header values but forwarded header-name keys exactly as provided. Whitespace-padded/blank header names in configured provider headers could survive normalization and create malformed header maps.

**Action:** Updated:

- `packages/coding-agent/src/core/resolve-config-value.ts`
- `packages/coding-agent/test/resolve-config-value.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require header names to be non-empty strings without surrounding whitespace before value resolution,
- drop malformed/whitespace-padded header keys instead of forwarding them into resolved header maps,
- add regression coverage for whitespace-padded header-name rejection while preserving valid header resolution behavior.

**Result:** coding-agent header resolution now preserves strict header-name identity and rejects malformed whitespace-padded/blank header keys in resolved header maps.

---

### 375) pods package-metadata version parsing accepted whitespace-padded/non-semver version strings

**Finding:** `packages/pods/src/package-metadata.ts` trimmed `package.json` `version` values and accepted any non-empty string. Whitespace-padded or non-semver strings could be surfaced as CLI metadata versions, masking malformed package metadata.

**Action:** Updated:

- `packages/pods/src/package-metadata.ts`
- `packages/pods/test/package-metadata.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require `version` values to be strict semver strings with no surrounding whitespace,
- reject malformed/non-semver version payloads instead of trimming/coercing them,
- add regression coverage for whitespace-padded and malformed version-string fallback behavior.

**Result:** pods package metadata parsing now preserves strict semver version handling and safely falls back when version payloads are malformed.

---

### 376) coding-agent managed-tool release parsing normalized whitespace-padded GitHub tag names

**Finding:** `packages/coding-agent/src/utils/tools-manager.ts` normalized GitHub release `tag_name` values via trimming. Whitespace-padded tag names could be silently coalesced into canonical versions during managed-tool update checks, masking malformed release payloads.

**Action:** Updated:

- `packages/coding-agent/src/utils/tools-manager.ts`
- `packages/coding-agent/test/tools-manager-version-parse.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require `tag_name` to be a non-empty string without surrounding whitespace before version normalization,
- reject whitespace-padded malformed tag names instead of trimming/coalescing them,
- add regression coverage for whitespace-padded tag-name rejection while preserving `v`-prefix normalization for valid tags.

**Result:** managed-tool latest-release parsing now preserves strict tag-name identity and rejects malformed whitespace-padded GitHub release tags.

---

### 377) ai OpenAI Responses usage parsing truncated fractional token counters

**Finding:** `packages/ai/src/providers/openai-responses-shared.ts` normalized usage counters via integer truncation (`Math.trunc`) for both numeric and numeric-string token fields. Fractional token payloads (for example `12.4`) were silently coerced instead of rejected.

**Action:** Updated:

- `packages/ai/src/providers/openai-responses-shared.ts`
- `packages/ai/test/openai-responses-shared-usage.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require usage token values to be non-negative safe integers (number or decimal-digit string),
- reject fractional token values instead of truncating them,
- add regression coverage for both numeric and numeric-string fractional token rejection paths.

**Result:** OpenAI Responses shared usage parsing now preserves strict integer token accounting and rejects malformed fractional usage values.

---

### 378) ai OpenAI Completions usage parsing truncated fractional token counters

**Finding:** `packages/ai/src/providers/openai-completions.ts` normalized usage counters by truncating fractional numeric values (`Math.trunc`) for both numeric and numeric-string token fields. Malformed decimal token values were silently coerced into integers.

**Action:** Updated:

- `packages/ai/src/providers/openai-completions.ts`
- `packages/ai/test/openai-completions-tool-choice.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require non-negative safe integers for OpenAI Completions usage counters (number and decimal-digit string forms),
- reject fractional usage values instead of truncating them,
- expand regression coverage expectations for malformed/non-decimal usage payloads that previously depended on truncation.

**Result:** OpenAI Completions usage parsing now enforces strict integer token accounting and rejects malformed fractional usage values.

---

### 379) web-ui model discovery normalized whitespace-padded remote model IDs

**Finding:** `packages/web-ui/src/utils/model-discovery.ts` trimmed discovered model IDs from llama.cpp/vLLM payload rows. Whitespace-padded IDs could be silently normalized into canonical IDs during discovery, masking malformed upstream metadata.

**Action:** Updated:

- `packages/web-ui/src/utils/model-discovery.ts`
- `packages/web-ui/test/model-discovery.test.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- require discovered model IDs to be non-empty strings without surrounding whitespace,
- drop whitespace-padded malformed model IDs instead of trimming/coalescing them,
- extend regression coverage to ensure malformed/whitespace-padded rows are filtered while valid rows remain discoverable.

**Result:** web-ui remote model discovery now preserves strict discovered-model identifier identity and rejects whitespace-padded malformed IDs.

---

### 380) ai OpenAI Codex request-header construction accepted whitespace-padded custom header names

**Finding:** `packages/ai/src/providers/openai-codex-responses.ts` built request headers by passing model/options header maps directly to `Headers`/`headers.set(...)`. Whitespace-padded custom header keys could be forwarded as malformed header names, causing runtime header-set failures or malformed-key normalization.

**Action:** Updated:

- `packages/ai/src/providers/openai-codex-responses.ts`
- `packages/ai/test/openai-codex-stream.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- validate custom header keys (non-empty string, no surrounding whitespace) before applying model/options headers,
- ignore malformed header keys rejected by runtime header validation instead of failing request construction,
- add regression coverage that malformed whitespace-padded model/options header keys are dropped while valid keys remain.

**Result:** OpenAI Codex Responses header construction now preserves strict custom-header key identity and safely ignores malformed whitespace-padded header names.

---

### 381) mom event parsing normalized whitespace-padded event identifiers and schedules

**Finding:** `packages/mom/src/events.ts` trimmed event `type`/`channelId`/one-shot timestamp/schedule/timezone strings before validation. Whitespace-padded event identifiers and scheduling fields could be silently normalized into canonical values.

**Action:** Updated:

- `packages/mom/src/events.ts`
- `packages/mom/test/events-parse.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- require strict non-empty strings without surrounding whitespace for event identifiers and scheduling fields,
- reject whitespace-padded identifiers (`type`, `channelId`) and one-shot/periodic schedule fields instead of trimming/coalescing them,
- add regression coverage for whitespace-padded payload rejection cases.

**Result:** mom event parsing now preserves strict event identifier/schedule identity and rejects malformed whitespace-padded event payload fields.

---

### 382) ai Gemini CLI/Antigravity usage parsing truncated fractional token counters

**Finding:** `packages/ai/src/providers/google-gemini-cli.ts` normalized Cloud Code Assist usage counters via integer truncation for numeric and numeric-string token fields. Fractional token payloads were silently coerced instead of rejected.

**Action:** Updated:

- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/google-gemini-cli-usage-metadata.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require non-negative safe integers for Gemini CLI/Antigravity usage counters (number and decimal-digit string forms),
- reject fractional token values instead of truncating them,
- add regression coverage for fractional numeric token payload rejection.

**Result:** Gemini CLI/Antigravity usage parsing now enforces strict integer token accounting and rejects malformed fractional usage values.

---

### 383) ai Google/Vertex shared usage parsing truncated fractional token counters

**Finding:** `packages/ai/src/providers/google-shared.ts` normalized Google/Vertex usage counters by truncating fractional numeric values (numbers and numeric strings). Malformed decimal token fields were silently coerced instead of rejected.

**Action:** Updated:

- `packages/ai/src/providers/google-shared.ts`
- `packages/ai/test/google-usage-metadata.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require usage token values to be non-negative safe integers for Google/Vertex shared usage parsing,
- reject fractional token values instead of truncating them,
- add regression coverage for fractional numeric payload rejection and updated malformed/non-decimal expectations.

**Result:** Google/Vertex shared usage parsing now enforces strict integer token accounting and rejects malformed fractional usage values.

---

### 384) ai Bedrock shared usage parsing truncated fractional token counters

**Finding:** `packages/ai/src/providers/amazon-bedrock.ts` normalized Bedrock usage counters by truncating fractional numeric values (numbers and numeric strings). Malformed decimal token fields were silently coerced instead of rejected.

**Action:** Updated:

- `packages/ai/src/providers/amazon-bedrock.ts`
- `packages/ai/test/amazon-bedrock-usage.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require usage token values to be non-negative safe integers for Bedrock shared usage parsing,
- reject fractional token values instead of truncating them,
- add regression coverage for fractional numeric payload rejection and updated malformed/non-decimal expectations.

**Result:** Bedrock shared usage parsing now enforces strict integer token accounting and rejects malformed fractional usage values.

---

### 385) ai Anthropic stream usage parsing truncated fractional token counters

**Finding:** `packages/ai/src/providers/anthropic.ts` normalized Anthropic stream usage counters by truncating fractional numeric values (numbers and numeric strings). Malformed decimal token fields were silently coerced into integer usage accounting.

**Action:** Updated:

- `packages/ai/src/providers/anthropic.ts`
- `packages/ai/test/github-copilot-anthropic.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require usage token values to be non-negative safe integers for Anthropic stream usage parsing,
- reject fractional token values instead of truncating them,
- expand Copilot Anthropic stream regression coverage with a dedicated fractional-number rejection case and stricter malformed decimal expectations.

**Result:** Anthropic stream usage parsing now enforces strict integer token accounting and rejects malformed fractional usage values.

---

### 386) ai Anthropic client header merge accepted whitespace-padded custom header names

**Finding:** `packages/ai/src/providers/anthropic.ts` merged `model.headers`, dynamic Copilot headers, and `options.headers` with `Object.assign(...)` and no key validation. Whitespace-padded/blank custom header keys were accepted into merged default headers.

**Action:** Updated:

- `packages/ai/src/providers/anthropic.ts`
- `packages/ai/test/github-copilot-anthropic.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- introduce strict header-name validation (non-empty and no surrounding whitespace),
- drop malformed custom header keys during Anthropic header merge,
- add regression coverage asserting malformed option header keys are excluded while valid keys remain.

**Result:** Anthropic header merge now preserves strict header-key identity and rejects malformed custom header names before request construction.

---

### 387) ai OpenAI Completions client header merge accepted whitespace-padded custom header names

**Finding:** `packages/ai/src/providers/openai-completions.ts` merged provider/model/options headers via broad object assignment and accepted whitespace-padded/blank custom header keys in merged default headers.

**Action:** Updated:

- `packages/ai/src/providers/openai-completions.ts`
- `packages/ai/test/openai-completions-tool-choice.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- introduce strict header-name validation (non-empty and no surrounding whitespace),
- validate header names for model headers, Copilot dynamic headers, and options headers before merge,
- add regression coverage asserting malformed option header keys are excluded while valid keys remain.

**Result:** OpenAI Completions header merge now preserves strict header-key identity and rejects malformed custom header names before client initialization.

---

### 388) ai OpenAI Responses client header merge accepted whitespace-padded custom header names

**Finding:** `packages/ai/src/providers/openai-responses.ts` merged provider/model/options headers with broad object assignment and accepted whitespace-padded/blank custom header keys in merged default headers.

**Action:** Updated:

- `packages/ai/src/providers/openai-responses.ts`
- `packages/ai/test/openai-responses-headers.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- introduce strict header-name validation (non-empty and no surrounding whitespace),
- validate header names for model headers, Copilot dynamic headers, and options headers before merge,
- add regression coverage asserting malformed model/option header keys are excluded while valid keys remain.

**Result:** OpenAI Responses header merge now preserves strict header-key identity and rejects malformed custom header names before client initialization.

---

### 389) ai Azure OpenAI Responses client header merge accepted whitespace-padded custom header names

**Finding:** `packages/ai/src/providers/azure-openai-responses.ts` merged model/options headers without key validation and accepted whitespace-padded/blank custom header keys in merged default headers.

**Action:** Updated:

- `packages/ai/src/providers/azure-openai-responses.ts`
- `packages/ai/test/azure-openai-responses-headers.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- introduce strict header-name validation (non-empty and no surrounding whitespace),
- validate header names for model and options headers before merge,
- add regression coverage asserting malformed model/option header keys are excluded while valid keys remain.

**Result:** Azure OpenAI Responses header merge now preserves strict header-key identity and rejects malformed custom header names before client initialization.

---

### 390) agent proxy usage parser accepted fractional token counters in SSE done/error payloads

**Finding:** `packages/agent/src/proxy.ts` parsed proxy SSE `usage` payloads with a generic non-negative finite-number parser for both token counters and costs. Fractional token counters (`input`/`output`/`cacheRead`/`cacheWrite`/`totalTokens`) could be accepted instead of being rejected as malformed usage accounting.

**Action:** Updated:

- `packages/agent/src/proxy.ts`
- `packages/agent/test/proxy.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- require token counter fields to be non-negative safe integers in proxy usage payload parsing,
- keep cost-field parsing as non-negative finite numbers (allowing decimal costs),
- add regression coverage asserting malformed fractional token counters are ignored while valid integer-token + decimal-cost payloads remain accepted.

**Result:** Proxy SSE usage parsing now enforces integer token accounting while preserving decimal cost support for proxy stream results.

---

### 391) agent proxy SSE typed-event parser accepted whitespace-padded type/tool identifiers

**Finding:** `packages/agent/src/proxy.ts` accepted whitespace-padded string identifiers for SSE event `type`, `toolcall_start.id`, and `toolcall_start.toolName` because payload parsing used trimming non-empty string normalization. Malformed frame identifiers could be normalized instead of rejected.

**Action:** Updated:

- `packages/agent/src/proxy.ts`
- `packages/agent/test/proxy.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- require strict non-empty string identity (no surrounding whitespace) for proxy event `type`, tool call `id`, and `toolName` fields,
- keep trimmed parsing only for human-readable proxy HTTP error messages,
- add regression coverage confirming whitespace-padded typed-event identifiers are ignored while valid events continue streaming.

**Result:** Proxy SSE typed-event parsing now preserves strict identifier identity and rejects whitespace-padded event/type/tool identifiers instead of silently normalizing them.

---

### 392) coding-agent session-manager normalized whitespace-padded session IDs and entry types

**Finding:** `packages/coding-agent/src/core/session-manager.ts` treated trimmed non-empty strings as valid for session header IDs and entry `type` fields when loading/listing JSONL sessions. Whitespace-padded identifiers/types could be normalized instead of rejected as malformed persisted session metadata.

**Action:** Updated:

- `packages/coding-agent/src/core/session-manager.ts`
- `packages/coding-agent/test/session-manager/file-operations.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict non-empty string identity (no surrounding whitespace) for session header ID parsing and entry `type` parsing,
- reject whitespace-padded session IDs in load/list/recent-session discovery flows,
- add regression coverage for whitespace-padded session IDs and entry types in session file parsing and session listing.

**Result:** Session-manager persisted-file parsing now rejects whitespace-padded session identifiers/type values instead of silently normalizing malformed session metadata.

---

### 393) coding-agent package-manager version parsing accepted trimmed/non-semver version strings

**Finding:** `packages/coding-agent/src/core/package-manager.ts` validated npm registry and installed `package.json` `version` values as generic trimmed non-empty strings. Whitespace-padded and non-semver literals could be accepted after trimming, allowing malformed version metadata into update comparisons.

**Action:** Updated:

- `packages/coding-agent/src/core/package-manager.ts`
- `packages/coding-agent/test/package-manager-registry-version.test.ts`
- `packages/coding-agent/test/package-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict semver version strings (no surrounding whitespace) for npm registry latest-version and installed-package version parsing,
- reject whitespace-padded/non-semver literals (`" 1.2.3 "`, `"latest"`, `"v1.2.3"`),
- add regression coverage for strict semver acceptance (including prerelease/build metadata) and malformed-version rejection.

**Result:** Package-manager version parsing now preserves strict semver identity and rejects malformed version literals instead of silently trimming/coercing them.

---

### 394) mom logged Slack timestamp parser normalized whitespace-padded `ts` values

**Finding:** `packages/mom/src/slack.ts` parsed persisted `log.jsonl` timestamps with trimmed non-empty string normalization, so whitespace-padded `ts` values could be accepted and normalized instead of treated as malformed persisted timestamp metadata.

**Action:** Updated:

- `packages/mom/src/slack.ts`
- `packages/mom/test/slack-log-timestamp-parse.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- require strict non-empty timestamp strings (no surrounding whitespace) when parsing logged Slack `ts` values,
- keep parseability checks against strict Slack timestamp parsing,
- add regression coverage asserting whitespace-padded persisted `ts` values are rejected.

**Result:** Logged Slack timestamp parsing now preserves strict timestamp identity and rejects whitespace-padded `ts` values instead of silently normalizing malformed persisted timestamps.

---

### 395) coding-agent agent-root session migration accepted whitespace-padded session header identifiers

**Finding:** `packages/coding-agent/src/migrations.ts` used trimmed non-empty parsing for legacy agent-root session header `type`/`cwd` fields during relocation. Whitespace-padded values could be normalized and migrated instead of being rejected as malformed legacy session headers.

**Action:** Updated:

- `packages/coding-agent/src/migrations.ts`
- `packages/coding-agent/test/migrations.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict non-empty string identity (no surrounding whitespace) for migrated session header `type` and `cwd`,
- skip relocation of legacy agent-root session files whose header identifiers are whitespace-padded,
- add regression coverage ensuring malformed whitespace-padded session headers remain unmigrated while valid headers still relocate.

**Result:** Agent-root session relocation now preserves strict session-header identifier identity and rejects whitespace-padded legacy header fields instead of trimming them.

---

### 396) coding-agent RPC protocol parsing normalized whitespace-padded type/response identifiers

**Finding:** `packages/coding-agent/src/modes/rpc/rpc-mode.ts` and `packages/coding-agent/src/modes/rpc/rpc-client.ts` parsed command/event `type` and response IDs as trimmed non-empty strings. Whitespace-padded protocol identifiers could be normalized and accepted instead of being rejected as malformed RPC frames.

**Action:** Updated:

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `packages/coding-agent/test/rpc-mode-timeout.test.ts`
- `packages/coding-agent/test/rpc-client.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict non-empty string identity (no surrounding whitespace) for RPC `type` and response/extension-response `id` parsing,
- drop whitespace-padded response IDs/types in RPC client stream handling instead of forwarding normalized identifiers,
- add regression coverage for whitespace-padded command/event/response identifier rejection while preserving valid frame handling.

**Result:** RPC mode/client protocol parsing now preserves strict identifier identity and rejects whitespace-padded RPC frame identifiers instead of silently normalizing malformed protocol fields.

---

### 397) ai OAuth auth-file parsing normalized whitespace-padded oauth token fields

**Finding:** `packages/ai/src/auth-file.ts` validated oauth credential token fields with trimmed non-empty parsing, so whitespace-padded `refresh`/`access` token values could be silently normalized instead of rejected as malformed persisted credentials.

**Action:** Updated:

- `packages/ai/src/auth-file.ts`
- `packages/ai/test/auth-file.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict non-empty token strings (no surrounding whitespace) for oauth `refresh` and `access` fields,
- keep strict provider-key validation behavior,
- add regression coverage for whitespace-padded oauth token-field rejection.

**Result:** OAuth auth-file parsing now preserves strict oauth token identity and rejects whitespace-padded persisted token values instead of silently normalizing them.

---

### 398) coding-agent auth-storage normalization normalized whitespace-padded credential token fields

**Finding:** `packages/coding-agent/src/core/auth-storage.ts` normalized `auth.json` credential fields with trimmed non-empty parsing, so whitespace-padded api-key and oauth `refresh`/`access` values could be silently coalesced during runtime credential loading.

**Action:** Updated:

- `packages/coding-agent/src/core/auth-storage.ts`
- `packages/coding-agent/test/auth-storage.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict non-empty credential strings (no surrounding whitespace) for api-key values and oauth `refresh`/`access` token fields,
- keep strict provider-key normalization behavior,
- add regression coverage for whitespace-padded credential-field rejection while preserving valid credential loading.

**Result:** Auth-storage credential normalization now preserves strict persisted credential token identity and rejects whitespace-padded credential fields instead of silently trimming malformed values.

---

### 399) ai Gemini CLI JSON apiKey credential parsing normalized whitespace-padded token/project identifiers

**Finding:** `packages/ai/src/providers/google-gemini-cli.ts` parsed JSON apiKey credential fields (`token`, `projectId`) with trimmed non-empty normalization, so whitespace-padded credential identifiers could be silently accepted instead of rejected as malformed request credentials.

**Action:** Updated:

- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/google-gemini-cli-empty-stream.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict non-empty string identity (no surrounding whitespace) for JSON apiKey `token` and `projectId`,
- keep malformed-credential short-circuit behavior before request dispatch,
- add regression coverage asserting whitespace-padded credential fields are rejected and no outbound request is issued.

**Result:** Gemini CLI credential parsing now preserves strict token/project identifier identity and rejects whitespace-padded JSON apiKey fields instead of silently normalizing malformed credentials.

---

### 400) ai OpenAI Codex OAuth token parser normalized whitespace-padded access/refresh token fields

**Finding:** `packages/ai/src/utils/oauth/openai-codex.ts` parsed token exchange/refresh payload token fields with trimmed non-empty normalization, so whitespace-padded `access_token`/`refresh_token` values could be silently accepted instead of rejected as malformed OAuth token payloads.

**Action:** Updated:

- `packages/ai/src/utils/oauth/openai-codex.ts`
- `packages/ai/test/openai-codex-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict non-empty token-string identity (no surrounding whitespace) for OpenAI Codex token exchange/refresh payload fields,
- keep malformed token payloads on structured failed-exchange/refresh paths,
- add regression coverage for whitespace-padded token field rejection in both exchange and refresh flows.

**Result:** OpenAI Codex OAuth token parsing now preserves strict token-field identity and rejects whitespace-padded token values instead of silently normalizing malformed payload fields.

---

### 401) ai Anthropic OAuth token parser normalized whitespace-padded access/refresh token fields

**Finding:** `packages/ai/src/utils/oauth/anthropic.ts` parsed token exchange/refresh payload token fields with trimmed non-empty normalization, so whitespace-padded `access_token`/`refresh_token` values could be silently accepted instead of rejected as malformed OAuth payload fields.

**Action:** Updated:

- `packages/ai/src/utils/oauth/anthropic.ts`
- `packages/ai/test/anthropic-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict non-empty token-string identity (no surrounding whitespace) for Anthropic token exchange/refresh payload fields,
- preserve structured malformed payload failures for invalid token field shapes,
- add regression coverage for whitespace-padded token field rejection in exchange and refresh flows.

**Result:** Anthropic OAuth token parsing now preserves strict token-field identity and rejects whitespace-padded token values instead of silently normalizing malformed payload fields.

---

### 402) ai Google OAuth token parsers normalized whitespace-padded access/refresh token fields

**Finding:** `packages/ai/src/utils/oauth/google-gemini-cli.ts` and `packages/ai/src/utils/oauth/google-antigravity.ts` parsed token exchange/refresh payload token fields with trimmed non-empty normalization, so whitespace-padded `access_token`/`refresh_token` values could be silently accepted instead of rejected as malformed OAuth payload fields.

**Action:** Updated:

- `packages/ai/src/utils/oauth/google-gemini-cli.ts`
- `packages/ai/src/utils/oauth/google-antigravity.ts`
- `packages/ai/test/google-gemini-cli-oauth-abort.test.ts`
- `packages/ai/test/google-antigravity-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict non-empty token-string identity (no surrounding whitespace) for Google Gemini CLI and Antigravity token exchange/refresh payload fields,
- preserve structured malformed payload failures for invalid required token field shapes,
- ignore whitespace-padded optional refresh-token payload values on refresh flows (retaining the existing refresh token) instead of trimming/coalescing malformed values,
- add regression coverage for whitespace-padded token-field handling in both providers’ exchange and refresh flows.

**Result:** Google Gemini CLI and Antigravity OAuth token parsing now preserves strict token-field identity by rejecting whitespace-padded required access-token values and ignoring whitespace-padded optional refresh-token payload values instead of silently normalizing malformed token fields.

---

### 403) ai GitHub Copilot OAuth payload parser normalized whitespace-padded token/code/error fields

**Finding:** `packages/ai/src/utils/oauth/github-copilot.ts` parsed device-code, poll, and token payload string fields with trimmed non-empty normalization, so whitespace-padded token/code/error identifiers could be silently accepted instead of rejected as malformed OAuth payload values.

**Action:** Updated:

- `packages/ai/src/utils/oauth/github-copilot.ts`
- `packages/ai/test/github-copilot-oauth-payload.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict non-empty string identity (no surrounding whitespace) for Copilot payload token/code/error identifier fields,
- preserve existing malformed-payload rejection behavior for non-object/invalid numeric fields,
- add regression coverage for whitespace-padded field rejection in device-code, token, and poll response parsing paths.

**Result:** GitHub Copilot OAuth payload parsing now preserves strict token/code/error identifier identity and rejects whitespace-padded payload fields instead of silently normalizing malformed OAuth values.

---

### 404) coding-agent package metadata parsing normalized whitespace-padded app/config/version fields

**Finding:** `packages/coding-agent/src/config.ts` parsed `package.json` metadata fields (`piConfig.name`, `piConfig.configDir`, `version`) with trimmed non-empty normalization, so whitespace-padded metadata identifiers could be silently accepted instead of rejected as malformed package metadata.

**Action:** Updated:

- `packages/coding-agent/src/config.ts`
- `packages/coding-agent/test/config-package-metadata.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict non-empty string identity (no surrounding whitespace) for parsed package metadata identifiers/version values,
- preserve existing malformed-root/value fallback behavior to default `pi` metadata values,
- add regression coverage for whitespace-padded metadata field rejection.

**Result:** coding-agent package metadata parsing now preserves strict app/config/version field identity and rejects whitespace-padded metadata values instead of silently normalizing malformed package metadata.

---

### 405) mom channel-store last-log timestamp parsing normalized whitespace-padded timestamp values

**Finding:** `packages/mom/src/store.ts` parsed last-log-line `ts` values by trimming non-empty strings, so whitespace-padded persisted timestamps could be silently accepted instead of rejected as malformed channel-store cursor values.

**Action:** Updated:

- `packages/mom/src/store.ts`
- `packages/mom/test/store.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- require strict non-empty timestamp-string identity (no surrounding whitespace) when parsing last-log-line `ts` values,
- preserve existing malformed timestamp fallback behavior (`null`) for non-string/blank timestamps,
- add regression coverage for whitespace-padded persisted `ts` rejection in `getLastTimestamp()`.

**Result:** Channel-store last-log timestamp parsing now preserves strict persisted timestamp identity and rejects whitespace-padded `ts` values instead of silently normalizing malformed cursor values.

---

### 406) coding-agent legacy auth migration normalized whitespace-padded api-key credential values

**Finding:** `packages/coding-agent/src/migrations.ts` migrated legacy `settings.json` `apiKeys` values using trimmed non-empty normalization, so whitespace-padded legacy api-key values could be silently accepted instead of rejected as malformed credential tokens during `auth.json` migration.

**Action:** Updated:

- `packages/coding-agent/src/migrations.ts`
- `packages/coding-agent/test/migrations.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict non-empty api-key credential string identity (no surrounding whitespace) when migrating legacy `settings.json` `apiKeys` entries,
- preserve existing provider-key strictness and oauth precedence behavior in migration output,
- add regression coverage for whitespace-padded legacy api-key value rejection while preserving migration of valid providers/keys.

**Result:** Legacy auth migration now preserves strict api-key credential identity and rejects whitespace-padded legacy `apiKeys` values instead of silently normalizing malformed token values.

---

### 407) ai OpenAI Codex responses usage-limit parsing normalized whitespace-padded error identifiers

**Finding:** `packages/ai/src/providers/openai-codex-responses.ts` parsed usage-limit error identifiers (`error.code`, `error.type`, `error.plan_type`) with trimmed non-empty normalization, so whitespace-padded error metadata could be silently accepted and mapped to friendly usage-limit messaging.

**Action:** Updated:

- `packages/ai/src/providers/openai-codex-responses.ts`
- `packages/ai/test/openai-codex-responses-parsing.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict non-empty identifier identity (no surrounding whitespace) for usage-limit error metadata fields,
- preserve existing friendly-message behavior for valid usage-limit error identifiers and malformed non-string field shapes,
- add regression coverage verifying whitespace-padded error identifiers are not normalized into usage-limit friendly messaging.

**Result:** OpenAI Codex Responses usage-limit parsing now preserves strict error-identifier identity and rejects whitespace-padded error metadata fields instead of silently normalizing malformed identifiers.

---

### 408) mom log-to-session sync normalized whitespace-padded persisted Slack timestamp values

**Finding:** `packages/mom/src/context.ts` parsed persisted `log.jsonl` `ts` values for sync by trimming non-empty strings, so whitespace-padded Slack timestamp values could be silently accepted during `syncLogToSessionManager(...)`.

**Action:** Updated:

- `packages/mom/src/context.ts`
- `packages/mom/test/context-sync.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- require strict timestamp-string identity (no surrounding whitespace) when parsing persisted `ts` values during log-to-session sync,
- preserve existing malformed timestamp shape rejection and fallback-date behavior,
- add regression coverage for whitespace-padded persisted `ts` rejection in sync ingestion.

**Result:** Log-to-session sync now preserves strict persisted timestamp identity and rejects whitespace-padded `ts` values instead of silently normalizing malformed sync cursor values.

---

### 409) ai Google OAuth project-discovery parsing normalized whitespace-padded project/tier/operation identifiers

**Finding:** `packages/ai/src/utils/oauth/google-gemini-cli.ts` and `packages/ai/src/utils/oauth/google-antigravity.ts` parsed project-discovery metadata identifiers (project IDs, tier IDs, and operation names) with trimmed non-empty normalization, so whitespace-padded Cloud Code Assist identifiers could be silently accepted instead of rejected as malformed discovery metadata.

**Action:** Updated:

- `packages/ai/src/utils/oauth/google-gemini-cli.ts`
- `packages/ai/src/utils/oauth/google-antigravity.ts`
- `packages/ai/test/google-gemini-cli-oauth-abort.test.ts`
- `packages/ai/test/google-antigravity-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict non-empty identifier identity (no surrounding whitespace) for discovered Google project/tier/operation identifier fields,
- preserve existing token/email parsing behavior while preventing malformed identifier normalization,
- add regression coverage for whitespace-padded discovered project identifier handling in Gemini CLI and Antigravity OAuth discovery flows.

**Result:** Google OAuth project discovery now preserves strict metadata identifier identity and rejects whitespace-padded discovered identifiers instead of silently normalizing malformed Cloud Code Assist metadata.

---

### 410) pods persisted model-entry parsing normalized whitespace-padded model identifiers

**Finding:** `packages/pods/src/config.ts` parsed persisted model-entry `model` values with trimmed non-empty normalization, so whitespace-padded model identifiers could be silently accepted instead of rejected as malformed persisted model-entry identifiers.

**Action:** Updated:

- `packages/pods/src/config.ts`
- `packages/pods/test/config.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require strict non-empty model-identifier identity (no surrounding whitespace) for persisted `models[*].model` values,
- preserve existing pod/model key and selector normalization behavior,
- add regression coverage for whitespace-padded persisted model-identifier rejection.

**Result:** Pods persisted model-entry parsing now preserves strict model-identifier identity and rejects whitespace-padded `models[*].model` values instead of silently normalizing malformed model identifiers.

---

### 411) ai Google OAuth profile parsing normalized whitespace-padded email identifiers

**Finding:** `packages/ai/src/utils/oauth/google-gemini-cli.ts` and `packages/ai/src/utils/oauth/google-antigravity.ts` parsed profile `email` fields with trimmed non-empty normalization, so whitespace-padded OAuth profile email identifiers could be silently accepted instead of rejected as malformed profile metadata.

**Action:** Updated:

- `packages/ai/src/utils/oauth/google-gemini-cli.ts`
- `packages/ai/src/utils/oauth/google-antigravity.ts`
- `packages/ai/test/google-gemini-cli-oauth-abort.test.ts`
- `packages/ai/test/google-antigravity-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict non-empty email identifier identity (no surrounding whitespace) when parsing Google OAuth profile responses,
- preserve existing OAuth token/project discovery behavior while dropping malformed padded profile email values,
- add regression coverage for whitespace-padded profile email rejection in Gemini CLI and Antigravity login flows.

**Result:** Google OAuth profile parsing now preserves strict email-identifier identity and rejects whitespace-padded profile email values instead of silently normalizing malformed profile metadata.

---

### 412) pods config parsing normalized whitespace-padded persisted modelsPath identifiers

**Finding:** `packages/pods/src/config.ts` parsed persisted `modelsPath` values with trimmed non-empty normalization, so whitespace-padded model-directory identifiers could be silently accepted instead of rejected as malformed persisted path identifiers.

**Action:** Updated:

- `packages/pods/src/config.ts`
- `packages/pods/test/config.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require strict non-empty identity (no surrounding whitespace) for persisted `modelsPath` values,
- preserve existing pod/model key, selector, and model-id strictness behavior,
- add regression coverage confirming whitespace-padded `modelsPath` values are rejected.

**Result:** Pods config parsing now preserves strict persisted model-directory identifier identity and rejects whitespace-padded `modelsPath` values instead of silently normalizing malformed path identifiers.

---

### 413) pods config parsing normalized whitespace-padded persisted ssh command identifiers

**Finding:** `packages/pods/src/config.ts` parsed persisted pod `ssh` values with trimmed non-empty normalization, so whitespace-padded SSH command identifiers could be silently accepted instead of rejected as malformed persisted pod-connection identifiers.

**Action:** Updated:

- `packages/pods/src/config.ts`
- `packages/pods/test/config.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require strict non-empty identity (no surrounding whitespace) for persisted pod `ssh` command values,
- preserve existing strictness for pod/model keys, model identifiers, and `modelsPath` values,
- add regression coverage confirming pods with whitespace-padded `ssh` values are dropped during persisted config normalization.

**Result:** Pods config parsing now preserves strict persisted SSH command identity and rejects whitespace-padded `ssh` values instead of silently normalizing malformed pod-connection identifiers.

---

### 414) ai OpenAI Codex OAuth token parser accepted fractional expires_in values

**Finding:** `packages/ai/src/utils/oauth/openai-codex.ts` parsed token payload `expires_in` with positive-finite numeric validation, so fractional expiry durations could be silently accepted instead of rejected as malformed OAuth token metadata.

**Action:** Updated:

- `packages/ai/src/utils/oauth/openai-codex.ts`
- `packages/ai/test/openai-codex-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require positive safe-integer `expires_in` values for Codex token exchange/refresh payloads,
- preserve existing strict token-field validation and malformed-payload failure behavior,
- add regression coverage for fractional `expires_in` rejection in exchange and refresh flows.

**Result:** OpenAI Codex OAuth token parsing now preserves strict integer expiry semantics and rejects fractional `expires_in` values instead of silently accepting malformed token expiry metadata.

---

### 415) ai Anthropic OAuth token parser accepted fractional expires_in values

**Finding:** `packages/ai/src/utils/oauth/anthropic.ts` parsed token payload `expires_in` with positive-finite numeric validation, so fractional expiry durations could be silently accepted instead of rejected as malformed OAuth token metadata.

**Action:** Updated:

- `packages/ai/src/utils/oauth/anthropic.ts`
- `packages/ai/test/anthropic-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require positive safe-integer `expires_in` values for Anthropic token exchange/refresh payloads,
- preserve existing strict token-field validation and malformed-payload rejection behavior,
- add regression coverage for fractional `expires_in` rejection in exchange and refresh flows.

**Result:** Anthropic OAuth token parsing now preserves strict integer expiry semantics and rejects fractional `expires_in` values instead of silently accepting malformed token expiry metadata.

---

### 416) ai Google OAuth token parsers accepted fractional expires_in values

**Finding:** `packages/ai/src/utils/oauth/google-gemini-cli.ts` and `packages/ai/src/utils/oauth/google-antigravity.ts` parsed token payload `expires_in` with positive-finite numeric validation, so fractional expiry durations could be silently accepted instead of rejected as malformed OAuth token metadata.

**Action:** Updated:

- `packages/ai/src/utils/oauth/google-gemini-cli.ts`
- `packages/ai/src/utils/oauth/google-antigravity.ts`
- `packages/ai/test/google-gemini-cli-oauth-abort.test.ts`
- `packages/ai/test/google-antigravity-oauth-abort.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require positive safe-integer `expires_in` values for Gemini CLI and Antigravity token exchange/refresh payloads,
- preserve existing strict token-field, profile, and project-discovery parsing behavior,
- add regression coverage for fractional `expires_in` rejection in both providers’ exchange and refresh flows.

**Result:** Google OAuth token parsing now preserves strict integer expiry semantics and rejects fractional `expires_in` values instead of silently accepting malformed token expiry metadata.

---

### 417) ai GitHub Copilot OAuth payload parser accepted fractional interval/expiry values

**Finding:** `packages/ai/src/utils/oauth/github-copilot.ts` parsed device-code and poll timing fields (`interval`, `expires_in`) with positive-finite numeric validation, so fractional timing values could be silently accepted instead of rejected as malformed OAuth payload metadata.

**Action:** Updated:

- `packages/ai/src/utils/oauth/github-copilot.ts`
- `packages/ai/test/github-copilot-oauth-payload.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require positive safe-integer timing values for Copilot device-code and poll payload fields,
- preserve strict token/code/error identifier parsing and malformed root/field rejection behavior,
- add regression coverage for fractional interval/expiry rejection in device-code and poll payload parsing paths.

**Result:** GitHub Copilot OAuth payload parsing now preserves strict integer timing semantics and rejects fractional timing values instead of silently accepting malformed polling/expiry metadata.

---

### 418) mom event payload parsing normalized surrounding whitespace in event text bodies

**Finding:** `packages/mom/src/events.ts` normalized `text` with trimmed non-empty parsing, so valid event message bodies with intentional surrounding whitespace were silently altered during payload parsing.

**Action:** Updated:

- `packages/mom/src/events.ts`
- `packages/mom/test/events-parse.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- validate non-empty event text while preserving original `text` payload content verbatim,
- keep strict identifier/schedule/timestamp parsing rules for event metadata fields,
- add regression coverage confirming surrounding whitespace in event text is preserved.

**Result:** Event payload parsing now preserves scheduled message body content exactly (while still rejecting blank-only text) instead of silently trimming surrounding whitespace.

---

### 419) coding-agent startup auth migration forwarded malformed legacy oauth credential shapes

**Finding:** `packages/coding-agent/src/migrations.ts` migrated legacy `oauth.json` entries by spreading object payloads without validating required oauth credential fields, so malformed entries (missing/padded tokens or non-integer `expires`) could be forwarded into migrated `auth.json` despite runtime auth normalization expecting strict oauth credential shapes.

**Action:** Updated:

- `packages/coding-agent/src/migrations.ts`
- `packages/coding-agent/test/migrations.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict oauth credential-field validation during legacy migration (`refresh`, `access`, non-negative safe-integer `expires`),
- skip malformed legacy oauth entries while still migrating valid oauth/api-key providers and preserving provider-key strictness,
- add regression coverage for whitespace-padded token-field and fractional-expiry oauth migration rejection.

**Result:** Startup auth migration now preserves strict oauth credential-shape requirements and skips malformed legacy oauth entries instead of forwarding incompatible credentials into migrated auth storage.

---

### 420) mom slack timestamp parser normalized whitespace-padded timestamp identifiers

**Finding:** `packages/mom/src/slack-timestamp.ts` trimmed input timestamp strings before parsing/sorting, so whitespace-padded timestamp identifiers could be silently accepted as valid Slack timestamps instead of rejected as malformed identifiers.

**Action:** Updated:

- `packages/mom/src/slack-timestamp.ts`
- `packages/mom/test/slack-timestamp.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- require strict timestamp-string identity (no surrounding whitespace) for parse/sort helpers,
- preserve existing integer/decimal parsing behavior and malformed-format rejection,
- add regression coverage for whitespace-padded timestamp rejection in parsing and latest-timestamp selection helpers.

**Result:** Slack timestamp parsing and ordering now preserves strict timestamp-identifier identity and rejects whitespace-padded timestamp strings instead of silently normalizing malformed values.

---

### 421) coding-agent settings-manager string/list parsing normalized whitespace-padded identifiers

**Finding:** `packages/coding-agent/src/core/settings-manager.ts` normalized optional string fields by trimming whitespace, so malformed whitespace-padded identifiers/path entries in settings (`defaultProvider`, `defaultModel`, `theme`, shell path/prefix, package sources, extension/skill/prompt/theme arrays, enabled-model patterns) were silently accepted after normalization.

**Action:** Updated:

- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/settings-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict non-empty string identity (`trimmed === value`) for normalized optional strings,
- reject whitespace-padded string/list settings entries instead of trimming/coalescing malformed values,
- preserve existing malformed-type filtering behavior,
- add regression coverage for strict rejection of whitespace-padded settings values across scalar, array, and package-source parsing paths.

**Result:** Settings-manager string/list parsing now preserves strict identifier/path identity and drops whitespace-padded malformed settings entries instead of silently normalizing them.

---

### 422) mom settings-manager normalized whitespace-padded provider/model identifiers

**Finding:** `packages/mom/src/context.ts` normalized `defaultProvider` and `defaultModel` settings values by trimming whitespace, so malformed whitespace-padded provider/model identifiers in `settings.json` were silently accepted after normalization.

**Action:** Updated:

- `packages/mom/src/context.ts`
- `packages/mom/test/context-settings.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- require strict non-empty string identity (`trimmed === value`) for optional string settings normalization,
- reject whitespace-padded `defaultProvider`/`defaultModel` settings entries instead of trimming/coalescing malformed identifiers,
- add regression coverage confirming strict rejection of padded provider/model settings while preserving valid setting values and existing thinking-level behavior.

**Result:** Mom settings loading now preserves strict provider/model identifier identity and drops whitespace-padded malformed settings values instead of silently normalizing them.

---

### 423) coding-agent keybindings config normalized whitespace-padded key identifiers

**Finding:** `packages/coding-agent/src/core/keybindings.ts` trimmed configured keybinding strings during normalization, so whitespace-padded key identifiers in `keybindings.json` could be silently accepted instead of rejected as malformed keybinding entries.

**Action:** Updated:

- `packages/coding-agent/src/core/keybindings.ts`
- `packages/coding-agent/test/keybindings.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict non-empty string identity (`trimmed === value`) for scalar and array keybinding entries,
- reject whitespace-padded keybinding identifiers instead of trimming/coalescing them,
- preserve malformed-type filtering and explicit empty-array unbind behavior,
- add regression coverage for rejecting padded scalar/list keybindings while preserving valid strict entries.

**Result:** Keybindings config normalization now preserves strict key identifier identity and drops whitespace-padded malformed keybinding values instead of silently normalizing them.

---

### 424) ai openai-completions usage parsing normalized whitespace-padded numeric-string counters

**Finding:** `packages/ai/src/providers/openai-completions.ts` trimmed usage-counter strings before decimal validation, so whitespace-padded numeric-string token counters in OpenAI-compatible usage payloads could be silently accepted instead of rejected as malformed token metadata.

**Action:** Updated:

- `packages/ai/src/providers/openai-completions.ts`
- `packages/ai/test/openai-completions-tool-choice.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict numeric-string identity (`trimmed === value`) for usage-token parsing,
- reject whitespace-padded numeric-string usage counters instead of trimming/coalescing malformed token values,
- preserve existing integer-only, non-decimal, and safe-integer usage validation behavior,
- add regression coverage for whitespace-padded usage-counter rejection.

**Result:** OpenAI Completions usage parsing now preserves strict token-value identity and rejects whitespace-padded numeric-string usage counters instead of silently normalizing malformed metadata.

---

### 425) ai anthropic usage parsing normalized whitespace-padded numeric-string counters

**Finding:** `packages/ai/src/providers/anthropic.ts` trimmed usage-counter strings before decimal validation, so whitespace-padded numeric-string token counters in Anthropic stream usage payloads could be silently accepted instead of rejected as malformed token metadata.

**Action:** Updated:

- `packages/ai/src/providers/anthropic.ts`
- `packages/ai/test/github-copilot-anthropic.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict numeric-string identity (`trimmed === value`) for Anthropic usage-token parsing,
- reject whitespace-padded numeric-string usage counters instead of trimming/coalescing malformed token values,
- preserve existing integer-only, non-decimal, and safe-integer usage validation behavior,
- add regression coverage for whitespace-padded Anthropic usage-counter rejection.

**Result:** Anthropic stream usage parsing now preserves strict token-value identity and rejects whitespace-padded numeric-string usage counters instead of silently normalizing malformed metadata.

---

### 426) ai google/gemini usage parsing normalized whitespace-padded numeric-string counters

**Finding:** `packages/ai/src/providers/google-shared.ts` and `packages/ai/src/providers/google-gemini-cli.ts` trimmed usage-counter strings before decimal validation, so whitespace-padded numeric-string token counters in Google/Vertex and Gemini usage payloads could be silently accepted instead of rejected as malformed token metadata.

**Action:** Updated:

- `packages/ai/src/providers/google-shared.ts`
- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/google-usage-metadata.test.ts`
- `packages/ai/test/google-gemini-cli-usage-metadata.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict numeric-string identity (`trimmed === value`) for Google/Gemini usage-token parsing,
- reject whitespace-padded numeric-string usage counters instead of trimming/coalescing malformed token values,
- preserve existing integer-only, non-decimal, and safe-integer usage validation behavior,
- add regression coverage for whitespace-padded usage-counter rejection across both Google shared and Gemini usage parsers.

**Result:** Google/Vertex and Gemini usage parsing now preserves strict token-value identity and rejects whitespace-padded numeric-string usage counters instead of silently normalizing malformed metadata.

---

### 427) ai bedrock/openai-responses usage parsing normalized whitespace-padded numeric-string counters

**Finding:** `packages/ai/src/providers/amazon-bedrock.ts` and `packages/ai/src/providers/openai-responses-shared.ts` trimmed usage-counter strings before decimal validation, so whitespace-padded numeric-string token counters in Bedrock and OpenAI Responses-compatible usage payloads could be silently accepted instead of rejected as malformed token metadata.

**Action:** Updated:

- `packages/ai/src/providers/amazon-bedrock.ts`
- `packages/ai/src/providers/openai-responses-shared.ts`
- `packages/ai/test/amazon-bedrock-usage.test.ts`
- `packages/ai/test/openai-responses-shared-usage.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict numeric-string identity (`trimmed === value`) for Bedrock/OpenAI Responses usage-token parsing,
- reject whitespace-padded numeric-string usage counters instead of trimming/coalescing malformed token values,
- preserve existing integer-only, non-decimal, and safe-integer usage validation behavior,
- add regression coverage for whitespace-padded usage-counter rejection across Bedrock and OpenAI Responses usage parsers.

**Result:** Bedrock and OpenAI Responses usage parsing now preserves strict token-value identity and rejects whitespace-padded numeric-string usage counters instead of silently normalizing malformed metadata.

---

### 428) web-ui model-discovery numeric parsing normalized whitespace-padded metadata values

**Finding:** `packages/web-ui/src/utils/model-discovery.ts` trimmed numeric-string metadata values before integer validation, so whitespace-padded `context_length` / `max_tokens` / related numeric metadata from remote discovery payloads could be silently accepted instead of rejected as malformed numeric metadata.

**Action:** Updated:

- `packages/web-ui/src/utils/model-discovery.ts`
- `packages/web-ui/test/model-discovery.test.ts`
- `packages/web-ui/CHANGELOG.md`

to:

- require strict numeric-string identity (`trimmed === value`) before numeric parsing in model discovery metadata normalization,
- reject whitespace-padded numeric-string metadata values instead of trimming/coalescing malformed values,
- preserve existing safe-integer and malformed-format fallback behavior,
- add regression coverage for whitespace-padded numeric metadata fallback behavior.

**Result:** Web UI model-discovery metadata parsing now preserves strict numeric value identity and rejects whitespace-padded numeric-string metadata values instead of silently normalizing malformed provider metadata.

---

### 429) coding-agent changelog parser normalized whitespace-padded last-version identifiers

**Finding:** `packages/coding-agent/src/utils/changelog.ts` trimmed `lastVersion` values before semantic-version parsing, so whitespace-padded last-seen version identifiers could be silently accepted instead of rejected as malformed changelog state identifiers.

**Action:** Updated:

- `packages/coding-agent/src/utils/changelog.ts`
- `packages/coding-agent/test/changelog-utils.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict version-string identity (`trimmed === value`) before semver component parsing,
- reject whitespace-padded `lastVersion` values instead of trimming/coalescing malformed version identifiers,
- preserve existing unsafe-integer component rejection behavior,
- add regression coverage verifying whitespace-padded `lastVersion` values fall back to the safe baseline comparison path.

**Result:** Changelog last-version parsing now preserves strict version identifier identity and rejects whitespace-padded `lastVersion` values instead of silently normalizing malformed state.

---

### 430) agent CLI integer option parsing normalized whitespace-padded values

**Finding:** `packages/agent/src/cli-number.ts` trimmed CLI numeric option values before integer validation, so whitespace-padded values could be silently accepted instead of rejected as malformed numeric option identifiers.

**Action:** Updated:

- `packages/agent/src/cli-number.ts`
- `packages/agent/test/cli-number.test.ts`
- `packages/agent/CHANGELOG.md`

to:

- require strict numeric-string identity (`trimmed === value`) for non-blank CLI integer option values,
- preserve fallback behavior for truly blank option values,
- reject whitespace-padded numeric option values instead of trimming/coalescing malformed inputs,
- keep existing non-numeric, non-positive, and unsafe-integer rejection behavior,
- add regression coverage for whitespace-padded CLI integer option rejection.

**Result:** Agent CLI integer option parsing now preserves strict numeric option identity and rejects whitespace-padded numeric option values instead of silently normalizing malformed inputs.

---

### 431) coding-agent settings-selector numeric parsing normalized whitespace-padded values

**Finding:** `packages/coding-agent/src/modes/interactive/components/settings-selector.ts` trimmed integer option values before numeric validation, so whitespace-padded selector values could be silently accepted instead of rejected as malformed numeric option identifiers.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/components/settings-selector.ts`
- `packages/coding-agent/test/settings-selector.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict integer-string identity (`trimmed === value`) before numeric parsing,
- reject whitespace-padded integer values instead of trimming/coalescing malformed numeric option inputs,
- preserve existing malformed-format and unsafe-integer rejection behavior,
- add regression coverage for whitespace-padded numeric selector value rejection.

**Result:** Settings-selector integer parsing now preserves strict numeric option identity and rejects whitespace-padded values instead of silently normalizing malformed selector input.

---

### 432) pods model option parsing normalized whitespace-padded numeric values

**Finding:** `packages/pods/src/model-options.ts` trimmed `--context` / `--gpus` numeric option values before integer/alias validation, so whitespace-padded numeric values could be silently accepted instead of rejected as malformed option identifiers.

**Action:** Updated:

- `packages/pods/src/model-options.ts`
- `packages/pods/test/model-options.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require strict numeric/alias value identity (`trimmed === value`) for `--context` and `--gpus` option parsing,
- reject whitespace-padded numeric and alias values instead of trimming/coalescing malformed option inputs,
- preserve existing alias handling (`4k`..`128k`) and non-numeric/unsafe integer rejection behavior,
- add regression coverage for whitespace-padded `--context` and `--gpus` rejection.

**Result:** Pods model option parsing now preserves strict numeric option identity and rejects whitespace-padded `--context` / `--gpus` values instead of silently normalizing malformed inputs.

---

### 433) pods model-start context token parsing normalized whitespace-padded values

**Finding:** `packages/pods/src/commands/models.ts` trimmed runtime `--context` values before alias/integer resolution in `resolveModelContextTokens(...)`, so whitespace-padded context alias/numeric values could be silently accepted instead of rejected as malformed context identifiers.

**Action:** Updated:

- `packages/pods/src/commands/models.ts`
- `packages/pods/test/models-ssh-status.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require strict context-string identity (`trimmed === value`) before alias/integer parsing in runtime context resolution,
- reject whitespace-padded alias/numeric context values instead of trimming/coalescing malformed values,
- preserve existing alias support and malformed/non-positive/unsafe integer rejection behavior,
- add regression coverage for whitespace-padded runtime context-value rejection.

**Result:** Pods model-start runtime context parsing now preserves strict context identifier identity and rejects whitespace-padded alias/numeric context values instead of silently normalizing malformed inputs.

---

### 434) ai CLI provider selection parsing normalized whitespace-padded numeric values

**Finding:** `packages/ai/src/cli-selection.ts` trimmed interactive provider-selection input before numeric validation, so whitespace-padded numeric selections could be silently accepted instead of rejected as malformed provider-selection identifiers.

**Action:** Updated:

- `packages/ai/src/cli-selection.ts`
- `packages/ai/test/cli-selection.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict selection-string identity (`trimmed === value`) before numeric parsing,
- reject whitespace-padded numeric selections instead of trimming/coalescing malformed selection identifiers,
- preserve existing non-decimal, out-of-range, and unsafe-integer rejection behavior,
- add regression coverage for whitespace-padded selection rejection.

**Result:** AI CLI provider selection parsing now preserves strict selection identifier identity and rejects whitespace-padded numeric selections instead of silently normalizing malformed input.

---

### 435) mom model env override parsing normalized whitespace-padded identifiers

**Finding:** `packages/mom/src/agent.ts` trimmed model provider/id environment override values before selection, so whitespace-padded provider/model override identifiers could be silently accepted instead of rejected as malformed override identifiers.

**Action:** Updated:

- `packages/mom/src/agent.ts`
- `packages/mom/test/agent-model.test.ts`
- `packages/mom/CHANGELOG.md`

to:

- require strict override-string identity (`trimmed === value`) when resolving environment-provided model provider/id overrides,
- reject whitespace-padded provider/model overrides instead of trimming/coalescing malformed override identifiers,
- preserve existing fallback-to-default behavior for missing/blank overrides,
- add regression coverage demonstrating whitespace-padded invalid override identifiers are ignored in favor of defaults.

**Result:** Mom model override parsing now preserves strict provider/model override identifier identity and rejects whitespace-padded override values instead of silently normalizing malformed env input.

---

### 436) pods built-in model config parser normalized whitespace-padded env values

**Finding:** `packages/pods/src/model-configs.ts` trimmed `models.json` env values before normalization, so whitespace-padded env values could be silently accepted/coalesced instead of rejected as malformed env-value identifiers.

**Action:** Updated:

- `packages/pods/src/model-configs.ts`
- `packages/pods/test/model-configs.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require strict env-value identity (`trimmed === value`) when normalizing `models.json` env values,
- reject whitespace-padded env values instead of trimming/coalescing malformed values,
- preserve existing model/env-key validation and malformed-config filtering behavior,
- add regression coverage for whitespace-padded env-value rejection in built-in model config normalization.

**Result:** Pods built-in model config parsing now preserves strict env-value identity and rejects whitespace-padded env values instead of silently normalizing malformed configuration values.

---

### 437) pods memory option parsing normalized whitespace-padded values

**Finding:** `packages/pods/src/model-options.ts` accepted whitespace-padded memory option values via trimming (including forms like `" 50% "` and `"50 %"`), silently normalizing malformed memory option identifiers.

**Action:** Updated:

- `packages/pods/src/model-options.ts`
- `packages/pods/test/model-options.test.ts`
- `packages/pods/test/models-ssh-status.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require strict memory-option string identity (`trimmed === value`) before percentage parsing,
- reject whitespace-padded and whitespace-separated percent values instead of trimming/coalescing malformed option identifiers,
- preserve existing decimal-format and precision-safe range validation behavior,
- add regression coverage for whitespace-padded/whitespace-separated memory option rejection in both normalization and runtime model-start memory-fraction parsing paths.

**Result:** Pods memory option parsing now preserves strict memory option identifier formatting and rejects whitespace-padded/separated values instead of silently normalizing malformed input.

---

### 438) coding-agent COLORFGBG parser normalized whitespace-padded palette indices

**Finding:** `packages/coding-agent/src/modes/interactive/theme/theme.ts` trimmed `COLORFGBG` background index values before numeric validation, so whitespace-padded palette indices could be silently accepted instead of rejected as malformed theme-detection metadata.

**Action:** Updated:

- `packages/coding-agent/src/modes/interactive/theme/theme.ts`
- `packages/coding-agent/test/theme-colorfgbg.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict palette-index string identity (`trimmed === value`) before integer parsing,
- reject whitespace-padded background indices instead of trimming/coalescing malformed values,
- preserve existing unsafe-integer/out-of-range/background-index parsing guards,
- add regression coverage for whitespace-padded `COLORFGBG` background index rejection.

**Result:** COLORFGBG theme auto-detection now preserves strict palette-index identity and rejects whitespace-padded background indices instead of silently normalizing malformed env metadata.

---

### 439) ai gemini retry-delay header parsing normalized whitespace-padded numeric values

**Finding:** `packages/ai/src/providers/google-gemini-cli.ts` retry-delay header helpers trimmed numeric header values before validation, so whitespace-padded numeric `Retry-After` / `x-ratelimit-reset` / `x-ratelimit-reset-after` values could be silently accepted instead of rejected as malformed retry-delay metadata.

**Action:** Updated:

- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/google-gemini-cli-retry-delay.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict numeric-header string identity (`trimmed === value`) before header numeric parsing,
- reject whitespace-padded numeric retry-delay header values instead of trimming/coalescing malformed metadata,
- preserve existing non-decimal/unsafe/overflow retry-delay rejection behavior with body-pattern fallback,
- add regression coverage for whitespace-padded retry-delay header rejection.

**Result:** Gemini retry-delay parsing now preserves strict header-value identity and rejects whitespace-padded numeric retry-delay header values instead of silently normalizing malformed metadata.

---

### 440) coding-agent package-manager manifest entry parsing normalized whitespace-padded path/pattern values

**Finding:** `packages/coding-agent/src/core/package-manager.ts` normalized `package.json` `pi.*` manifest entries by trimming each string entry, so whitespace-padded manifest paths/patterns could be silently accepted instead of rejected as malformed manifest identifiers.

**Action:** Updated:

- `packages/coding-agent/src/core/package-manager.ts`
- `packages/coding-agent/test/package-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict manifest-entry string identity (`trimmed === value`) when parsing `pi.extensions` / `pi.skills` / `pi.prompts` / `pi.themes` arrays,
- reject whitespace-padded manifest entries instead of trimming/coalescing malformed manifest path/pattern identifiers,
- preserve existing string-only/non-empty manifest entry filtering behavior,
- add regression coverage for whitespace-padded manifest exclusion-pattern rejection.

**Result:** Package-manager manifest parsing now preserves strict manifest entry identity and rejects whitespace-padded path/pattern entries instead of silently normalizing malformed `pi.*` manifest identifiers.

---

### 441) coding-agent extension-loader manifest entry parsing normalized whitespace-padded path/pattern values

**Finding:** `packages/coding-agent/src/core/extensions/loader.ts` normalized `package.json` `pi.*` manifest entries by trimming each string entry, so whitespace-padded manifest extension paths/patterns could be silently accepted instead of rejected as malformed manifest identifiers.

**Action:** Updated:

- `packages/coding-agent/src/core/extensions/loader.ts`
- `packages/coding-agent/test/extensions-discovery.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict manifest-entry string identity (`trimmed === value`) in extension-loader manifest list parsing,
- reject whitespace-padded manifest entries instead of trimming/coalescing malformed extension path/pattern identifiers,
- preserve existing string-only/non-empty manifest entry filtering and no-fallback behavior for explicitly-declared-but-invalid `pi.extensions`,
- add regression coverage for whitespace-padded `pi.extensions` entry rejection.

**Result:** Extension-loader manifest parsing now preserves strict manifest entry identity and rejects whitespace-padded extension path/pattern entries instead of silently normalizing malformed `pi.*` manifest identifiers.

---

### 442) coding-agent CLI comma-list parsing normalized whitespace-padded model/tool entries

**Finding:** `packages/coding-agent/src/cli/args.ts` trimmed `--models` / `--tools` comma-list entries before filtering, so whitespace-padded model/tool entries could be silently accepted instead of rejected as malformed CLI identifier values.

**Action:** Updated:

- `packages/coding-agent/src/cli/args.ts`
- `packages/coding-agent/test/args.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict comma-list entry identity (`trimmed === value`) for `--models` / `--tools` parsing,
- reject whitespace-padded model/tool entries instead of trimming/coalescing malformed identifiers,
- preserve existing blank-entry filtering and warning behavior when no usable values remain,
- add regression coverage for whitespace-padded model/tool entry rejection.

**Result:** CLI comma-list parsing now preserves strict model/tool identifier identity and rejects whitespace-padded entries instead of silently normalizing malformed flag values.

---

### 443) pods built-in model-config parser normalized whitespace-padded args/gpu-type values

**Finding:** `packages/pods/src/model-configs.ts` trimmed `models.json` `args` and `gpuTypes` array entries before normalization, so whitespace-padded launch args/GPU-type values could be silently accepted instead of rejected as malformed config identifiers.

**Action:** Updated:

- `packages/pods/src/model-configs.ts`
- `packages/pods/test/model-configs.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require strict arg/GPU-type entry identity (`trimmed === value`) when normalizing `models.json` config arrays,
- reject whitespace-padded arg/GPU-type entries instead of trimming/coalescing malformed entries,
- preserve existing string-only/non-empty entry filtering behavior for arg/GPU-type arrays,
- add regression coverage for whitespace-padded arg/GPU-type rejection in built-in model config normalization.

**Result:** Pods built-in model-config parsing now preserves strict arg/GPU-type entry identity and rejects whitespace-padded launch arg/type values instead of silently normalizing malformed configuration entries.

---

### 444) pods persisted config parser normalized whitespace-padded GPU metadata values

**Finding:** `packages/pods/src/config.ts` trimmed persisted GPU `name`/`memory` values during config normalization, so whitespace-padded GPU metadata values could be silently accepted instead of rejected as malformed persisted metadata identifiers.

**Action:** Updated:

- `packages/pods/src/config.ts`
- `packages/pods/test/config.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require strict GPU metadata string identity (`trimmed === value`) for persisted `name` / `memory` fields,
- reject whitespace-padded GPU metadata values instead of trimming/coalescing malformed persisted metadata,
- preserve existing pod/model/GPU structural validation behavior,
- add regression coverage for whitespace-padded persisted GPU metadata rejection.

**Result:** Pods persisted config normalization now preserves strict GPU metadata identity and rejects whitespace-padded `name`/`memory` values instead of silently normalizing malformed persisted metadata.

---

### 445) pods `--pod=<name>` parser normalized whitespace-padded override values

**Finding:** `packages/pods/src/cli-args.ts` trimmed `--pod=<name>` override values before validation, so whitespace-padded pod override identifiers could be silently accepted instead of rejected as malformed CLI override values.

**Action:** Updated:

- `packages/pods/src/cli-args.ts`
- `packages/pods/test/cli-args.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require strict `--pod=<name>` value identity (`trimmed === value`) before applying pod override parsing,
- reject whitespace-padded `--pod=<name>` values instead of trimming/coalescing malformed pod override identifiers,
- preserve existing missing/option-like/duplicate pod-override rejection behavior,
- add regression coverage for whitespace-padded `--pod=<name>` rejection.

**Result:** Pods `--pod=<name>` parsing now preserves strict pod override identifier identity and rejects whitespace-padded override values instead of silently normalizing malformed CLI inputs.

---

### 446) ai Azure deployment-map parser normalized whitespace-padded model/deployment segments

**Finding:** `packages/ai/src/providers/azure-openai-responses.ts` trimmed deployment-map entries/segments before validation, so whitespace-padded model/deployment identifiers could be silently accepted instead of rejected as malformed deployment-map identifiers.

**Action:** Updated:

- `packages/ai/src/providers/azure-openai-responses.ts`
- `packages/ai/test/azure-openai-responses-deployment-map.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict deployment-map entry/segment identity (`trimmed === value`) for model/deployment pairs,
- reject whitespace-padded mapping entries/segments instead of trimming/coalescing malformed identifiers,
- preserve existing blank-key/value entry rejection behavior,
- add regression coverage for whitespace-padded deployment-map segment rejection.

**Result:** Azure deployment-map parsing now preserves strict model/deployment identifier identity and rejects whitespace-padded mapping entries instead of silently normalizing malformed deployment-map config values.

---

### 447) coding-agent resource-loader path resolution normalized whitespace-padded additional paths

**Finding:** `packages/coding-agent/src/core/resource-loader.ts` trimmed additional resource paths before path resolution, so whitespace-padded additional path entries could be silently accepted instead of rejected as malformed resource path identifiers.

**Action:** Updated:

- `packages/coding-agent/src/core/resource-loader.ts`
- `packages/coding-agent/test/resource-loader.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict additional-path identity by resolving raw path entries (without trim-based normalization),
- reject whitespace-padded additional path entries instead of trimming/coalescing malformed resource path identifiers,
- preserve existing `~`/`~/` home expansion behavior for exact path inputs,
- add regression coverage for whitespace-padded additional skill-path rejection.

**Result:** Resource-loader additional-path resolution now preserves strict path identifier identity and rejects whitespace-padded additional paths instead of silently normalizing malformed entries.

---

### 448) coding-agent package-manager local path resolution normalized whitespace-padded source paths

**Finding:** `packages/coding-agent/src/core/package-manager.ts` trimmed local package source paths during path resolution, so whitespace-padded local source paths could be silently accepted instead of rejected as malformed source-path identifiers.

**Action:** Updated:

- `packages/coding-agent/src/core/package-manager.ts`
- `packages/coding-agent/test/package-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- resolve local package paths using exact input identity (no trim-based coalescing) for settings/source matching paths,
- reject whitespace-padded local package source paths instead of trimming/coalescing malformed path identifiers,
- preserve existing `~`/`~/` home path handling for exact path inputs,
- add regression coverage for whitespace-padded local package source path rejection.

**Result:** Package-manager local path resolution now preserves strict source-path identity and rejects whitespace-padded local package paths instead of silently normalizing malformed source-path values.

---

### 449) coding-agent package-manager source parser normalized whitespace-padded npm/git source strings

**Finding:** `packages/coding-agent/src/core/package-manager.ts` trimmed package source strings during npm/local detection, so whitespace-padded npm/git source identifiers could be silently accepted instead of rejected as malformed package source identifiers.

**Action:** Updated:

- `packages/coding-agent/src/core/package-manager.ts`
- `packages/coding-agent/test/package-manager.test.ts`
- `packages/coding-agent/CHANGELOG.md`

to:

- require strict source-string identity (`trimmed === value`) for npm/git source parsing,
- reject whitespace-padded npm source specs and whitespace-padded git source strings instead of trimming/coalescing malformed source identifiers,
- preserve existing valid npm/git/local parsing behavior for exact input values,
- add regression coverage for whitespace-padded npm/git source rejection.

**Result:** Package-manager source parsing now preserves strict source identifier identity and rejects whitespace-padded npm/git source strings instead of silently normalizing malformed package source literals.

---

### 450) ai Azure base-url/resource-name resolver normalized whitespace-padded option/env values

**Finding:** `packages/ai/src/providers/azure-openai-responses.ts` trimmed Azure base URL option/env values before resolution, so whitespace-padded endpoint config values could be silently accepted instead of rejected as malformed endpoint identifiers.

**Action:** Updated:

- `packages/ai/src/providers/azure-openai-responses.ts`
- `packages/ai/test/azure-openai-responses-headers.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict option/env string identity (`trimmed === value`) for Azure `azureBaseUrl` / `AZURE_OPENAI_BASE_URL` and `azureResourceName` / `AZURE_OPENAI_RESOURCE_NAME` parsing,
- reject whitespace-padded endpoint config values instead of trimming/coalescing malformed endpoint identifiers,
- preserve existing fallback precedence (`options` → `env` → `resource` → `model.baseUrl`) and base URL normalization behavior,
- add regression coverage for whitespace-padded option/env base URL rejection fallback.

**Result:** Azure endpoint config resolution now preserves strict endpoint identifier identity and rejects whitespace-padded base-url/resource-name values instead of silently normalizing malformed config.

---

### 451) pods built-in model-config parser normalized whitespace-padded name/notes metadata

**Finding:** `packages/pods/src/model-configs.ts` trimmed built-in `models.json` metadata strings (`name`, top-level `notes`, config-level `notes`) before normalization, so whitespace-padded metadata identifiers could be silently accepted instead of rejected as malformed model metadata values.

**Action:** Updated:

- `packages/pods/src/model-configs.ts`
- `packages/pods/test/model-configs.test.ts`
- `packages/pods/CHANGELOG.md`

to:

- require strict metadata string identity (`trimmed === value`) for built-in model `name`/`notes` normalization,
- reject whitespace-padded `name`/`notes` values instead of trimming/coalescing malformed metadata identifiers,
- preserve existing malformed model/config entry filtering behavior,
- add regression coverage for whitespace-padded model `name` rejection and config `notes` rejection behavior.

**Result:** Pods built-in model-config parsing now preserves strict metadata identifier identity and rejects whitespace-padded model `name`/`notes` values instead of silently normalizing malformed metadata entries.

---

### 452) ai Google Gemini CLI endpoint resolver normalized whitespace-padded model base URLs

**Finding:** `packages/ai/src/providers/google-gemini-cli.ts` trimmed model `baseUrl` values before endpoint selection, so whitespace-padded endpoint identifiers could be silently accepted instead of rejected as malformed provider endpoint values.

**Action:** Updated:

- `packages/ai/src/providers/google-gemini-cli.ts`
- `packages/ai/test/google-gemini-cli-empty-stream.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict model `baseUrl` identity (`trimmed === value`) before endpoint selection,
- reject whitespace-padded `baseUrl` values instead of trimming/coalescing malformed endpoint identifiers,
- preserve existing endpoint fallback precedence (model base URL → provider defaults/antigravity fallback chain),
- add regression coverage proving whitespace-padded model `baseUrl` values fall back to default endpoint routing.

**Result:** Google Gemini CLI endpoint resolution now preserves strict model endpoint identifier identity and rejects whitespace-padded `baseUrl` values instead of silently normalizing malformed endpoint config.

---

### 453) ai OpenAI Codex endpoint resolver normalized whitespace-padded model base URLs

**Finding:** `packages/ai/src/providers/openai-codex-responses.ts` accepted model `baseUrl` values with trim-based non-empty checks, so whitespace-padded endpoint identifiers could be silently normalized/used instead of rejected as malformed endpoint values.

**Action:** Updated:

- `packages/ai/src/providers/openai-codex-responses.ts`
- `packages/ai/test/openai-codex-responses-parsing.test.ts`
- `packages/ai/CHANGELOG.md`

to:

- require strict model `baseUrl` identity (`trimmed === value`) before Codex endpoint URL construction,
- reject whitespace-padded model `baseUrl` values instead of trimming/coalescing malformed endpoint identifiers,
- preserve existing Codex endpoint normalization behavior for valid base URLs,
- add regression coverage proving whitespace-padded model `baseUrl` values fall back to the default Codex endpoint.

**Result:** OpenAI Codex endpoint resolution now preserves strict endpoint identifier identity and rejects whitespace-padded model `baseUrl` values instead of silently normalizing malformed endpoint config.

## Validation Evidence

- Root quality gate passes:
  - `npm run check`
- ai CLI selection parser regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/cli-selection.test.ts` (includes whitespace-padded selection rejection coverage)
- ai model-generator numeric parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/generate-models.test.ts`
- ai Azure deployment-map parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/azure-openai-responses-deployment-map.test.ts test/azure-openai-responses-headers.test.ts` (includes Azure OpenAI Responses whitespace-padded deployment-map segment rejection, whitespace-padded base-url option/env rejection fallback coverage, and custom-header rejection coverage)
- ai auth-file parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/auth-file.test.ts` (includes whitespace-padded provider-key rejection and oauth token-field rejection coverage)
- mom slack timestamp normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/slack-timestamp.test.ts` (includes near-safe-integer decimal timestamp exact millisecond flooring coverage without floating-point drift and whitespace-padded timestamp rejection coverage)
- mom slack timestamp runtime-shape guard regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/slack-timestamp.test.ts test/store.test.ts`
- mom slack log-line timestamp extraction regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/slack-log-timestamp-parse.test.ts test/slack-timestamp.test.ts` (includes whitespace-padded persisted-log `ts` rejection coverage)
- mom channel-store timestamp parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/store.test.ts` (includes whitespace-padded last-log-line `ts` rejection coverage)
- mom settings normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/context-settings.test.ts test/store.test.ts` (includes whitespace-padded `defaultProvider`/`defaultModel` rejection coverage)
- mom context sync timestamp regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/context-sync.test.ts test/context-settings.test.ts test/store.test.ts` (includes whitespace-padded persisted `ts` rejection coverage during log-to-session sync)
- web-ui model discovery + archive-index numeric parsing regression tests pass:
  - `cd packages/web-ui && npx tsx --test test/model-discovery.test.ts test/archive-index.test.ts` (includes malformed llama.cpp/vLLM response-root rejection, whitespace-padded model-id rejection, whitespace-padded numeric metadata fallback coverage, and mixed valid+invalid model-row filtering coverage)
- tui kitty CSI-u + overlay percentage parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test -- test/editor-kitty-csiu.test.ts`
  - `cd packages/tui && node --test --import tsx test/overlay-options.test.ts`
- tui overlay precision-overflow and non-finite numeric layout-input regression tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test -- test/overlay-options.test.ts`
- tui key parser Kitty unsafe-integer regression tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test -- test/keys.test.ts`
- tui ANSI wrap style-tracker regression tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test -- test/wrap-ansi.test.ts`
- tui cell-size response parsing regression tests pass:
  - `cd packages/tui && node --test --import tsx test/tui-cell-size-response.test.ts`
- tui stdin-buffer timeout normalization regression tests pass (including positive-infinite timeout clamping):
  - `npm --workspace "@mariozechner/pi-tui" test -- test/stdin-buffer.test.ts`
- tui terminal drain-input timeout normalization regression tests pass (including positive-infinite duration clamping):
  - `npm --workspace "@mariozechner/pi-tui" test -- test/terminal-timeouts.test.ts`
- coding-agent changelog/export-color parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/changelog-utils.test.ts test/export-html-color-parsing.test.ts` (includes whitespace-padded changelog `lastVersion` rejection coverage)
- coding-agent CLI comma-list parsing regression tests pass (including blank-only `--models`/`--tools` warning behavior):
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/args.test.ts` (includes whitespace-padded model/tool comma-entry rejection coverage)
- coding-agent tool numeric-parameter safety regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/execution-plan.test.ts test/read-tool.test.ts test/tool-numeric-parameter-safety.test.ts`
- coding-agent settings-selector numeric parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/settings-selector.test.ts` (includes whitespace-padded numeric selector value rejection coverage)
- coding-agent theme hex validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-hex-validation.test.ts test/theme-colorfgbg.test.ts`
- coding-agent COLORFGBG range regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-colorfgbg.test.ts` (includes whitespace-padded background-index rejection coverage)
- coding-agent export theme color resolution regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-export-colors.test.ts test/theme-hex-validation.test.ts test/theme-colorfgbg.test.ts`
- coding-agent export missing `$var` regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-export-colors.test.ts`
- coding-agent export malformed hex-color regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-export-colors.test.ts`
- coding-agent export plain missing-variable regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/theme-export-colors.test.ts`
- ai usage metadata regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-gemini-cli-usage-metadata.test.ts` (includes fractional and whitespace-padded usage-token rejection coverage for Gemini CLI / Antigravity usage metadata)
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-usage-metadata.test.ts` (includes fractional and whitespace-padded usage-token rejection coverage for Google / Vertex shared usage metadata)
- ai Gemini retry-delay (including safe-millisecond bounds) regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-gemini-cli-retry-delay.test.ts` (includes whitespace-padded retry-delay header rejection coverage)
- ai usage safe-integer parser regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-responses-shared-usage.test.ts test/amazon-bedrock-usage.test.ts test/google-usage-metadata.test.ts test/google-gemini-cli-usage-metadata.test.ts test/openai-completions-tool-choice.test.ts test/github-copilot-anthropic.test.ts`
- ai shared usage parser regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-usage-metadata.test.ts test/amazon-bedrock-usage.test.ts test/openai-responses-shared-usage.test.ts` (includes OpenAI Responses malformed `thinkingSignature` replay suppression coverage and Google/Bedrock/OpenAI shared fractional + whitespace-padded usage-token rejection coverage)
- ai streaming JSON parser regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/json-parse.test.ts`
- ai OpenAI Completions thought-signature normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-completions-tool-result-images.test.ts`
- ai OpenAI/Anthropic usage parser regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-completions-tool-choice.test.ts test/github-copilot-anthropic.test.ts` (includes OpenAI Completions + Anthropic fractional usage-token rejection coverage, OpenAI Completions + Anthropic whitespace-padded usage-token rejection coverage, and OpenAI Completions + Anthropic whitespace-padded custom-header rejection coverage)
- ai OpenAI Responses header validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-responses-headers.test.ts` (includes model/options whitespace-padded custom-header rejection coverage)
- mom model/key resolution regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/agent-model.test.ts` (includes whitespace-padded provider/model env override rejection coverage)
- pods required-option parser regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/cli-options.test.ts test/cli-args.test.ts` (includes whitespace-padded `--pod=<name>` rejection coverage)
- pods model-option parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/model-options.test.ts` (includes whitespace-padded `--context`/`--gpus` rejection coverage)
- pods memory normalization canonical-format regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/model-options.test.ts` (includes whitespace-padded/whitespace-separated memory option rejection coverage)
- pods memory precision-overflow regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/model-options.test.ts test/models-ssh-status.test.ts` (includes runtime whitespace-padded `--context` and `--memory` rejection coverage)
- pods process-identifier safe-integer regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/process-identifiers.test.ts`
- pods GPU CSV parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/pods-gpu-output.test.ts`
- pods config normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/config.test.ts` (includes whitespace-padded pod/model key rejection, whitespace-padded persisted model-identifier rejection, whitespace-padded `modelsPath` rejection, whitespace-padded `ssh` rejection, whitespace-padded GPU metadata rejection, and active-selector rejection coverage)
- pods model-config normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/model-configs.test.ts test/config.test.ts` (includes whitespace-padded model/env key, env-value, args, GPU-type, and model `name`/`notes` rejection coverage)
- pods package-metadata normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/package-metadata.test.ts test/model-configs.test.ts test/config.test.ts` (includes strict semver version parsing + whitespace/non-semver fallback coverage)
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
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts test/grep-json-parse.test.ts`
- coding-agent bash timeout validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts`
- coding-agent bash oversized-timeout regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools.test.ts`
- coding-agent shared exec oversized-timeout regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/exec.test.ts`
- coding-agent shared sleep oversized-timeout regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/sleep.test.ts`
- coding-agent RPC dialog timeout normalization tests pass (including positive-infinite timeout clamping):
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/rpc-mode-timeout.test.ts` (includes whitespace-padded command-type and extension-response-id rejection coverage)
- coding-agent RPC client timeout normalization tests pass (including invalid non-positive fallback behavior):
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/rpc-client-timeout.test.ts`
- agent spawnScript oversized-timeout regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/sub-agent.test.ts`
- agent CLI integer option parser regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/cli-number.test.ts` (includes whitespace-padded numeric option rejection coverage)
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
- mom one-shot scheduling helper tests pass (including positive-infinite delay clamping/chunking):
  - `npm --workspace "@mariozechner/pi-mom" test -- test/events-scheduling.test.ts`
- mom events payload parsing normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/events-parse.test.ts test/events-scheduling.test.ts` (includes one-shot ISO-8601 timezone requirement, timezone-less/numeric timestamp rejection, whitespace-padded identifier/schedule field rejection coverage, and event-text whitespace preservation coverage)
- mom read-tool line-count regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/read-tool.test.ts`
- mom bash timeout validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/bash-tool.test.ts`
- agent project-runner args regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/project-runner.test.ts`
- agent runner args regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/runner.test.ts`
- agent project-loop JSON task normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/project-loop.test.ts` (includes malformed JSON entry filtering and markdown fallback when JSON snippets contain no actionable tasks)
- agent proxy SSE data-prefix parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/proxy.test.ts` (includes `data:<json>` parsing and malformed-SSE-JSON diagnostic coverage)
- mom sandbox regression tests pass:
  - `npm --workspace "@mariozechner/pi-mom" test -- test/sandbox.test.ts`
- pods SSH/SCP parser regression tests pass:
  - `npm --workspace "@mariozechner/pi" test -- test/ssh-parse.test.ts`
- AI package tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test`
- agent spawnScript regression tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/sub-agent.test.ts` (includes signal-exit non-zero semantics and forced-kill fallback for SIGTERM-resistant children)
- coding-agent RPC startup/shutdown regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/rpc-client.test.ts` (includes startup failures, pending-request rejection on stop and unexpected exit, stop timeout forced-kill cleanup, send timeout/write-error cleanup, closed-stdin send handling, exit-listener cleanup assertions, malformed/non-object stream payload suppression, unmatched response-frame filtering, and whitespace-padded response/event-type identifier rejection)
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
- coding-agent settings manager normalization regression tests pass (numeric + boolean + enum + string/list settings + malformed root-shape handling):
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/settings-manager.test.ts`
- coding-agent package metadata normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/config-package-metadata.test.ts test/settings-manager.test.ts` (includes whitespace-padded package-metadata field rejection coverage)
- coding-agent extension discovery manifest normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/extensions-discovery.test.ts` (includes malformed-only/whitespace-padded `pi.extensions` declaration no-fallback-to-index coverage)
- coding-agent keybindings config normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/keybindings.test.ts test/settings-manager.test.ts` (includes whitespace-padded keybinding identifier rejection coverage)
- coding-agent auth storage normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/auth-storage.test.ts` (includes whitespace-padded provider-key plus api-key/oauth token-field rejection coverage)
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
  - `npm --workspace "@mariozechner/pi-ai" test -- test/anthropic-oauth-abort.test.ts` (includes malformed exchange-root, malformed refresh-field payload, whitespace-padded token-field rejection, and fractional `expires_in` rejection coverage)
- ai antigravity oauth token payload parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-antigravity-oauth-abort.test.ts` (includes malformed exchange-root, malformed refresh-field payload, whitespace-padded access-token rejection, whitespace-padded refresh-token fallback-retention coverage, whitespace-padded discovered-project identifier rejection coverage, whitespace-padded profile-email rejection coverage, and fractional `expires_in` rejection coverage)
- ai gemini-cli oauth token payload parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-gemini-cli-oauth-abort.test.ts` (includes malformed exchange-root, malformed refresh-field payload, whitespace-padded access-token rejection, whitespace-padded refresh-token fallback-retention coverage, whitespace-padded discovered-project identifier rejection coverage, whitespace-padded profile-email rejection coverage, and fractional `expires_in` rejection coverage)
- ai github-copilot oauth payload parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/github-copilot-oauth-payload.test.ts` (includes malformed device-code/poll/token payload field rejection, whitespace-padded token/code/error identifier rejection coverage, and fractional interval/expiry rejection coverage)
- ai openai-codex oauth startup/manual-flow/cancellation/base64url-decoding/hash-fragment/non-object-token-payload parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-codex-oauth-abort.test.ts` (includes malformed exchange/refresh JSON-body parse failure normalization, whitespace-padded token-field rejection, and fractional `expires_in` rejection coverage)
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
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/proxy.test.ts` (includes trailing SSE line without newline, malformed JSON diagnostics, malformed JSON-root-shape filtering, malformed typed-event field-shape filtering, whitespace-padded typed-event identifier rejection, and fractional token-counter rejection with decimal-cost preservation coverage)
- ai Gemini CLI SSE regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/google-gemini-cli-empty-stream.test.ts` (includes terminal `data:` line without trailing newline, malformed + whitespace-padded credential-field rejection, whitespace-padded model `baseUrl` rejection fallback coverage, and malformed non-object SSE chunk-root filtering coverage)
- ai Codex/Gemini SSE regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-codex-stream.test.ts test/google-gemini-cli-empty-stream.test.ts` (includes Codex base64url JWT payload account-id extraction coverage and malformed custom-header-name rejection coverage)
- ai Codex Responses payload-shape parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test -- test/openai-codex-responses-parsing.test.ts test/openai-codex-stream.test.ts` (includes malformed non-object SSE/WebSocket event-root filtering, malformed usage-limit error-field-shape friendly-message coverage, whitespace-padded usage-limit identifier rejection coverage, and whitespace-padded model `baseUrl` rejection fallback coverage)
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
- coding-agent resource-loader additional-path normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/resource-loader.test.ts` (includes whitespace-padded additional skill-path rejection coverage)
- coding-agent package-manager command-settlement regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/package-manager.test.ts` (includes async settlement coverage, full async command-invocation diagnostics, sync spawn-start failure diagnostics, and signal-exit rejection diagnostics)
- coding-agent package-manager manifest normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/package-manager.test.ts` (includes malformed `pi.extensions` entry filtering, whitespace-padded manifest pattern rejection, whitespace-padded local source-path rejection, whitespace-padded npm/git source-string rejection, mixed valid+invalid manifest pattern handling, and installed-version shape normalization coverage)
- coding-agent package-manager npm-registry version parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/package-manager-registry-version.test.ts test/package-manager.test.ts` (includes malformed npm-registry `version` root/field-shape rejection, strict semver acceptance, and whitespace-padded/non-semver version literal rejection coverage)
- coding-agent managed-tool release-version parsing regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/tools-manager-version-parse.test.ts` (includes malformed GitHub latest-release payload rejection, whitespace-padded tag-name rejection, and `v`-prefix normalization coverage)
- coding-agent model-registry provider-key validation regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/model-registry.test.ts` (includes blank and whitespace-padded provider-key rejection coverage for malformed `models.json` provider maps)
- coding-agent migration parsing normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/migrations.test.ts` (includes oauth legacy-file preservation, malformed oauth credential-shape rejection, whitespace-padded provider-key rejection, whitespace-padded legacy api-key value rejection, and whitespace-padded session-header relocation rejection coverage)
- coding-agent session-manager JSONL line-shape normalization regression tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/session-manager/file-operations.test.ts` (includes non-object/type-less line filtering, whitespace-padded entry-type rejection, and blank/whitespace-padded session-id header rejection in load/list/recent-session checks)
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
  - `npm --workspace "@mariozechner/pi-coding-agent" test -- test/resolve-config-value.test.ts` (covers blank-command short-circuit, cache-key normalization, empty env-var handling, and whitespace-padded header-name rejection)
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
