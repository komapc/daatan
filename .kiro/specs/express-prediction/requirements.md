# Express Prediction Requirements

## Overview
Allow users to create predictions quickly by entering free text (e.g., "US vs Iran conflict this year"). The system uses LLM + web search to automatically fill all prediction fields.

## User Story
**As a user**, I want to quickly create a prediction by typing a short phrase, so that I don't have to manually fill in all the fields and search for relevant articles.

## User Flow

### 1. Input
- User navigates to `/predictions/express`
- Enters free text in a simple input field
- Examples:
  - "US vs Iran conflict this year"
  - "Trump will attack one more country this year"
  - "Bitcoin will reach $100k by end of 2026"
- Clicks "Generate Prediction"

### 2. Processing (with progress indicator)
System shows step-by-step progress:
1. **Searching articles...** (web search for relevant news)
2. **Analyzing context...** (LLM reads articles, extracts info)
3. **Generating prediction...** (LLM creates structured prediction)

### 3. Review & Edit
User sees generated prediction with all fields filled:
- **Claim Text**: Formal, testable statement
- **Due Date**: Inferred or default (end of current year)
- **Context**: Summary of current situation from articles
- **News Anchor**: Automatically selected most relevant article
- **Additional Links**: List of relevant articles found

User can:
- Edit any field before publishing
- Adjust the due date
- Change the claim wording
- Add/remove links
- Save as draft or publish immediately

### 4. Error Handling
If no relevant articles found:
- Show message: "Couldn't find relevant articles. Try rephrasing your prediction or being more specific."
- Allow user to rephrase and try again
- Don't create prediction without articles

## Technical Architecture

### API Endpoints

#### POST /api/predictions/express/generate
**Input:**
```json
{
  "userInput": "US vs Iran conflict this year"
}
```

**Process:**
1. Web search for relevant articles (Google Search API or similar)
2. Fetch article content for top 3-5 results
3. Send to LLM with structured prompt
4. Parse LLM response into prediction fields
5. Create NewsAnchor from best article
6. Return structured data

**Output:**
```json
{
  "claimText": "There will be a military conflict between the United States and Iran before December 31, 2026",
  "detailsText": "Current situation summary based on articles...",
  "resolveByDatetime": "2026-12-31T23:59:59Z",
  "domain": "politics",
  "newsAnchor": {
    "url": "https://...",
    "title": "...",
    "snippet": "...",
    "source": "Reuters"
  },
  "additionalLinks": [
    { "url": "...", "title": "..." },
    { "url": "...", "title": "..." }
  ]
}
```

### LLM Prompt Structure

**System Prompt:**
```
You are a prediction assistant for DAATAN, a reputation-based prediction platform. Your job is to convert user's casual prediction ideas into formal, testable predictions.

Rules:
1. Create clear, unambiguous claims that can be objectively verified
2. Infer resolution dates from context (e.g., "this year" = Dec 31 of current year)
3. If no timeframe mentioned, default to end of current year
4. Summarize current situation based on provided articles
5. Focus on factual, verifiable outcomes
6. Avoid subjective or opinion-based predictions
```

**User Prompt:**
```
User wants to predict: "{userInput}"

Based on these recent articles:
[Article 1: title, snippet, url]
[Article 2: title, snippet, url]
[Article 3: title, snippet, url]

Generate a structured prediction with:
1. Formal claim statement (clear, testable, specific)
2. Resolution date (infer from user input or default to {currentYear}-12-31)
3. Context summary (2-3 sentences about current situation from articles)
4. Domain/category (politics, tech, sports, economics, etc.)

Return as JSON:
{
  "claimText": "...",
  "resolveByDatetime": "YYYY-MM-DDTHH:mm:ssZ",
  "detailsText": "...",
  "domain": "..."
}
```

### Web Search Integration

**Search API Options:**
1. **Google Custom Search API** (Recommended)
   - 100 free queries/day
   - Good quality results
   - Easy to integrate

2. **Bing Search API**
   - 1000 free queries/month
   - Alternative to Google

3. **SerpAPI**
   - Aggregates multiple search engines
   - Paid but reliable

**Search Strategy:**
- Query: User input + "news" + current year
- Limit: Top 5 results
- Filter: News articles from last 6 months
- Extract: Title, snippet, URL, published date

### NewsAnchor Creation

**Selection Criteria:**
1. Most recent article
2. From reputable source (Reuters, BBC, AP, etc.)
3. Most relevant to prediction topic
4. Has good snippet/summary

**Automatic Creation:**
```typescript
const newsAnchor = await prisma.newsAnchor.create({
  data: {
    url: article.url,
    urlHash: sha256(article.url),
    title: article.title,
    source: article.source,
    publishedAt: article.publishedDate,
    snippet: article.snippet,
    domain: inferredDomain
  }
})
```

## UI Components

