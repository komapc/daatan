# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build arguments
ARG DATABASE_URL
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_ENV="production"

# Hardcoded fallback values for the build phase only
ENV DATABASE_URL=${DATABASE_URL:-"postgresql://daatan:dummy@localhost:5432/daatan"}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-"dummy-secret-for-build"}
ENV NEXTAUTH_URL=${NEXTAUTH_URL:-"http://localhost:3000"}
ENV NEXT_PUBLIC_ENV=$NEXT_PUBLIC_ENV

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build Next.js
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Note: Standalone build includes necessary node_modules, no need to copy them separately
# However, we need to ensure prisma client is available if it's not bundled (usually it is)

USER nextjs

EXPOSE 3000

# Start Next.js standalone server
CMD ["node", "server.js"]
