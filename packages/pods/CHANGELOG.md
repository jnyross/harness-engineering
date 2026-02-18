# Changelog

## [Unreleased]

### Changed

- Clarified pods README prerequisite to match package engines (`Node.js 20+`).
- Documented that the published binary name is `pi-pods` and provided an alias pattern for `pi`.
- Made CLI help/usage text render the invoked command name dynamically (`pi`, `pi-pods`, etc.) to avoid command-name confusion.
- Updated standalone agent docs to reference the separate `@mariozechner/pi-coding-agent` CLI invocation instead of the removed `pi-agent` command.
- Added a package-level `npm test` script for pods to run the new CLI/prompt helper regression tests via Node's test runner.
- Added validated model-instance name handling (`[A-Za-z0-9._-]`, 1-64 chars) in model start/stop/log flows to prevent unsafe shell interpolation.
- Added model-id validation in `pi start` (`[A-Za-z0-9._/-]`, 1-128 chars) to reject unsafe shell-interpolated model identifiers before remote command execution.
- Added strict `--memory` and `--context` option normalization/validation to reject invalid values before launching model runs.
- Shell-quoted custom vLLM arguments and exported runtime environment values before script upload so values with spaces/quotes/metacharacters are passed as literal data instead of raw shell fragments.
- Shell-quoted pod setup command arguments (`--models-path`, `--hf-token`, `--vllm-api-key`, `--mount`) to avoid unsafe SSH command interpolation and improve handling of spaces/quotes.
- Added pod-name validation (`[A-Za-z0-9._-]`, 1-64 chars) across setup/active/remove and `--pod` override parsing with dedicated tests.
- Added PID/port validation for stop/list verification flows to prevent unsafe shell interpolation from malformed persisted model state.
- Replaced naive whitespace splitting of SSH command strings with shell-aware parsing in SSH helpers/interactive shell flow, including attached short-option forms like `-p2222`.
- Updated `pi agent` host resolution to use shell-aware SSH parsing and validate persisted model ports before provider registration.
- Updated mount-command models-path extraction to use shell-aware parsing (handles quoted mount targets with spaces, rejects malformed commands).
- Enforced SSH command binary validation (`ssh` / `*/ssh`) before SSH/SCP execution to prevent accidental local non-SSH command execution from malformed config.
- `pi agent` now rejects pods with invalid SSH command host syntax instead of falling back to localhost endpoint routing.
- Added regression tests for `pi agent` validation failures on malformed SSH host config and invalid persisted model ports.
- Updated package `test` script to `tsx --test` so workspace test runs auto-discover tests while still allowing file-level filtering via `npm test -- <pattern>`.
- Centralized GPU-name parsing in a shared helper used by model config selection and known-model compatibility display, with regression tests.
- SSH command validation now accepts standard `ssh.exe` binary forms (including absolute Windows-style paths with `/` or `\`) in addition to `ssh`.
- Memory-option normalization now uses direct numeric-string conversion after validation, preserving canonical output formatting (for example `50.0%` normalizes to `50%`) without redundant branch logic.
- PID/port validator helpers now require safe integers, rejecting oversized unsafe numeric values before command assembly uses persisted process identifiers.
- Memory percentage parsing now uses precision-safe range validation, rejecting values slightly above 100 that could previously round down during float conversion (for example `100.0000000000000000001`).

### Fixed

- Implemented `pi agent` delegation by wiring pods model endpoints into coding-agent via a temporary runtime provider extension.
- Added graceful validation for missing `--pod` overrides in `pi agent`.
- Ensured delegated agent failures propagate with non-zero exit codes instead of reporting success.
- Prevented conflicting `--provider` / `--model` overrides in `pi agent` mode so routing stays bound to selected pod model.
- Avoided writing resolved API keys into temporary extension files by passing keys through child-process environment only.
- Switched delegated provider naming to unique per-run IDs (`pods-vllm-<random>`) to avoid provider namespace collisions.
- Replaced deep `process.exit` paths in `pi agent` prompt delegation with thrown errors for consistent top-level CLI error handling and cleanup behavior.
- Hardened `--pod` argument parsing for model commands by supporting `--pod=<name>`, rejecting missing/duplicate `--pod` flags with clear errors, respecting `--` passthrough boundaries, and rejecting `--pod` on non-model commands.
- `--pod <name>` / `--pod=<name>` parsing now rejects single-dash option-like values (for example `--pod -h`, `--pod=-h`) instead of treating them as literal pod names.
- Updated reserved `--provider`/`--model` validation to stop at `--`, preserving option-terminator semantics for literal passthrough arguments.
- Replaced implicit `"dummy"` API key fallback in `pi agent` with an explicit `PI_API_KEY` requirement and actionable error message.
- Kept unknown-command errors authoritative even when `--pod` is present, avoiding misleading pod-flag validation failures for unsupported commands.
- Extracted CLI pod-override parsing into reusable helpers and added targeted Node test coverage for command-name and pod-flag parsing behavior.
- Standardized pods command guidance/error text to use the actually invoked binary name (`pi`, `pi-pods`, wrappers), including delegated command hints in models/prompt/pods flows.
- Added targeted tests for shared CLI command context helpers to guard dynamic command-name rendering behavior.
- Extracted prompt argument helpers (`findReservedFlag`, dynamic provider-name generation) into a reusable module with dedicated tests.
- Added shared process-exit helper handling both `exit` and spawn `error` events for model log streaming flows, avoiding hangs when SSH command spawning fails.
- `pi shell` now handles SSH spawn startup failures via explicit process `error` handling, surfacing clear errors instead of unhandled child-process failures.
- `pi shell` now uses single-settlement handling across SSH child `error`/`exit` events, preventing duplicate exit paths while preserving propagated non-zero SSH exit codes.
- Reused validated SSH command parsing for `pi shell` and model-log streaming (`start`/`logs`) so non-SSH binaries are rejected consistently before command execution.
- SSH execution helpers and `pi shell` now treat signal-terminated SSH child processes as non-zero exits, avoiding false success reporting on interrupted SSH sessions.
- Shared `waitForProcessExit()` now treats signal-terminated child exits as non-zero results, avoiding false success semantics in process-monitoring flows.
- SSH/SCP wrappers now use single-settlement guards across `close`/`error` events, preventing duplicate resolve races during spawn/exit edge cases.
- SCP wrapper now treats signal-terminated copy subprocesses as explicit failures, avoiding ambiguous success on interrupted transfer processes.
- Shared process-exit helper now resolves immediately for already-exited child processes, preventing hangs when listeners attach after fast process termination.
- `pi agent` delegated command spawning now uses single-settlement `error`/`close` handling and clearer startup-failure diagnostics when the delegated CLI command cannot be launched.
- Model-start/log streaming now begins `waitForProcessExit()` observation immediately after SSH process spawn, preventing early spawn-error races from slipping past log-monitoring handlers.
- `pi shell` now normalizes signal-terminated SSH child exits as non-zero and surfaces explicit signal-termination diagnostics instead of silently exiting with code-only output.
- shared child-exit normalization now treats unknown `code=null`/`signal=null` exits as non-zero, preventing ambiguous success semantics in process-exit monitoring paths.
- `pi agent` delegated prompt command errors now include full invoked command context and normalize `close(code=null, signal=null)` outcomes to explicit unknown-status failures instead of ambiguous `code null` diagnostics.
- SSH helper wrappers (`sshExec`, `sshExecStream`) now reuse shared child-exit normalization so unknown `code=null`/`signal=null` subprocess exits are treated as non-zero failures.
- Model startup/log streaming now treats non-zero SSH tail stream exits as explicit failures (unless user-interrupted), surfacing clear diagnostics instead of silently reporting that streams merely ended.
- SCP setup-script copy now forwards compatible SSH options (e.g. identity/config/port) into `scp` invocation and surfaces explicit parse/startup/signal/unknown-status diagnostics instead of a generic copy-failed message during `pods setup`.
- Streaming SSH command execution now exposes parse/startup/signal/unknown-status diagnostics to CLI/setup callers, so `pi ssh` and `pods setup` surface explicit failure causes before exiting non-zero.
- Non-streaming SSH execution now adds fallback stderr diagnostics for startup failures, signal exits, and stderr-less non-zero exits, so callers no longer receive empty error output on remote command failures.
- Non-streaming SSH execution fallback diagnostics now include full invoked command context for signal/non-zero exits, improving troubleshooting of failing remote command invocations.
- SCP startup failures now include full invoked-command context in diagnostics (e.g., quoted args + destination), improving troubleshooting when `scp` cannot be launched.
- Interactive `pi shell` now surfaces explicit SSH failure reasons (signal/non-zero/unknown) and startup command context instead of exiting silently with only a status code.
- `pi agent` delegated close-status failures now include the full invoked command in signal/unknown/non-zero diagnostics, improving troubleshooting for remote delegated CLI exits after successful spawn.
- Model start/stop/list flows now fail fast on non-zero SSH command results (with stderr/stdout/exit-code diagnostics) instead of silently continuing with generic errors or stale config cleanup after SSH failures.
- CLI pod-shell/ssh command paths now use top-level `Pod` type imports (instead of inline `import("./types").Pod` annotations), aligning with static import conventions used across the monorepo.
- Pod setup SSH preflight/GPU-detection now surfaces explicit stderr/stdout/exit-code diagnostics; GPU detection failures are warned with actionable context instead of silently reporting zero GPUs.
- Model log-stream failure diagnostics now include the full invoked SSH tail command context in startup/live-log paths, making spawn/exit troubleshooting actionable without reproducing command construction manually.
- Interactive `pi shell` exit diagnostics now include the full invoked SSH command context for signal/non-zero/unknown exits, matching startup-failure diagnostic detail.
- Streaming SSH helper startup failures now include full invoked command context (`ssh ... <remote-command>`), so `pi ssh`/setup callers see actionable spawn diagnostics.
- `--context` normalization now rejects mixed alphanumeric inputs (for example `4096tokens`) instead of truncating via `parseInt`, ensuring only aliases or positive integer token counts are accepted.
- `--gpus` option parsing now rejects mixed/non-numeric values (for example `2gpu`) instead of truncating via `parseInt`, ensuring only positive integer GPU counts are accepted.
- `--context` and `--gpus` numeric parsing now rejects unsafe integer values (greater than `Number.MAX_SAFE_INTEGER`) instead of silently accepting rounded values.
- model command `--context` resolution now also rejects unsafe integer values (greater than `Number.MAX_SAFE_INTEGER`) instead of silently accepting rounded values.
- CLI required-option parsing now rejects missing values (including single/double-dash option-like next tokens) for `pods setup` and `start` flags, preventing silent fallback when values are omitted.
- `start --vllm` now requires at least one passthrough argument, preventing silent fallback to standard launch options when the flag is provided without values.
- Pod setup GPU detection now skips malformed `nvidia-smi` CSV lines (with warning) instead of persisting `NaN` GPU IDs from partially parseable output.
- Pod setup GPU detection now parses names using first/last CSV fields (id/memory), preserving GPU names that contain commas.
- Pod setup GPU detection now also preserves memory fields that contain thousands separators (for example `80,000 MiB`) instead of mis-splitting the memory comma into the GPU name.
- Pod setup GPU detection now rejects unsafe integer GPU IDs (greater than `Number.MAX_SAFE_INTEGER`) instead of accepting rounded numeric coercions.
- Model start context/PID parsing now uses strict validation (`--context` alias/integer resolution + runner PID parsing) so malformed values like `4096tokens` / `123abc` are rejected instead of being partially coerced via `parseInt`.
- Model start memory parsing now validates percentage values strictly (`0 < value <= 100`) so malformed inputs like `50percent` are rejected instead of being partially coerced.
- Pods config loading now normalizes parsed JSON structure/content (`pods`, `active`, pod/model/GPU entries), ignoring malformed entries and preventing invalid persisted config shapes from propagating into runtime pod selection flows.
- Pods config loading now also rejects whitespace-padded pod/model keys (and whitespace-padded `active` pod selectors) instead of trimming/coalescing them, preserving strict key identity during persisted config normalization.
- Pods config loading now also rejects whitespace-padded persisted model IDs (`models[*].model`) instead of trimming/coalescing malformed model-identifier values.
- Built-in models config loading now normalizes parsed `models.json` structure/content and drops malformed model/config entries instead of forwarding invalid runtime launch config shapes.
- Built-in models config loading now also rejects whitespace-padded model IDs and env keys during normalization, preventing malformed key coalescing when parsing `models.json`.
- `models` command listing now reuses normalized built-in models parsing, so malformed `models.json` content no longer crashes known-model display paths.
- Pods CLI package metadata/version loading now validates `package.json` parsing and falls back safely when malformed metadata is encountered, preventing startup/help/version crashes from invalid package-json shapes.
- Pods package-metadata version parsing now requires strict semver version strings without surrounding whitespace, rejecting malformed/non-semver version values instead of trimming/coercing them during CLI metadata fallback parsing.
- Model start memory parsing now also rejects non-decimal numeric formats (for example `1e2`, `0x10`, `.5`) instead of accepting them via broad numeric coercion.

