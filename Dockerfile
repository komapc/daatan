# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build-time environment variables for the build process
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ARG NEXTAUTH_SECRET
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ARG NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_URL=$NEXTAUTH_URL

# Copy package files and prisma schema (needed for postinstall prisma generate)
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source
COPY . .

# Create public directory if it doesn't exist
RUN mkdir -p public

# Accept build-time environment variables
ARG NEXT_PUBLIC_ENV=production
ENV NEXT_PUBLIC_ENV=$NEXT_PUBLIC_ENV

# Build Next.js
RUN DATABASE_URL="$DATABASE_URL" NEXTAUTH_SECRET="$NEXTAUTH_SECRET" NEXTAUTH_URL="$NEXTAUTH_URL" npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/src ./src # Add this line to copy the entire src directory

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Start Next.js in production mode
CMD ["npm", "start"]
