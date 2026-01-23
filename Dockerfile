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
# Explicitly copy src again to ensure Docker doesn't use a stale cache for the source directory
COPY src ./src
COPY __tests__ ./__tests__

# Build Next.js
RUN npx prisma generate
RUN echo "Source API routes check:" && ls -R src/app/api
RUN npm run build
RUN echo "Verifying API routes build:" && ls -R .next/server/app/api

# Production stage

FROM node:20-alpine AS runner



WORKDIR /app



ENV NODE_ENV=production

ENV PORT=3000

ENV HOSTNAME="0.0.0.0"



# Create non-root user

RUN addgroup --system --gid 1001 nodejs && \

    adduser --system --uid 1001 nodejs



# Copy standalone build and static files

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nodejs:nodejs /app/.next/standalone ./

RUN chown -R nodejs:nodejs /app



USER nodejs



EXPOSE 3000



# Start Next.js using the standalone server

CMD ["npx", "next", "start", "-H", "0.0.0.0"]
