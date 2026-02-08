-- CreateEnum
CREATE TYPE "OutcomeType" AS ENUM ('BINARY', 'MULTIPLE_CHOICE', 'NUMERIC_THRESHOLD');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PENDING', 'RESOLVED_CORRECT', 'RESOLVED_WRONG', 'VOID', 'UNRESOLVABLE');

-- CreateEnum
CREATE TYPE "CuTransactionType" AS ENUM ('INITIAL_GRANT', 'COMMITMENT_LOCK', 'COMMITMENT_UNLOCK', 'REFUND', 'BONUS', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ForecastType" AS ENUM ('BINARY', 'MULTIPLE_CHOICE');

-- CreateEnum
CREATE TYPE "ForecastStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PENDING_RESOLUTION', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'INSIGHTFUL', 'DISAGREE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "username" TEXT,
    "slug" TEXT,
    "website" TEXT,
    "twitterHandle" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "preferredLanguage" VARCHAR(10) NOT NULL DEFAULT 'en',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isModerator" BOOLEAN NOT NULL DEFAULT false,
    "brierScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rs" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "cuAvailable" INTEGER NOT NULL DEFAULT 100,
    "cuLocked" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "news_anchors" (
    "id" TEXT NOT NULL,
    "url" VARCHAR(2000) NOT NULL,
    "urlHash" VARCHAR(64) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "source" VARCHAR(200),
    "publishedAt" TIMESTAMP(3),
    "snippet" TEXT,
    "imageUrl" VARCHAR(2000),
    "domain" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_anchors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "newsAnchorId" TEXT,
    "claimText" VARCHAR(500) NOT NULL,
    "slug" TEXT,
    "detailsText" TEXT,
    "domain" VARCHAR(100),
    "outcomeType" "OutcomeType" NOT NULL DEFAULT 'BINARY',
    "outcomePayload" JSONB,
    "resolutionRules" TEXT,
    "resolveByDatetime" TIMESTAMP(3) NOT NULL,
    "status" "PredictionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionOutcome" VARCHAR(50),
    "evidenceLinks" JSONB,
    "resolutionNote" TEXT,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_options" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "numericValue" DOUBLE PRECISION,
    "isCorrect" BOOLEAN,

    CONSTRAINT "prediction_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "optionId" TEXT,
    "binaryChoice" BOOLEAN,
    "cuCommitted" INTEGER NOT NULL,
    "rsSnapshot" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cuReturned" INTEGER,
    "rsChange" DOUBLE PRECISION,

    CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cu_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CuTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "referenceId" VARCHAR(100),
    "note" VARCHAR(500),
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cu_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasts" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "slug" TEXT,
    "text" TEXT,
    "sourceArticles" JSONB,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "ForecastType" NOT NULL DEFAULT 'BINARY',
    "status" "ForecastStatus" NOT NULL DEFAULT 'DRAFT',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_options" (
    "id" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isCorrect" BOOLEAN,

    CONSTRAINT "forecast_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brierScore" DOUBLE PRECISION,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "predictionId" TEXT,
    "forecastId" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_reactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_slug_key" ON "users"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "news_anchors_urlHash_key" ON "news_anchors"("urlHash");

-- CreateIndex
CREATE INDEX "news_anchors_urlHash_idx" ON "news_anchors"("urlHash");

-- CreateIndex
CREATE INDEX "news_anchors_domain_idx" ON "news_anchors"("domain");

-- CreateIndex
CREATE INDEX "news_anchors_createdAt_idx" ON "news_anchors"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_slug_key" ON "predictions"("slug");

-- CreateIndex
CREATE INDEX "predictions_status_idx" ON "predictions"("status");

-- CreateIndex
CREATE INDEX "predictions_authorId_idx" ON "predictions"("authorId");

-- CreateIndex
CREATE INDEX "predictions_newsAnchorId_idx" ON "predictions"("newsAnchorId");

-- CreateIndex
CREATE INDEX "predictions_resolveByDatetime_idx" ON "predictions"("resolveByDatetime");

-- CreateIndex
CREATE INDEX "predictions_domain_idx" ON "predictions"("domain");

-- CreateIndex
CREATE INDEX "prediction_options_predictionId_idx" ON "prediction_options"("predictionId");

-- CreateIndex
CREATE INDEX "commitments_predictionId_idx" ON "commitments"("predictionId");

-- CreateIndex
CREATE INDEX "commitments_userId_idx" ON "commitments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "commitments_userId_predictionId_key" ON "commitments"("userId", "predictionId");

-- CreateIndex
CREATE INDEX "cu_transactions_userId_idx" ON "cu_transactions"("userId");

-- CreateIndex
CREATE INDEX "cu_transactions_type_idx" ON "cu_transactions"("type");

-- CreateIndex
CREATE INDEX "cu_transactions_createdAt_idx" ON "cu_transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "forecasts_slug_key" ON "forecasts"("slug");

-- CreateIndex
CREATE INDEX "forecasts_status_idx" ON "forecasts"("status");

-- CreateIndex
CREATE INDEX "forecasts_creatorId_idx" ON "forecasts"("creatorId");

-- CreateIndex
CREATE INDEX "forecasts_dueDate_idx" ON "forecasts"("dueDate");

-- CreateIndex
CREATE INDEX "forecast_options_forecastId_idx" ON "forecast_options"("forecastId");

-- CreateIndex
CREATE INDEX "votes_forecastId_idx" ON "votes"("forecastId");

-- CreateIndex
CREATE INDEX "votes_userId_idx" ON "votes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "votes_userId_forecastId_key" ON "votes"("userId", "forecastId");

-- CreateIndex
CREATE INDEX "comments_predictionId_idx" ON "comments"("predictionId");

-- CreateIndex
CREATE INDEX "comments_forecastId_idx" ON "comments"("forecastId");

-- CreateIndex
CREATE INDEX "comments_authorId_idx" ON "comments"("authorId");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");

-- CreateIndex
CREATE INDEX "comments_predictionId_createdAt_idx" ON "comments"("predictionId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_forecastId_createdAt_idx" ON "comments"("forecastId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_deletedAt_idx" ON "comments"("deletedAt");

-- CreateIndex
CREATE INDEX "comment_reactions_commentId_idx" ON "comment_reactions"("commentId");

-- CreateIndex
CREATE INDEX "comment_reactions_userId_idx" ON "comment_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reactions_userId_commentId_key" ON "comment_reactions"("userId", "commentId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_newsAnchorId_fkey" FOREIGN KEY ("newsAnchorId") REFERENCES "news_anchors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_options" ADD CONSTRAINT "prediction_options_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "prediction_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cu_transactions" ADD CONSTRAINT "cu_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_options" ADD CONSTRAINT "forecast_options_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "forecasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "forecasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "forecast_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "forecasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

