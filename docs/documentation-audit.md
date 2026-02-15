# Documentation Audit

## Root Documentation

### README.md
- [ ] Still references badlogic/pi-mono (line 16, 21)
- [ ] No mention this is a Harness Engineering fork
- [ ] No link to transformation plans
- [ ] Missing "Mechanical Enforcement" section
- [ ] Missing "Harness Engineering" philosophy section

### AGENTS.md
- [ ] 223 lines (target: ~95 lines)
- [ ] Lines 57-80: Testing pi with tmux - extract to `docs/testing-tmux.md`
- [ ] Lines 88-108: Changelog format - extract to `docs/changelog-format.md`
- [ ] Lines 110-149: Adding New LLM Provider - extract to `docs/adding-provider.md`
- [ ] Lines 152-177: Releasing - extract to `docs/releasing.md`
- [ ] Lines 178-181: Tool Usage Rules - keep inline (critical)
- [ ] Lines 183-223: Git Rules for Parallel Agents - keep inline (critical, safety)
- [ ] Rules about noExplicitAny should note it's now mechanically enforced
- [ ] Commit message format should note it's now linted

### CLAUDE.md
- [ ] Already mentions Harness Engineering fork - looks accurate
- [ ] May need link to PROJECT_OVERVIEW.md for architecture
- [ ] Looks mostly accurate

## Package READMEs

### packages/ai/README.md
- [ ] Review for accuracy
- [ ] Add note about mechanical enforcement

### packages/agent/README.md
- [ ] Review for accuracy
- [ ] Add note about mechanical enforcement

### packages/coding-agent/README.md
- [ ] Review for accuracy
- [ ] Add note about mechanical enforcement
- [ ] Update extension events documentation

### packages/tui/README.md
- [ ] Likely accurate - review briefly

### packages/web-ui/README.md
- [ ] Review for accuracy
- [ ] Add note about mechanical enforcement

### packages/mom/README.md
- [ ] Review for accuracy
- [ ] Add note about mechanical enforcement

### packages/pods/README.md
- [ ] Review for accuracy
- [ ] Add note about mechanical enforcement
- [ ] Check for new model configurations

## CHANGELOGs

### packages/ai/CHANGELOG.md
- [ ] Verify [Unreleased] section is accurate

### packages/agent/CHANGELOG.md
- [ ] Verify [Unreleased] section is accurate

### packages/coding-agent/CHANGELOG.md
- [ ] Verify [Unreleased] section is accurate

### packages/tui/CHANGELOG.md
- [ ] Verify [Unreleased] section is accurate

### packages/web-ui/CHANGELOG.md
- [ ] Verify [Unreleased] section is accurate

### packages/mom/CHANGELOG.md
- [ ] Verify [Unreleased] section is accurate

### packages/pods/CHANGELOG.md
- [ ] Verify [Unreleased] section is accurate

## Missing Documentation

- [ ] docs/adding-provider.md - From AGENTS.md
- [ ] docs/releasing.md - From AGENTS.md
- [ ] docs/testing-tmux.md - From AGENTS.md
- [ ] docs/changelog-format.md - From AGENTS.md
- [ ] docs/mechanical-enforcement.md - List all enforced rules
- [ ] docs/architecture-checks.md - What the architecture tests check
