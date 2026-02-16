# Changelog

## [Unreleased]

### Changed

- Clarified pods README prerequisite to match package engines (`Node.js 20+`).
- Documented that the published binary name is `pi-pods` and provided an alias pattern for `pi`.
- Made CLI help/usage text render the invoked command name dynamically (`pi`, `pi-pods`, etc.) to avoid command-name confusion.
- Updated standalone agent docs to reference the separate `@mariozechner/pi-coding-agent` CLI invocation instead of the removed `pi-agent` command.
- Added a package-level `npm test` script for pods to run the new CLI/prompt helper regression tests via Node's test runner.
- Added validated model-instance name handling (`[A-Za-z0-9._-]`, 1-64 chars) in model start/stop/log flows to prevent unsafe shell interpolation.

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

