# Zero-Downtime Version Updates

## Overview
DAATAN supports updating the application version without rebuilding Docker images or causing downtime. The version is read from an environment variable at runtime instead of being baked into the build.

## How It Works
1. Version is stored in `APP_VERSION` environment variable
2. The health endpoint (`/api/health`) reads version at runtime
3. Container restart picks up new version from `.env` file
4. Restart takes ~10 seconds (minimal downtime vs full rebuild)

## Usage

### Update Version (Production)
```bash
ssh daatan
cd ~/app
./scripts/update-version.sh production 0.1.33
```

### Update Version (Staging)
```bash
ssh daatan
cd ~/app
./scripts/update-version.sh staging 0.1.33
```

## What Happens
1. Script validates version format (semver: MAJOR.MINOR.PATCH)
2. Updates `APP_VERSION` in `.env` file
3. Restarts container gracefully (docker compose restart)
4. Waits for health check
5. Verifies new version is deployed

## Downtime
- **Container restart**: ~10 seconds
- **Full rebuild**: ~5-10 minutes
- **Improvement**: 30-60x faster

## When to Use
- Hotfix version bumps
- Quick version corrections
- Any version change without code changes

## When NOT to Use
- Code changes (requires rebuild)
- Dependency updates (requires rebuild)
- Environment variable changes (use docker compose restart)

## Verification
Check deployed version:
```bash
curl https://daatan.com/api/health | jq .version
curl https://staging.daatan.com/api/health | jq .version
```

## Rollback
If version update fails, the script automatically shows logs and exits with error. Container remains running with old version.

## Technical Details
- Version source: `src/lib/version.ts`
- Reads from: `process.env.APP_VERSION`
- Fallback: Build-time version (0.1.32)
- Container env: Set in `docker-compose.prod.yml`
