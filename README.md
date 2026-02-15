# DAaTAn

**Reputation-based news prediction platform**

> "Prove you were right — without shouting into the void."

[![Live](https://img.shields.io/badge/Production-daatan.com-green)](https://daatan.com)
[![Staging](https://img.shields.io/badge/Staging-staging.daatan.com-yellow)](https://staging.daatan.com)
[![Version](https://img.shields.io/badge/Version-1.1.1-blue)](https://github.com/komapc/daatan/releases)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

---

## What Is DAaTAn?

DAaTAn is a reputation-based product that enables testing understanding and forecasts on news, politics, and current affairs — **without money**, with long-term accuracy measurement.

**The product doesn't measure profit — it measures understanding.**

---

## Environments

| Environment | URL | Branch | Deploy Trigger |
|-------------|-----|--------|----------------|
| **Production** | https://daatan.com | `main` | Push tag `v*` |
| **Staging** | https://staging.daatan.com | `main` | Push to `main` |

---

## What DAaTAn Is NOT

- ❌ Not a gambling platform
- ❌ Not a trading arena
- ❌ Not a real-money product
- ❌ Not a consequence-free game

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Framework | Next.js 14 (React 18) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS |
| Database | PostgreSQL 16 + Prisma 5.16 |
| Auth | NextAuth.js (Google OAuth) |
| Hosting | AWS EC2 (eu-central-1) |
| Container | Docker + Nginx |
| CI/CD | GitHub Actions |
| SSL | Let's Encrypt |

---

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

---

## Scripts

### Development
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Run linter
```

### Operations
```bash
./scripts/check.sh    # Quick health check (up/down)
./scripts/status.sh   # Full status (health, version, latency)
./scripts/release.sh  # Create version tag and release
```

### Deployment
```bash
# Deploy to staging (automatic on push to main)
git push origin main

# Deploy to production (create version tag)
./scripts/release.sh
# Or manually:
git tag v1.1.1
git push origin v1.1.1
```

## Development Workflow

1.  **Local Dev:** `npm run dev`
2.  **Commit:** A pre-commit hook (husky) runs `npm run build` automatically to ensure the codebase is buildable.
3.  **Deploy Staging:** Push to `main`.
4.  **Deploy Production:** Run `./scripts/release.sh`.

---

## Documentation

| Document | Purpose |
| -------- | ------- |
| [DAATAN_CORE.md](./DAATAN_CORE.md) | Source of Truth — vision and principles |
| [GLOSSARY.md](./GLOSSARY.md) | Terminology definitions |
| [FORECASTS_FLOW.md](./FORECASTS_FLOW.md) | End-to-end implementation flow |
| [TODO.md](./TODO.md) | Development tasks and guidelines |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment procedures and operations |
| [TECH.md](./TECH.md) | Technical architecture, infrastructure, and project structure |
| [SECRETS.md](./SECRETS.md) | Secrets management and security |
| [VERSIONING.md](./VERSIONING.md) | Semantic versioning rules |

---

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Validate against [DAATAN_CORE.md](./DAATAN_CORE.md)
3. Make changes and commit
4. Push and create a Pull Request
5. **Never merge without explicit approval**

---

## License

Private — All rights reserved.
