# Bot Approval Workflow

## Overview

The bot approval workflow allows administrators to configure bots that create predictions requiring manual approval before staking. This is useful for scoped bots (e.g., sports_bot, economics_bot) where human review ensures forecast quality.

## Features

### 1. Approval Requirement Flag

Bots can be configured to require approval with the `requireApprovalForForecasts` field:

```typescript
// BotConfig
requireApprovalForForecasts: Boolean @default(false)
```

When enabled:
- Forecasts are created with `PENDING_APPROVAL` status
- Bot does NOT stake immediately
- Human approval needed before forecast becomes `ACTIVE`
- On rejection, forecast transitions to `VOID`

### 2. Per-Bot Rate Limiting

Control how many forecasts a bot creates per hour:

```typescript
// BotConfig
maxForecastsPerHour: Int @default(0) // 0 = unlimited
```

The bot-runner checks this limit before creating each forecast and stops if reached.

### 3. Metadata Extraction

Bots can optionally extract metadata from article clusters:

```typescript
// BotConfig
enableSentimentExtraction: Boolean @default(false)
showMetadataOnForecast: Boolean @default(false)
```

Metadata stored on Prediction:
```typescript
sentiment: String?              // "positive" | "negative" | "neutral"
confidence: Int?                // 0–100
extractedEntities: String[]     // e.g., ["Israel", "Lebanon"]
consensusLine: String?          // "Based on 4 sources, 72% indicate..."
sourceSummary: String?          // Aggregated summary from articles
```

### 4. Topic Rejection Tracking

Prevent bots from re-suggesting rejected topics:

```typescript
// BotConfig
enableRejectionTracking: Boolean @default(false)

// New model
model BotRejectedTopic {
  id: String
  botId: String
  keywords: String[]
  description: String
  rejectedById: String
  rejectedAt: DateTime
}
```

When a user rejects a forecast, the topic is logged to prevent future duplicate suggestions.

## API Endpoints

### Approve Forecast

**Endpoint:** `POST /api/forecasts/[id]/approve`

**Auth:** Authenticated user (any role)

**Behavior:**
1. Transition forecast from `PENDING_APPROVAL` → `ACTIVE`
2. Auto-stake using bot's configured stake range
3. Send Telegram notification of publication

**Response:**
```json
{
  "id": "pred-123",
  "status": "ACTIVE",
  "claimText": "🤖 Bitcoin will reach $100k by Dec 2026",
  "publishedAt": "2026-03-10T15:30:00Z"
}
```

### Reject Forecast

**Endpoint:** `POST /api/forecasts/[id]/reject`

**Auth:** Authenticated user (any role)

**Body (optional):**
```json
{
  "keywords": ["bitcoin", "crypto", "price"],
  "description": "Already covered by other forecasts"
}
```

**Behavior:**
1. Transition forecast from `PENDING_APPROVAL` → `VOID`
2. Create `BotRejectedTopic` entry with keywords
3. Bot won't suggest similar topics again (if rejection tracking enabled)

**Response:**
```json
{
  "success": true,
  "prediction": {
    "id": "pred-123",
    "status": "VOID",
    "resolutionOutcome": "void"
  },
  "message": "Forecast rejected and topic added to rejection list"
}
```

## Bot Configuration Example

### Sports Bot with Approval

```typescript
// Create/update via admin UI
{
  userId: "bot-sports_123",
  personaPrompt: "You are a sports analyst tracking major sporting events...",
  forecastPrompt: "Create a specific, verifiable forecast about...",
  votePrompt: "As a sports expert, commit to forecasts about...",
  newsSources: [
    "https://feeds.bbci.co.uk/sport/rss.xml",
    "https://www.espn.com/espnfeed/feeds/rss/sports.xml"
  ],

  // Approval workflow
  requireApprovalForForecasts: true,

  // Rate limiting
  maxForecastsPerHour: 3,
  maxForecastsPerDay: 10,

  // Metadata & tracking
  enableSentimentExtraction: true,
  enableRejectionTracking: true,
  showMetadataOnForecast: true,

  // Staking
  stakeMin: 50,
  stakeMax: 150,

  // Schedule
  intervalMinutes: 30
}
```

## Admin UI Workflow

### Pending Approvals Tab

**Future enhancement** - Create admin panel showing:
- List of `PENDING_APPROVAL` forecasts created by bots
- Filter by bot, date range, status
- Quick approve/reject actions
- Rejection reason/keywords

