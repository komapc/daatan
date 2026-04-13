# Build stage
FROM node:20-bookworm-slim AS builder

# Install OpenSSL for Prisma during build
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Stable build args (rarely change — declared before npm ci to maximise layer cache)
ARG DATABASE_URL
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_ENV="production"
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY

# Hardcoded fallback values for the build phase only (@t3-oss/env-nextjs validates at runtime; skip during build)
ENV SKIP_ENV_VALIDATION=1
ENV DATABASE_URL=${DATABASE_URL:-"postgresql://daatan:dummy@localhost:5432/daatan"}
ENV NEXTAUTH_SECRET="dummy-secret-for-build"
ENV NEXTAUTH_URL=${NEXTAUTH_URL:-"http://localhost:3000"}
ENV GOOGLE_CLIENT_ID=123456789-dummy.apps.googleusercontent.com
ENV GOOGLE_CLIENT_SECRET=dummysecret12
ENV NEXT_PUBLIC_ENV=$NEXT_PUBLIC_ENV
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

# Copy package files and install dependencies.
# These layers are cached by ECR BuildKit when package.json is unchanged.
# IMPORTANT: volatile per-build args (APP_VERSION, GIT_COMMIT) are declared
# AFTER this block so they don't bust the npm ci cache on every deploy.
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./prisma.config.ts

RUN npm ci

# Per-build args — injected after npm ci so that version/commit changes
# do not invalidate the expensive dependency install layer above.
ARG NEXT_PUBLIC_APP_VERSION
ARG GIT_COMMIT="unknown"
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV GIT_COMMIT=$GIT_COMMIT

# Copy source
COPY . .

# Build Next.js
RUN npx prisma generate
RUN npm run build 2>&1 || (echo "Build failed!" && cat .next/build-error.log 2>/dev/null && exit 1)

# Compile seed.ts → seed.js so it can run in the slim production image (tsx is a devDep)
RUN npx esbuild prisma/seed.ts --bundle --platform=node --outfile=prisma/seed.js --packages=external

# Production stage
FROM node:20-bookworm-slim AS runner

# Install OpenSSL for Prisma and wget for health checks
RUN apt-get update && apt-get install -y openssl wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pass GIT_COMMIT from build stage
ARG GIT_COMMIT="unknown"
ENV GIT_COMMIT=$GIT_COMMIT

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"



# Create non-root user

RUN addgroup --system --gid 1001 nodejs && \

    adduser --system --uid 1001 nodejs



# Copy standalone build and static files

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nodejs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema, config and migrations for runtime migrate deploy
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
# Copy sharp for Next.js Image optimization (required in standalone mode)
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp

RUN chown -R nodejs:nodejs /app



USER nodejs



EXPOSE 3000



# Start Next.js using the standalone server



CMD ["node", "server.js"]
