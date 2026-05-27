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
[DataForSEO → NewsData.io → Serper → BrightData → Nimbleway → SerpAPI → ScrapingBee → BraveSearch → GDELT → DuckDuckGo]
```

**Oracle** is our internal proxy gateway (separate service). It runs its own provider chain server-side so credentials don't sit in every Next.js process. If `ORACLE_URL` + `ORACLE_API_KEY` are set, callers try it first; on `null`/empty/error/disabled, they fall back to the in-process chain.

**`searchArticles()`** in `src/lib/utils/webSearch.ts:537` is the in-process chain. It tries each provider in order until one returns ≥1 result, then returns. If all fail, throws `'Search API not available'` (callers surface this as an error; the Telegram alert fires via `notifyAllSearchProvidersFailed`).

## Provider fallback chain

| #  | Provider     | Adapter (file:line)                   | Env vars                                  | Notes |
|----|--------------|---------------------------------------|-------------------------------------------|-------|
| 1  | DataForSEO   | `webSearch.ts:154`                    | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Google News API (HTTP basic auth). Primary as of 2026-05-05. |
| 2  | NewsData.io  | `webSearch.ts:213`                    | `NEWSDATAIO_API_KEY`                      | News API; English-language filter. Added 2026-05-XX. |
| 3  | Serper       | `webSearch.ts:35`                     | `SERPER_API_KEY`                          | News API; tries `news` → `topStories` → `organic`. **Disabled (empty key) — out of credits 2026-05-05.** |
| 4  | BrightData   | `webSearch.ts:249`                    | `BRIGHTDATA_API_KEY`                      | Google SERP via proxy; HTML parsing. Not configured (no key in Secrets Manager). |
| 5  | Nimbleway    | `webSearch.ts:318`                    | `NIMBLEWAY_API_KEY`                       | Google SERP API; structured JSON. **Disabled (empty key) — trial quota finished 2026-05-05.** |
| 6  | SerpAPI      | `webSearch.ts:99`                     | `SERPAPI_API_KEY`                         | News results (`tbm=nws`). **Disabled (empty key) — exhausted 2026-05-05.** |
| 7  | ScrapingBee  | `webSearch.ts:374`                    | `SCRAPINGBEE_API_KEY`                     | Google "store" API; news → top stories → organic. **Disabled (empty key) — exhausted 2026-05-05.** |
| 8  | Brave Search | `webSearch.ts:407`                    | `BRAVE_SEARCH_API_KEY`                    | News Search API; EC2-compatible (no IP block). Free tier: 2000 req/month. See [Brave notes](#brave-notes) below. |
| 9  | GDELT        | `webSearch.ts:471`                    | (none — free)                             | GDELT Doc API; 3-month rolling window; no body snippets. See [GDELT notes](#gdelt-notes) below. |
| 10 | DuckDuckGo   | `webSearch.ts:527`                    | (none — free)                             | DDG Lite HTML scrape; last-resort, no quota. See [DDG notes](#ddg-notes) below. |

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

Order matters and was tuned empirically — Serper has the highest quality-to-rate-limit ratio for breaking news; DataForSEO catches non-English well after the locale fix below; GDELT and DuckDuckGo are unmetered insurance.

## Brave notes

**API**: `GET https://api.search.brave.com/res/v1/news/search` — requires `X-Subscription-Token` header.

**Free tier**: 2000 queries/month via the [Data for AI Free plan](https://api.search.brave.com/). No credit card required.

**EC2 compatibility**: Unlike GDELT and DuckDuckGo, Brave does not block AWS EC2 IP ranges. This makes it the most reliable free-tier provider for server-side deployments.

**Result shape**: Returns `title`, `url`, `description` (snippet), `page_age` (ISO datetime when available, else `age` string like "2 hours ago"), and `meta_url.hostname` for domain.

**Max results**: 20 per request (API cap). The adapter passes `count=min(limit, 20)`.

**To enable**: Set `BRAVE_SEARCH_API_KEY` in Secrets Manager. The adapter is skipped when the key is absent.

## GDELT notes

**API**: `GET https://api.gdeltproject.org/api/v2/doc/doc` — free, no key, no registration.

**Coverage**: 3-month rolling window. Queries beyond that return 0 articles (no error). The Python Factum Atlas pipeline also uses GDELT BQ for historical data, but that requires GCP credentials and is not implemented here.

**Rate limit behaviour**: GDELT enforces ~1 req/5s per IP. When rate-limited it **stalls the TLS handshake for ~25 seconds** rather than immediately returning 429. The adapter uses `AbortSignal.timeout(5_000)` to abort fast (confirmed from EC2: SSL handshake stalls 3s before timeout fires). After a 429 response, a 60-second per-process cooldown is set.

**EC2 IP behaviour**: GDELT rate-limits AWS EC2 IPs aggressively — confirmed that new EC2 IPs hit the TLS stall on first contact. In practice this means GDELT is only useful when the in-process cooldown is not active. The adapter handles this gracefully: any error (stall/429/parse failure) logs a warning and falls through to DuckDuckGo.

**Short-keyword quirk**: Queries containing words shorter than 3 characters (e.g. "EU", "US") cause GDELT to return HTTP 200 with a plain-text error message instead of JSON. The adapter catches the JSON parse failure and falls through.

**Snippets**: GDELT `artlist` mode returns article URLs and titles only — no body text. `snippet` field will be empty for all GDELT results.

## DDG notes

**Endpoint**: `POST https://lite.duckduckgo.com/lite/` — free, no key.

**EC2 IP behaviour**: DuckDuckGo blocks known AWS/datacenter IP ranges at the network level, regardless of User-Agent. From EC2, the request returns HTTP 200 with an empty result page (0 `result-link` elements). From residential/office IPs, the new Chrome-like UA and `Accept` headers work correctly (10 results confirmed). The UA fix is still worthwhile for self-hosted deployments and local development.

**Last resort**: DDG is tried only after all 8 other providers fail or return 0 results. When GDELT is also blocked (EC2 IP), both free fallbacks return empty and the search returns `[]`.

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

- **All paid providers exhausted, only Brave/GDELT/DDG available from EC2** — if `BRAVE_SEARCH_API_KEY` is set, Brave handles this gracefully (EC2-compatible, 2000 req/month free). Without Brave, GDELT and DDG are both IP-blocked on AWS and `searchArticles()` throws `Search API not available`. Top up DataForSEO (cheapest per-query) or enable Brave as a reliable free fallback.
- **GDELT TLS stall** — happens when the EC2 IP is rate-limited. The 5s `AbortSignal.timeout` fires, GDELT is skipped for 60s, DDG is tried. No user-visible impact beyond reduced result quality.
- **Provider returns HTTP 200 with garbage HTML** (BrightData under proxy stress) — the adapter's parser returns `[]`, chain falls through. Not visible to the user but worth grepping `web-search` logs for adapter-level errors during incident review.
- **Oracle disabled, all in-process providers also down** — `searchArticles()` throws. Express Forecast surfaces `NO_ARTICLES_FOUND`; bot discovery skips the cycle.
