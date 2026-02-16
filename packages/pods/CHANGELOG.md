# Changelog

## [Unreleased]

### Fixed

- Implemented `pi agent` delegation by wiring pods model endpoints into coding-agent via a temporary runtime provider extension.
- Added graceful validation for missing `--pod` overrides in `pi agent`.
- Ensured delegated agent failures propagate with non-zero exit codes instead of reporting success.
- Prevented conflicting `--provider` / `--model` overrides in `pi agent` mode so routing stays bound to selected pod model.
- Avoided writing resolved API keys into temporary extension files by passing keys through child-process environment only.
- Switched delegated provider naming to unique per-run IDs (`pods-vllm-<random>`) to avoid provider namespace collisions.
- Replaced deep `process.exit` paths in `pi agent` prompt delegation with thrown errors for consistent top-level CLI error handling and cleanup behavior.
- Hardened `--pod` argument parsing for model commands by supporting `--pod=<name>`, rejecting missing/duplicate `--pod` flags with clear errors, respecting `--` passthrough boundaries, and rejecting `--pod` on non-model commands.

