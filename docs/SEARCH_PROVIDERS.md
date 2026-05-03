# Search Providers

The Express Forecast wizard, Oracle research, and bot discovery all need to fetch news/SERP results for arbitrary user queries. We use a multi-provider fallback chain so a single rate-limit, outage, or zero-result query doesn't break the whole UX.

## Two-layer architecture

```
caller
  ↓
Oracle gateway (try first, optional)            ← src/lib/services/oracleSearch.ts
  ↓ (null/empty/disabled)
searchArticles()                                 ← src/lib/utils/webSearch.ts
  ↓
[Serper → DataForSEO → BrightData → Nimbleway → SerpAPI → ScrapingBee → DuckDuckGo]
```

**Oracle** is our internal proxy gateway (separate service). It runs its own provider chain server-side so credentials don't sit in every Next.js process. If `ORACLE_URL` + `ORACLE_API_KEY` are set, callers try it first; on `null`/empty/error/disabled, they fall back to the in-process chain.

**`searchArticles()`** in `src/lib/utils/webSearch.ts:406-509` is the in-process chain. It tries each provider in order until one returns ≥1 result, then returns. If all fail, returns an empty array (callers handle the empty case).

## Provider fallback chain

| # | Provider     | Adapter (file:line)                   | Env vars                                  | Notes |
|---|--------------|---------------------------------------|-------------------------------------------|-------|
| 1 | Serper       | `webSearch.ts:33-75`                  | `SERPER_API_KEY`                          | News API; tries `news` → `topStories` → `organic` |
| 2 | DataForSEO   | `webSearch.ts:150-185`                | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Google News API (HTTP basic auth) |
| 3 | BrightData   | `webSearch.ts:191-238`                | `BRIGHTDATA_API_KEY`                      | Google SERP via proxy; HTML parsing |
| 4 | Nimbleway    | `webSearch.ts:260-295`                | `NIMBLEWAY_API_KEY`                       | Google SERP API; structured JSON |
| 5 | SerpAPI      | `webSearch.ts:97-128`                 | `SERPAPI_API_KEY`                         | News results (`tbm=nws`) |
| 6 | ScrapingBee  | `webSearch.ts:316-346`                | `SCRAPINGBEE_API_KEY`                     | Google "store" API; news → top stories → organic |
| 7 | DuckDuckGo   | `webSearch.ts:352-400`                | (none — free)                             | DDG lite HTML scrape; last-resort, no quota |

All adapters return the same shape:

```ts
interface SearchResult {
  title: string
  url: string
  snippet: string
  source?: string
  publishedDate?: string
}
```

Order matters and was tuned empirically — Serper has the highest quality-to-rate-limit ratio for breaking news; DataForSEO catches non-English well after the locale fix below; DuckDuckGo is unmetered insurance.

## Multilingual fix (May 2026)

Earlier providers had hard-coded English/US locale params, which silently returned 0 results for queries in other scripts (Hebrew, Russian, Arabic, etc.) — falling through to DDG every time. Stripped:

- DDG: `kl=us-en` removed
- BrightData: `gl=us`, `hl=en` removed
- Nimbleway: `country=US` removed
- DataForSEO: English-only locale restriction removed

Commits: `7ece1bbb`, `eaa7caaa`. After this, all providers detect the query's script and let the upstream API auto-localize.

If you reintroduce per-language tuning, do it via a per-call option (e.g., `searchArticles(query, limit, { locale })`), not a hard-coded default.

## Health monitoring

`GET /api/cron/search-health` (header `x-cron-secret: $BOT_RUNNER_SECRET`) — fired periodically. It calls Oracle's `/search/health` and emits Telegram alerts when:

- a single provider is `exhausted: true` → `notifyExhausted(name)`
- a single provider's `credits < 100` → `notifySearchCreditsLow(name, credits)`
- aggregate `overall: 'unhealthy'` (all providers down/exhausted) → `notifyAllSearchProvidersFailed()`

Threshold for "low credits" is `100`, defined at `src/lib/services/oracleSearch.ts:12`. Adjust if a provider's credit unit differs significantly (some count requests, others count results).

Telegram delivery requires `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`. If unset, alerts no-op silently — don't rely on this path for ops without confirming the bot token in `.env` is current (the one in the repo .env example has been invalid since 2026; refresh from BotFather as needed).

## Adding a new provider

1. Add an adapter function in `src/lib/utils/webSearch.ts` returning `SearchResult[]` (or `[]` on failure — never throw out of the adapter, the chain handles fall-through).
2. Insert it into the fallback array in `searchArticles()` — earlier = higher priority.
3. Add the API key env var to `.env.example` and to the t3-env validation in `src/env.ts` (mark optional unless mandatory).
4. If the provider has a credits/quota endpoint, plumb it into Oracle's `/search/health` so the cron alerts pick it up.
5. Update this table.

## Failure modes worth knowing

- **All paid providers exhausted, only DDG returns** — quality drops noticeably. The `search-health` cron will have already paged before this happens if the alert thresholds are tuned right.
- **Provider returns HTTP 200 with garbage HTML** (BrightData under proxy stress) — the adapter's parser returns `[]`, chain falls through. Not visible to the user but worth grepping `bot-runner` logs for adapter-level errors during incident review.
- **Oracle disabled, all in-process providers also down** — `searchArticles()` returns `[]`. Express Forecast surfaces `NO_ARTICLES_FOUND`; bot discovery skips the cycle.
