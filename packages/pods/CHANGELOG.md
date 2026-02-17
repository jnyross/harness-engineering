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

### Fixed

- Implemented `pi agent` delegation by wiring pods model endpoints into coding-agent via a temporary runtime provider extension.
- Added graceful validation for missing `--pod` overrides in `pi agent`.
- Ensured delegated agent failures propagate with non-zero exit codes instead of reporting success.
- Prevented conflicting `--provider` / `--model` overrides in `pi agent` mode so routing stays bound to selected pod model.
- Avoided writing resolved API keys into temporary extension files by passing keys through child-process environment only.
- Switched delegated provider naming to unique per-run IDs (`pods-vllm-<random>`) to avoid provider namespace collisions.
- Replaced deep `process.exit` paths in `pi agent` prompt delegation with thrown errors for consistent top-level CLI error handling and cleanup behavior.
- Hardened `--pod` argument parsing for model commands by supporting `--pod=<name>`, rejecting missing/duplicate `--pod` flags with clear errors, respecting `--` passthrough boundaries, and rejecting `--pod` on non-model commands.
- Updated reserved `--provider`/`--model` validation to stop at `--`, preserving option-terminator semantics for literal passthrough arguments.
- Replaced implicit `"dummy"` API key fallback in `pi agent` with an explicit `PI_API_KEY` requirement and actionable error message.
- Kept unknown-command errors authoritative even when `--pod` is present, avoiding misleading pod-flag validation failures for unsupported commands.
- Extracted CLI pod-override parsing into reusable helpers and added targeted Node test coverage for command-name and pod-flag parsing behavior.
- Standardized pods command guidance/error text to use the actually invoked binary name (`pi`, `pi-pods`, wrappers), including delegated command hints in models/prompt/pods flows.
- Added targeted tests for shared CLI command context helpers to guard dynamic command-name rendering behavior.
- Extracted prompt argument helpers (`findReservedFlag`, dynamic provider-name generation) into a reusable module with dedicated tests.
- Added shared process-exit helper handling both `exit` and spawn `error` events for model log streaming flows, avoiding hangs when SSH command spawning fails.
- `pi shell` now handles SSH spawn startup failures via explicit process `error` handling, surfacing clear errors instead of unhandled child-process failures.
- Reused validated SSH command parsing for `pi shell` and model-log streaming (`start`/`logs`) so non-SSH binaries are rejected consistently before command execution.
- SSH execution helpers and `pi shell` now treat signal-terminated SSH child processes as non-zero exits, avoiding false success reporting on interrupted SSH sessions.
- Shared `waitForProcessExit()` now treats signal-terminated child exits as non-zero results, avoiding false success semantics in process-monitoring flows.

