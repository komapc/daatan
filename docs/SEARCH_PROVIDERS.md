# Search Providers

The Express Forecast wizard, Oracle research, and bot discovery all fetch news/SERP results via **Oracle** — a separate internal search service running in the retro/api Python project. Daatan does not maintain its own provider chain.

## Architecture

```
caller (daatan)
  ↓
oracleSearch()                    ← src/lib/services/oracleSearch.ts
  ↓ HTTP → ORACLE_URL
Oracle API (retro/api)
  ↓
[DataForSEO → Serper → Brave → Tavily → GDELT BQ → GDELT Doc → DuckDuckGo → ...]
```

All search logic — provider selection, fallback ordering, retries, rate-limit handling — lives in `retro/api`. Daatan's sole responsibility is calling `oracleSearch()` and handling `null` (Oracle unavailable or all providers exhausted).

## Daatan entry points

| Function | File | Returns |
|---|---|---|
| `oracleSearch(query, limit, opts?)` | `src/lib/services/oracleSearch.ts` | `SearchResult[] \| null` |
| `searchArticlesMultilingual(query, limit, opts?)` | `src/lib/utils/multilingualSearch.ts` | `SearchResult[]` |

`searchArticlesMultilingual` wraps `oracleSearch` with non-Latin script detection (Cyrillic, Hebrew, Arabic, CJK). When detected, it translates the query to English via Gemini and runs both queries in parallel, deduplicating results. Use this wrapper for any user-supplied search query.

## SearchResult shape

```ts
interface SearchResult {
  title: string
  url: string
  snippet: string
  source?: string       // news source / publication name (e.g. "Reuters"), not the search provider
  publishedDate?: string
}
```

## Oracle response fields: provider and provider_chain

The Oracle's `/search` response includes two diagnostic fields that Daatan now captures:

| Field | Type | Meaning |
|---|---|---|
| `provider` | `string` | The provider that successfully served the request (e.g. `"dataforseo"`, `"gdelt"`, `"ddg"`). `"none"` means no named provider set the value — typically happens when results come from a fallback path that does not explicitly claim ownership. |
| `provider_chain` | `string[]` | Ordered list of providers that were attempted before the successful one (e.g. `["serpapi", "serper"]` if those were exhausted first). Empty when the first provider in the chain succeeds. |

These are logged in every `oracle-search: success` pino entry and persisted in the `OracleCallLog` table (see below).

### What `provider=none` means

When the Oracle returns `provider=none` and `provider_chain=[]`, results still came back — the fallback chain found articles without any single provider explicitly claiming the call (e.g. an internal cache hit, or a code path that does not write to `_provider_local`). This is expected behaviour and does not indicate an error.

## Call log and admin UI

Every successful `oracleSearch()` call writes a row to the `oracle_call_logs` DB table:

| Column | Type | Description |
|---|---|---|
| `id` | `cuid` | Row ID |
| `provider` | `text` | Provider that served the request |
| `providerChain` | `text[]` | Providers tried before success |
| `query` | `text` | Search query |
| `resultCount` | `int` | Number of results returned |
| `durationMs` | `int` | End-to-end Oracle HTTP latency |
| `createdAt` | `timestamptz` | When the call completed |

Rows older than 30 days are pruned on every write. Admins can inspect per-provider summary stats and the recent call log in the **Oracle** tab of the Admin dashboard (`/admin`).

## Configuration

| Env var | Required | Purpose |
|---|---|---|
| `ORACLE_URL` | Yes (in prod) | Base URL of the Oracle API |
| `ORACLE_API_KEY` | Yes (in prod) | Bearer token for Oracle |

If `ORACLE_URL` is unset, `oracleSearch()` returns `null` immediately (no HTTP call). Callers treat `null` as "no results available."

## Multilingual search

`searchArticlesMultilingual` detects non-Latin scripts and translates before searching. The translation is cached in-process (LRU, 500 entries) keyed by a content hash, so repeated queries for the same Cyrillic/Hebrew/Arabic text make only one Gemini call.

Requires `GEMINI_API_KEY` for translation. If unset or translation fails, the original query is used as a single-language fallback.

## Oracle provider chain

The full provider chain is maintained in `retro/api`. Refer to that project's documentation for provider details, API key management, and health monitoring.

## Health monitoring

`GET /api/cron/search-health` (header `x-cron-secret: $BOT_RUNNER_SECRET`) — calls Oracle's `/search/health` and emits Telegram alerts when:

- a single provider is `exhausted: true`
- a single provider's `credits < 100`
- aggregate `overall: 'unhealthy'` (all providers down/exhausted)

Threshold for "low credits" is `100`, defined at `src/lib/services/oracleSearch.ts`. Telegram delivery requires `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`.

## Failure modes

- **Oracle unavailable** (`ORACLE_URL` unset or service down) — `oracleSearch()` returns `null`. Express Forecast throws `NO_ARTICLES_FOUND`; context updates return 503; bot discovery skips the cycle.
- **Oracle returns empty results** — callers receive `[]` and handle it as "no articles found."
- **Translation failure** (Gemini API error or quota) — `searchArticlesMultilingual` falls back to the original-language query. No user-visible impact beyond reduced result quality for non-Latin queries.

## Adding a new provider

Add providers in `retro/api`, not in daatan. The Oracle service manages the full provider chain. After deploying the updated Oracle API, daatan picks up the new provider automatically — no daatan changes needed.
