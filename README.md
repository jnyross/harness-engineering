# Harness Engineering

A TypeScript monorepo for building AI coding agents with mechanical rule enforcement.

Forked from [badlogic/pi-mono](https://github.com/badlogic/pi-mono). See [PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) for architecture details.

[![CI](https://github.com/jnyross/harness-engineering/actions/workflows/ci.yml/badge.svg)](https://github.com/jnyross/harness-engineering/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@mariozechner/pi-coding-agent)](https://www.npmjs.com/package/@mariozechner/pi-coding-agent)

## Packages

| Package | Description |
|---------|-------------|
| [pi-ai](packages/ai) | Unified multi-provider LLM API (20+ providers) |
| [pi-agent-core](packages/agent) | Agent runtime with tool calling and state management |
| [pi-coding-agent](packages/coding-agent) | Interactive coding agent CLI |
| [pi-mom](packages/mom) | Slack bot powered by the coding agent |
| [pi-tui](packages/tui) | Terminal UI framework with differential rendering |
| [pi-web-ui](packages/web-ui) | Web components for AI chat interfaces |
| [pi-pods](packages/pods) | CLI for managing vLLM deployments on GPU pods |

## Quick Start

```bash
# Install coding agent
npm install -g @mariozechner/pi-coding-agent
export ANTHROPIC_API_KEY=sk-ant-...
pi

# Or use programmatically
npm install @mariozechner/pi-ai @mariozechner/pi-agent-core
```

## Harness Engineering

This fork applies **Harness Engineering** principles: every rule in documentation is backed by mechanical enforcement.

### Mechanical Enforcement

| Rule | Enforcement |
|------|-------------|
| No `any` types | `biome.json`: `noExplicitAny: "error"` |
| Commit message format | `.husky/commit-msg` hook |
| Dependency ordering | `scripts/check-architecture.ts` |
| Lockstep versions | Architecture checks |
| Strict TypeScript | All packages `strict: true` |

### Running Checks

```bash
npm run check    # Biome + TypeScript + architecture checks
npm run build    # Build all packages
npm test         # Run tests
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) for rules.

## License

MIT
