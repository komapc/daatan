# Build stage
FROM node:20-bookworm-slim AS builder

# Install OpenSSL for Prisma during build
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Accept build arguments
ARG DATABASE_URL
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_ENV="production"
ARG GIT_COMMIT="unknown"
ARG BUILD_TIMESTAMP="unknown"

# Hardcoded fallback values for the build phase only
ENV DATABASE_URL=${DATABASE_URL:-"postgresql://daatan:dummy@localhost:5432/daatan"}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-"dummy-secret-for-build"}
ENV NEXTAUTH_URL=${NEXTAUTH_URL:-"http://localhost:3000"}
ENV NEXT_PUBLIC_ENV=$NEXT_PUBLIC_ENV
ENV GIT_COMMIT=$GIT_COMMIT

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Force cache invalidation for source files
RUN echo "Build timestamp: $BUILD_TIMESTAMP"

# Copy source
COPY . .
# Explicitly copy src again to ensure Docker doesn't use a stale cache for the source directory
COPY src ./src
COPY __tests__ ./__tests__

# Build Next.js
RUN npx prisma generate
RUN echo "Source API routes check:" && ls -R src/app/api
RUN echo "Source auth routes check:" && ls -R src/app/auth
RUN echo "Health route content:" && head -20 src/app/api/health/route.ts
RUN echo "Signin page content:" && head -30 src/app/auth/signin/page.tsx
RUN npm run build
RUN echo "Verifying API routes build:" && ls -R .next/server/app/api
RUN echo "Verifying auth routes build:" && ls -R .next/server/app/auth || echo "No auth folder in build!"
RUN echo "Full app routes:" && ls -R .next/server/app/

# Production stage
FROM node:20-bookworm-slim AS runner

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

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

RUN chown -R nodejs:nodejs /app



USER nodejs



EXPOSE 3000



# Start Next.js using the standalone server



CMD ["node", "server.js"]