### Express Prediction Page (`/predictions/express`)

**Layout:**
```
┌─────────────────────────────────────┐
│  Express Prediction                 │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ What do you want to predict?  │ │
│  │                               │ │
│  │ [Text input area]             │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
│  Examples:                          │
│  • "Bitcoin will reach $100k..."   │
│  • "Trump will win 2024..."        │
│                                     │
│  [Generate Prediction Button]      │
└─────────────────────────────────────┘
```

### Progress Indicator

**Steps:**
1. 🔍 Searching articles... (0-33%)
2. 📊 Analyzing context... (33-66%)
3. ✨ Generating prediction... (66-100%)

**Visual:**
- Progress bar with current step highlighted
- Step descriptions
- Estimated time: "This usually takes 10-15 seconds"

### Review Screen

**Layout:**
```
┌─────────────────────────────────────┐
│  Review Your Prediction             │
│                                     │
│  Claim:                             │
│  [Editable text field]              │
│                                     │
│  Due Date:                          │
│  [Date picker]                      │
│                                     │
│  Context:                           │
│  [Editable textarea]                │
│                                     │
│  News Anchor:                       │
│  📰 [Article title]                 │
│  [Source] - [Date]                  │
│                                     │
│  Additional Links:                  │
│  • [Link 1]                         │
│  • [Link 2]                         │
│  [+ Add link] [× Remove]            │
│                                     │
│  [Save as Draft] [Publish]          │
└─────────────────────────────────────┘
```

## Acceptance Criteria

### Must Have
1. User can enter free text and generate prediction
2. System searches for relevant articles via web search
3. LLM generates structured prediction from articles
4. Progress indicator shows current step
5. User can edit all fields before publishing
6. NewsAnchor automatically created from best article
7. Error handling when no articles found
8. Binary predictions only (for now)
9. Due date inference with end-of-year default

### Should Have
1. Example predictions shown on page
2. Character limit on input (e.g., 200 chars)
3. Validation of generated fields
4. Ability to regenerate if unhappy with result
5. Save generated prediction as draft
6. Link to manual prediction creation

### Could Have
1. Suggest improvements to user input
2. Show confidence score for generated prediction
3. Multiple claim variations to choose from
4. Preview of how prediction will look
5. History of user's express predictions

## Future Enhancements (TODO Items)

### Phase 2: Multiple Choice Support
- Detect when user wants multiple choice (e.g., "who will win elections")
- Generate options automatically
- Example: "Who will win 2024 US elections?" → Options: Trump, Biden, Other

### Phase 3: Numeric Predictions
- Support numeric thresholds
- Example: "Bitcoin price by end of year" → "Bitcoin will exceed $X by Dec 31"

### Phase 4: Advanced Types
- Specific order predictions (rankings)
- Date-based predictions (when will X happen)
- Conditional predictions (if X then Y)

### Phase 5: Updated Context Feature
- "Analyze Situation" button on existing predictions
- Re-search for latest articles
- Generate updated context summary
- Show timeline of context changes

## Dependencies

### NPM Packages
- Existing: `@google/generative-ai` (Gemini)
- New: Search API client (TBD based on chosen provider)

### External APIs
- Google Custom Search API (or alternative)
- Gemini API (already integrated)

### Environment Variables
```
GOOGLE_SEARCH_API_KEY=xxx
GOOGLE_SEARCH_ENGINE_ID=xxx
```

## Database Schema
No changes needed - existing Prediction and NewsAnchor models support this feature.

## Cost Estimation

### Per Express Prediction
- Web search: 1 API call (~$0.005)
- LLM generation: ~1000 tokens (~$0.001)
- **Total: ~$0.006 per prediction**

### Monthly (1000 predictions)
- ~$6/month
- Negligible at current scale

## Open Questions
1. Which search API to use? (Recommend Google Custom Search)
2. Should we cache search results to reduce API costs?
3. Rate limiting per user? (Suggest: 10 express predictions per day)
4. Should we show the LLM's reasoning/thought process?

## Implementation Plan

### Phase 1: Backend (Week 1)
1. Set up search API integration
2. Create LLM prompt templates
3. Build API endpoint `/api/predictions/express/generate`
4. Test with various inputs

### Phase 2: Frontend (Week 1)
1. Create express prediction page
2. Build progress indicator component
3. Create review/edit form
4. Add error handling UI

### Phase 3: Testing & Polish (Week 1)
1. Test with real-world inputs
2. Refine LLM prompts
3. Improve error messages
4. Add examples and help text

### Phase 4: Launch
1. Deploy to staging
2. User testing
3. Iterate based on feedback
4. Deploy to production

## Success Metrics
- % of express predictions that get published (target: >70%)
- Time to create prediction (target: <30 seconds)
- User satisfaction with generated predictions
- Reduction in abandoned prediction creation flows
