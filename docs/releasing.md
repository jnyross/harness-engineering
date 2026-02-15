# Releasing

## Versioning

**Lockstep versioning**: All packages always share the same version number. Every release updates all packages together.

**Version semantics** (no major releases):
- `patch`: Bug fixes and new features
- `minor`: API breaking changes

## Release Steps

1. **Update CHANGELOGs**: Ensure all changes since last release are documented in the `[Unreleased]` section of each affected package's CHANGELOG.md

2. **Run release script**:
   ```bash
   npm run release:patch    # Fixes and additions
   npm run release:minor    # API breaking changes
   ```

The script handles:
- Version bump in all package.json files
- CHANGELOG finalization (moving [Unreleased] to version section)
- Git commit
- Git tag
- npm publish to registry
- Adding new `[Unreleased]` sections

## CHANGELOG Format

See [changelog-format.md](changelog-format.md) for detailed format rules.

## Pre-release Checklist

- [ ] All changes have CHANGELOG entries
- [ ] Tests pass (`npm run check`)
- [ ] No uncommitted changes
- [ ] On main branch or release branch

## Post-release

After running the release script:
1. The version tag is pushed automatically
2. npm packages are published
3. Each CHANGELOG.md has a new `[Unreleased]` section

## Troubleshooting

### Release fails on npm publish
- Ensure you have npm authentication configured
- Check package names haven't been taken

### Version conflicts
- Ensure all packages have the same version before running release script
- Check for any `[Unreleased]` sections that weren't properly finalized