### Bot Configuration

In the Bots admin tab, configure approval settings:
- ☑️ Require approval for forecasts
- ☑️ Enable sentiment extraction
- ☑️ Track rejected topics
- ☑️ Show metadata on forecasts
- Input: Max forecasts per hour

## Database Schema

### BotConfig (Enhanced)

```sql
ALTER TABLE "bot_configs" ADD COLUMN "requireApprovalForForecasts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bot_configs" ADD COLUMN "enableSentimentExtraction" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bot_configs" ADD COLUMN "enableRejectionTracking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bot_configs" ADD COLUMN "showMetadataOnForecast" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bot_configs" ADD COLUMN "maxForecastsPerHour" INTEGER NOT NULL DEFAULT 0;
```

### Prediction (Enhanced)

```sql
ALTER TABLE "predictions" ADD COLUMN "sentiment" VARCHAR(20);
ALTER TABLE "predictions" ADD COLUMN "confidence" INTEGER;
ALTER TABLE "predictions" ADD COLUMN "extractedEntities" TEXT[];
ALTER TABLE "predictions" ADD COLUMN "consensusLine" TEXT;
ALTER TABLE "predictions" ADD COLUMN "sourceSummary" TEXT;
```

### BotRejectedTopic (New)

```sql
CREATE TABLE "bot_rejected_topics" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "botId" TEXT NOT NULL,
  "keywords" TEXT[],
  "description" VARCHAR(500) NOT NULL,
  "rejectedById" TEXT NOT NULL,
  "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bot_rejected_topics_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot_configs" ("id") ON DELETE CASCADE,
  CONSTRAINT "bot_rejected_topics_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "bot_rejected_topics_botId_idx" ON "bot_rejected_topics"("botId");
CREATE INDEX "bot_rejected_topics_rejectedAt_idx" ON "bot_rejected_topics"("rejectedAt");
```

## Bot Runner Implementation

### Approval Workflow in bot-runner.ts

```typescript
// When requireApprovalForForecasts is true
if (!bot.requireApprovalForForecasts) {
  // Immediately stake on forecast
  await ensureBotCU(bot, dryRun)
  const stakeAmount = randomInt(bot.stakeMin, bot.stakeMax)
  await createCommitment(bot.userId, prediction.id, {
    cuCommitted: stakeAmount,
    binaryChoice: true,
  })
} else {
  // Defer staking until user approves via /api/forecasts/[id]/approve
  log.info({ botId: bot.id }, 'Forecast created, awaiting approval')
}
```

### Hourly Rate Limiting

```typescript
// Check hourly limit before creating each forecast
if (bot.maxForecastsPerHour > 0) {
  const hourlyCount = await countThisHourActions(bot.id, 'CREATED_FORECAST')
  if (hourlyCount >= bot.maxForecastsPerHour) {
    log.info({ botId: bot.id }, 'Hourly forecast limit reached')
    break // Stop processing this batch
  }
}
```

## Testing

See `__tests__/features/bot-approval-workflow.test.ts` for comprehensive test coverage:
- Forecast creation with approval requirement
- Approval endpoint transitions status correctly
- Rejection endpoint creates BotRejectedTopic
- Hourly rate limiting stops excess forecasts
- Staking deferred until approval

## Future Enhancements

1. **Admin UI** - "Pending Approvals" tab with bulk approve/reject
2. **Sentiment Extraction** - LLM-based sentiment analysis from article clusters
3. **Community Voting** - Allow users to vote on pending forecasts before approval
4. **Batch Operations** - Approve/reject multiple forecasts at once
5. **Webhooks** - Notify external systems when forecasts are approved/rejected
6. **Audit Trail** - Track all approval/rejection decisions with timestamps

## Troubleshooting

**Q: Bot is creating forecasts but they're not staking**
A: Check if `requireApprovalForForecasts` is true. Staking happens only after approval via `/approve` endpoint.

**Q: Hourly limit not working**
A: Verify `maxForecastsPerHour > 0`. Set to 0 for unlimited.

**Q: Rejected topics not preventing duplicates**
A: Check if `enableRejectionTracking` is true on BotConfig.

**Q: Metadata fields are null**
A: Check if `enableSentimentExtraction` is true. Metadata is only extracted when enabled.
