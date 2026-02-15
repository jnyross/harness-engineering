# Changelog Format

Location: `packages/*/CHANGELOG.md` (each package has its own)

## Format

Use these sections under `## [Unreleased]`:
- `### Breaking Changes` - API changes requiring migration
- `### Added` - New features
- `### Changed` - Changes to existing functionality
- `### Fixed` - Bug fixes
- `### Removed` - Removed features

## Rules

- Before adding entries, read the full `[Unreleased]` section to see which subsections already exist
- New entries ALWAYS go under `## [Unreleased]` section
- Append to existing subsections (e.g., `### Fixed`), do not create duplicates
- NEVER modify already-released version sections (e.g., `## [0.12.2]`)
- Each version section is immutable once released

## Attribution

- **Internal changes (from issues)**: `Fixed foo bar ([#123](https://github.com/jnyross/harness-engineering/issues/123))`
- **External contributions**: `Added feature X ([#456](https://github.com/jnyross/harness-engineering/pull/456) by [@username](https://github.com/username))`

## Example

```markdown
## [Unreleased]

### Added
- New feature X ([#123](https://github.com/jnyross/harness-engineering/issues/123))

### Fixed
- Fixed bug in foo bar ([#456](https://github.com/jnyross/harness-engineering/issues/456))

## [0.52.0]
### Changed
- Previous release (do not edit)
```
