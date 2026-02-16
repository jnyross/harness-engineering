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

## Validation Evidence

- Root quality gate passes:
  - `npm run check`
- AI package tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test`
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
