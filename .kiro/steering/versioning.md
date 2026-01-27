# Versioning Guidelines

## Version Tracking
- The health endpoint (`/api/health`) returns the git commit hash for deployment verification
- Example response: `{"status":"ok","version":"0.1.16","commit":"abc1234","timestamp":"..."}`
- Use the `commit` field to verify which code is deployed

## Manual Version Bumps
Version in `src/lib/version.ts` should be bumped manually for:
- **Major releases** (breaking changes): `npm version major`
- **Minor releases** (new features): `npm version minor`
- **Patch releases** are optional - commit hash is sufficient for tracking

## When to Bump Version
- Before production deployments with significant changes
- When releasing a new feature set
- NOT required for every PR (commit hash handles that)

## Production Deployment
1. Bump version if needed: `npm version patch`
2. Create and push tag: `git tag v0.1.X && git push origin v0.1.X`
3. Tag push triggers production deployment
