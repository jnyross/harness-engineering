# Architecture boundaries

This file defines hard boundaries enforced by `scripts/check-architecture.ts`. No package may depend on an internal package unless listed below.

## Dependency hierarchy

- **@mariozechner/pi-ai** — No internal deps (foundation).
- **@mariozechner/pi-tui** — No internal deps.
- **@mariozechner/pi-agent-core** — May depend on: `@mariozechner/pi-ai`.
- **@mariozechner/pi-coding-agent** — May depend on: `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, `@mariozechner/pi-tui`.
- **@mariozechner/pi-mom** — May depend on: `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, `@mariozechner/pi-coding-agent`.
- **@mariozechner/pi** — May depend on: `@mariozechner/pi-agent-core`.
- **@mariozechner/pi-web-ui** — May depend on: `@mariozechner/pi-ai`, `@mariozechner/pi-tui`.

Any other internal dependency is forbidden.

## Version and strict mode

- All packages use lockstep versioning (single version number).
- Every package must have `packages/<name>/tsconfig.build.json` extending `tsconfig.base.json` or set `strict: true`; `strict: false` is not allowed.

## Adding a new package

Add the package to the `ALLOWED_INTERNAL_DEPS` map in `scripts/check-architecture.ts` and list its allowed internal dependencies. Update this file to match.
