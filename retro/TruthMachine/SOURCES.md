# TruthMachine: Source Selection Criteria & List

> **Status:** Draft v1 | **Last updated:** 2026-03-17
> Machine-readable source list: `sources.json`

---

## Selection Criteria

A source is included in TruthMachine if it meets **all** of the following:

1. **Publishes predictions** — makes forward-looking statements about events, not just factual reporting
2. **Publicly accessible** — articles are accessible via web, API, or archive
3. **Sufficient volume** — publishes enough content on seed events to generate scorable predictions
4. **Verifiable identity** — source has a clear, stable identity (outlet name or journalist name)

### Excluded from MVP
- Telegram channels (Phase 2)
- Video/audio sources (Phase 2)
- Sources with no English or Hebrew content
- Sources with no digital archive prior to 2020

---

## Source Types

| Type | Description | Examples |
|---|---|---|
| `newspaper` | General news outlet | Ynet, Haaretz, NYT |
| `wire` | Wire service | Reuters, AP |
| `tv` | TV news outlet with web presence | Kan 11, CNN |
| `financial_news` | Financial/business news | Globes, Bloomberg |
| `think_tank` | Policy research institution | CSIS, Quincy Institute |
| `financial_institution` | Bank / investment firm | Goldman Sachs, J.P. Morgan |
| `blog` | Independent writer | Uri Kurlianchik (Substack) |
| `poll` | Polling / research firm | Gallup |

---

## Political Lean

Political lean fields are **not manually filled** — TruthMachine learns them from the data. Fields exist in `sources.json` but start empty.

Expected axes (model-derived, may expand):
- `political_lean` — float (-1.0 left to 1.0 right)
- `economic_lean` — float (-1.0 progressive to 1.0 conservative)
- Additional axes as the model discovers them

---

## MVP Source List (25 sources)

### Israeli Sources (15) — web only

| ID | Name | Language | Type | URL |
|---|---|---|---|---|
| `ynet` | Ynet | Hebrew | newspaper | ynet.co.il |
| `haaretz` | Haaretz | Hebrew/English | newspaper | haaretz.co.il |
| `n12` | N12 (Mako) | Hebrew | tv | n12.co.il |
| `israel_hayom` | Israel Hayom | Hebrew | newspaper | israelhayom.co.il |
| `globes` | Globes | Hebrew | financial_news | globes.co.il |
| `kan11` | Kan 11 | Hebrew | tv | kan.org.il |
| `themarker` | The Marker | Hebrew | financial_news | themarker.com |
| `walla` | Walla News | Hebrew | newspaper | news.walla.co.il |
| `maariv` | Maariv | Hebrew | newspaper | maariv.co.il |
| `jpost` | Jerusalem Post | English | newspaper | jpost.com |
| `toi` | Times of Israel | English | newspaper | timesofisrael.com |
| `calcalist` | Calcalist | Hebrew | financial_news | calcalist.co.il |
| `ch13` | Channel 13 News | Hebrew | tv | 13tv.co.il |
| `ch14` | Channel 14 (Now 14) | Hebrew | tv | now14.co.il |
| `kurlianchik` | Uri Kurlianchik | Hebrew | blog | substack.com/... |

### International Sources (6)

| ID | Name | Language | Type | URL |
|---|---|---|---|---|
| `bbc` | BBC News | English | newspaper | bbc.com/news |
| `aljazeera` | Al Jazeera | English | newspaper | aljazeera.com |
| `cnn` | CNN | English | tv | cnn.com |
| `reuters` | Reuters | English | wire | reuters.com |
| `bloomberg` | Bloomberg | English | financial_news | bloomberg.com |
| `wsj` | Wall Street Journal | English | financial_news | wsj.com |

### Auxiliary Data Source

| ID | Name | Type | Notes |
|---|---|---|---|
| `polymarket` | Polymarket | prediction_market | Not scored — provides `polymarket_prob` per prediction where market exists |

---

## Phase 2 Additions (not in MVP)

- Abu Ali Express (Telegram)
- Amit Segal (Telegram)
- Kan 11 video segments
- Additional financial institutions (Goldman Sachs, J.P. Morgan, etc.) — to be added as data permits
- Additional think tanks (CSIS, Quincy Institute, Foreign Policy, etc.)

---

## Notes on Specific Sources

- **Channel 14** — right-leaning, high prediction volume on security/political topics
- **Uri Kurlianchik** — independent analyst, Substack; lower volume but high specificity predictions
- **Haaretz** — publishes in both Hebrew and English; ingest Hebrew edition for consistency
- **Jerusalem Post / Times of Israel** — English-language Israeli outlets; useful for cross-referencing international coverage of Israeli events
- **Polymarket** — only covers ~30% of Israeli events; `NULL` is expected and acceptable for the rest
