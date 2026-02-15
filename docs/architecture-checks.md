# Architecture Checks

The `scripts/check-architecture.ts` script enforces structural constraints across the monorepo.

## What Gets Checked

### 1. Dependency Hierarchy

Ensures packages can only depend on allowed packages:

```
pi-tui (no dependencies)
  └─> pi-ai
        └─> pi-agent-core
              └─> pi-coding-agent
                    └─> pi-mom
pi-web-ui (depends on ai + tui)
pi-pods (depends on agent-core)
```

The script reads each package's `package.json` and verifies:
- No circular dependencies
- No forbidden dependency paths
- All dependencies are within the monorepo when applicable

### 2. Lockstep Versions

Ensures all packages share the same version number:
- Reads `version` from each `packages/*/package.json`
- Compares all versions
- Fails if any package has a different version

### 3. Strict TypeScript

Ensures all packages have strict mode enabled:
- Checks `compilerOptions.strict: true` in each `tsconfig.json`
- Prevents relaxing type safety

## Running Architecture Checks

```bash
# Run just architecture checks
npx tsx scripts/check-architecture.ts

# Run with full check
npm run check
```

## Exit Codes

- `0`: All checks passed
- `1`: One or more checks failed

## Adding New Checks

To add new architecture constraints:

1. Edit `scripts/check-architecture.ts`
2. Add new check function
3. Call it in the main `check()` function
4. Add documentation above the new check
