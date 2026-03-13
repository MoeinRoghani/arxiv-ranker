# Architecture

## Pipeline

```
arXiv (HTML scrape per category/month)
  → Merge cross-listed papers (combine category tags)
  → Semantic Scholar batch API (POST /graph/v1/paper/batch)
      → Venue, Abstract, Citations, Influential Citations, Author hIndex
  → Scoring (Filters A-F)
  → Tier assignment
  → Export (CSV per tier + JSON + summary)
  → site_builder.py → site JSON + index manifest
  → Deploy to GitHub Pages
```

Two modes:
- **New**: Filters A-D active. Citations are ~0 for current-month papers. Accepts custom keyword overrides via environment variables.
- **Update**: Filters A-F active. Re-fetches S2 data (bypasses cache) to get accumulated citations.

## Data Sources

**arXiv** — HTML listing at `https://arxiv.org/list/{category}/{YYYY-MM}?show=2000`. Parsed with BeautifulSoup. Extracts `Title`, `Authors`, `Subjects` from `dt`/`dd` tag pairs.

**Semantic Scholar** — `POST /graph/v1/paper/batch` with `arXiv:{id}` identifiers, up to 500 per request. Fields: `publicationVenue`, `abstract`, `citationCount`, `influentialCitationCount`, `authors.hIndex`. Responses cached in `.arxiv_cache/s2_data.json`. **Requires `S2_API_KEY` env var** — ranker raises `RuntimeError` if missing. Max 5 retries on rate limit/timeout.

## Scoring

`final_score = Σ(Filter A..F)`

All keyword filters use case-insensitive substring matching.

### Filter A — Venue (cap: 120)

Source: `Venue` field (S2 `publicationVenue.alternate_names`, fallback `.name`).

Matching order:
1. Downgraders: `workshop` → 40 pts, `findings` → 50 pts. Terminates.
2. Abbreviation match against `VENUES` dict (longest key first to prevent `acl` matching `naacl`).
3. Full name match against `VENUE_NAMES` dict (longest key first).
4. No match → 0.

Tier S (120 pts): `neurips`, `nips`, `icml`, `iclr`

Tier A (100 pts): `emnlp`, `cvpr`, `iccv`, `eccv`, `aaai`, `ijcai`, `sigir`, `kdd`, `aamas`, `acl`, `nature`, `science`, `jmlr`, `tpami`

Tier A- (90 pts): `tnnls`, `tacl`, `uai`, `corl`

Tier B (80 pts): `naacl`, `coling`, `eacl`, `icra`, `iros`, `aistats`, `colt`, `colm`, `tmlr`, `jair`

Tier C (70 pts): `ecai`, `prima`, `tist`

Downgraded (40-50 pts): workshops, findings

### Filter B — Title Keywords (cap: 70)

Source: `Title`. Cumulative across all matches, capped at 70.

Default dictionary (`TITLE_KEYWORDS`):

| Weight | Keywords |
|--------|----------|
| +50 | `multi-agent`, `multiagent`, `agent coordination`, `agent-to-agent`, `llm agent`, `agentic`, `multi agent`, `autonomous agent` |
| +25 | `communication`, `collaboration`, `cooperation`, `orchestration`, `framework`, `reasoning`, `planning`, `coordination`, `negotiation`, `benchmark`, `survey` |

**Custom override:** Set `TITLE_KEYWORDS` env var as a JSON dict (`{"keyword": points, ...}`) to replace the defaults entirely. The UI keyword editor passes custom keywords through workflow dispatch.

### Filter C — Abstract Keywords (cap: 60)

Source: `Abstract` (requires length > 50 chars). Cumulative, capped at 60.

Default dictionary (`ABSTRACT_KEYWORDS`):

| Weight | Keywords |
|--------|----------|
| +25 | `multi-agent` |
| +20 | `emergent` |
| +15 | `network architecture`, `large language model`, `coordination`, `cooperation`, `decentralized` |
| +10 | `agent`, `distributed` |

**Custom override:** Set `ABSTRACT_KEYWORDS` env var as a JSON dict to replace the defaults entirely.

