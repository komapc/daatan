# DAATAN

**Prediction Market Platform**

> "Prove you were right — without shouting into the void."

[![Live](https://img.shields.io/badge/Live-daatan.com-blue)](https://daatan.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8)](https://tailwindcss.com/)

## Overview

DAATAN transforms passive news consumption into a verifiable, gamified track record of prediction accuracy. Make predictions, track your accuracy, and prove you were right.

## Tech Stack

- **Frontend:** Next.js 15 (React 19, App Router)
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL 16
- **Hosting:** AWS EC2 (Frankfurt)
- **SSL:** Let's Encrypt
- **Container:** Docker + Nginx

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Docker (for production)

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Deployment

The application is deployed on AWS EC2 with Docker:

```bash
# Sync and deploy
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  -e "ssh -i ~/.ssh/daatan-key.pem" . ubuntu@52.59.160.186:~/app/

ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && docker compose -f docker-compose.prod.yml up -d --build"
```

See [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for full deployment details.

## Project Structure

```
daatan/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── page.tsx         # Home/Feed page
│   │   ├── create/          # Create bet page
│   │   ├── leaderboard/     # Leaderboard page
│   │   ├── notifications/   # Notifications page
│   │   ├── profile/         # Profile page
│   │   ├── settings/        # Settings page
│   │   └── api/             # API routes
│   │       └── health/      # Health check endpoint
│   └── components/          # React components
│       └── Sidebar.tsx      # Responsive navigation sidebar
├── terraform/               # Infrastructure as Code
├── docker-compose.prod.yml  # Production Docker config
├── nginx-ssl.conf           # Nginx HTTPS config
├── Dockerfile               # Application container
└── deploy.sh                # Deployment script
```

## Features

- 📱 **Responsive Design** — Mobile hamburger menu, desktop sidebar
- 🔒 **HTTPS** — SSL via Let's Encrypt
- 🐳 **Containerized** — Docker + Docker Compose
- 🌐 **CDN-Ready** — Static assets optimized
- ♿ **Accessible** — ARIA labels, keyboard navigation

## Documentation

- [DAATAN_CORE.md](./DAATAN_CORE.md) — Product vision and features
- [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) — AWS infrastructure details

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit
3. Push to origin: `git push origin feature/my-feature`
4. Create a Pull Request (main branch is protected)

## License

Private — All rights reserved.

