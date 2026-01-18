# Versioning Rules

DAATAN follows [Semantic Versioning](https://semver.org/) with automatic version bumps on every PR merge.

## Version Format

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Breaking changes, major rewrites, or significant new systems
- **MINOR**: New features, significant improvements
- **PATCH**: Bug fixes, small improvements (default for every PR)

## Automatic Version Bumping

The version is automatically incremented when a PR is merged to `main`:

| PR Title Prefix | Label | Version Bump |
|-----------------|-------|--------------|
| `BREAKING:`, `major:`, `Major:` | `major` | MAJOR (x.0.0) |
| `feat:`, `feature:`, `Feature:` | `minor` | MINOR (0.x.0) |
| Any other | - | PATCH (0.0.x) |

## Examples

```
feat: Add user authentication     → 0.1.0 (minor bump)
fix: Correct login validation     → 0.1.1 (patch bump)  
BREAKING: New database schema     → 1.0.0 (major bump)
chore: Update dependencies        → 1.0.1 (patch bump)
```

## Current Version

The version is stored in `src/lib/version.ts` and displayed in the sidebar near the logo.

## Git Tags

Each version bump creates a git tag (e.g., `v0.0.1`) for easy reference and rollbacks.