### Filter D — Author hIndex (max: 35)

Source: `Max_Author_hIndex` (max hIndex across all authors, from S2). Active in both modes.

Formula: `N(h) = 35 * h^1.36 / 223^1.36`

Derived from: `N(h) = MAX_PTS * (h^2 - h_min^2) / (h_max^2 - h_min^2)`, simplified with h_min=0.

Reference: Yoshua Bengio, CS D-index = 223 (current max in CS).

Power-law compression gives diminishing returns at high hIndex. Rejected log alternative (`35 * log(1+h²) / log(1+223²)`) — scores clustered too tightly.

| hIndex | Points |
|--------|--------|
| 10 | 3 |
| 20 | 7 |
| 40 | 16 |
| 60 | 23 |
| 100 | 30 |
| 223 | 35 |

### Filter E — Citation Count (update mode only, uncapped)

Source: `Citation_Count` (from S2).

Formula: `Score = 60 * (paper_citations / 58,848)`

Benchmark: Research.com 2025 report — average total citations for ranked CS scholars is 58,848; top 1% average is 276,341.

Intentionally uncapped to surface outlier papers.

| Citations | Points |
|-----------|--------|
| 1,000 | 1 |
| 10,000 | 10 |
| 58,848 | 60 |
| 200,000 | 203 |

### Filter F — Influential Citation Ratio (update mode only, max: 30)

Source: `Influential_Citations / Citation_Count`. Requires >= 10 citations. First threshold matched wins.

| Ratio >= | Points |
|----------|--------|
| 15% | +30 |
| 10% | +15 |
| 5% | +5 |

## Tiers

| Threshold | Tier |
|-----------|------|
| >= 150 | TIER-1 LANDMARK |
| >= 100 | TIER-2 IMPORTANT |
| < 100 | TIER-3 NOTABLE |

## Deduplication

Papers appearing in multiple categories are merged by `arXiv_ID`. All source categories are preserved in a `Categories` list (e.g., `['cs.MA', 'cs.AI']`). Merge occurs before S2 enrichment to avoid redundant API calls.

## Caching

S2 responses stored in `.arxiv_cache/s2_data.json` as `{arxiv_id: s2_response}`. New mode reads from cache if available (skips empty entries). Update mode bypasses cache (`force_refresh=True`) and overwrites entries with fresh data. Failed S2 lookups are never cached to prevent cache poisoning.

## Output Structure

```
output/<categories>_<YYYY>_<MM>/
  papers_ALL_RANKED.csv
  papers_landmark.csv
  papers_important.csv
  papers_notable.csv
  papers_raw.json
  papers_SUMMARY.txt
```

`papers_raw.json` is the input for `--update`.

## Site Data Structure

```
site/public/data/
  index.json                        # Manifest of all datasets
  summaries/{arxiv_id}.json         # Persisted AI analyses
  csMA_csCL_csAI_2026_02/
    papers.json                     # Lightweight paper data for frontend
    papers_raw.json                 # Full ranker output
```

Each generate creates a dataset folder named `{categories}_{YYYY}_{MM}`. Generating for the same date+categories overwrites the existing dataset. Datasets from different months accumulate and are never deleted.

## Frontend Architecture

**Tech:** React + Vite, deployed as a static SPA on GitHub Pages.

**Routing:** Hash-based. The only routed view is paper analysis: `#analyze/{datasetKey}/{arxivId}`. All other navigation is state-driven within the same page.

**New-tab analysis:** Clicking "Analyze" opens `window.open('#analyze/...', '_blank')`. The new tab boots the app, parses the hash, fetches the dataset's `papers.json`, locates the paper, and renders the analysis view independently.

**Workflow tracking:** `App.tsx` polls the GitHub Actions API every 5s (active workflows) or 15s (idle). All fetch calls use `cache: 'no-store'` to prevent stale responses.

**AI analysis:** Client-side OpenAI API call. Results are persisted to the repo via the `save-analysis.yml` workflow dispatch. Subsequent visits load the cached analysis from `data/summaries/`.
