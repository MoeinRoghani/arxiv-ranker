# Developer Reference

## File Structure

```
src/
  ranker.py        # Main entry point, retrieval, enrichment, ranking
  exporter.py      # CSV/JSON export utilities
  site_builder.py  # Transforms ranker output → lightweight site JSON
  run_updates.py   # Batch updater for weekly cron (past 12 months)
  agents/
    agent.py                          # Base agent runner / entry
    bases/
      precontex_agent_base.py         # Pre-context agent base class
    research_reader_agent/
      agent.py                        # Research Reader agent implementation
  config/
    chat_model.py                     # Chat model configuration
  prompts/
    base.py                           # Base prompt template
    research_reader_prompt.py         # Research Reader system prompt
  tools/                              # Agent tool definitions
  utils/
    get_openai_model.py               # OpenAI model helper
    prompt_utils.py                   # Prompt formatting utilities
site/              # React + Vite frontend
  src/
    main.tsx       # React entry, mounts App
    index.css      # Global styles
    App.tsx        # Root component, hash routing, workflow polling
    lib/api.ts     # All fetch calls (data files, GitHub API, summaries)
    lib/openai.ts  # Client-side OpenAI analysis
    lib/types.ts   # TypeScript interfaces
    lib/format.ts  # Display formatters (venues, dates, authors)
    components/
      PapersTable.tsx       # Sortable/filterable paper table
      RunCard.tsx           # Expandable month card on homepage
      AllPapersView.tsx     # Full paper list for a dataset
      PaperAnalysisView.tsx # AI analysis page (supports new-tab routing)
      GenerateForm.tsx      # Header panel for new rankings + keyword editor
      WorkflowTracker.tsx   # Live workflow status tracker
      FilterBar.tsx         # Tier/category/sort controls
      MonthPicker.tsx       # Date selector
      ConfirmDialog.tsx     # Overlay confirm/cancel
      Toast.tsx             # Toast notifications
  public/data/     # Generated site data (index.json + per-dataset papers.json)
    summaries/     # Persisted AI analyses (one {arxiv_id}.json per paper)
.github/workflows/
  generate.yml     # Monthly cron + manual dispatch
  update.yml       # Weekly cron + manual dispatch
  deploy.yml       # Auto-deploys after generate/update/save-analysis
  save-analysis.yml # Persists AI analysis to repo
docs/
  ARCHITECTURE.md  # Scoring algorithm specification
  DEVELOPER.md     # This file
output/            # Generated results per run (local only)
.arxiv_cache/
  s2_data.json     # Semantic Scholar response cache
```

---

## GitHub Actions Workflows

### generate.yml — New Rankings

| Property | Value |
|----------|-------|
| **Trigger** | Cron: `0 6 1 * *` (1st of each month, 06:00 UTC) |
| **Manual** | `workflow_dispatch` with optional `year_month`, `categories`, `title_keywords`, `abstract_keywords` |
| **Cron behavior** | Generates rankings for the **previous month** using default keywords |
| **Manual default** | Previous month if `year_month` is empty; `cs.MA,cs.CL,cs.AI` if `categories` is empty; hardcoded keywords if keyword inputs are empty |

**Dispatch inputs:**

| Input | Type | Description |
|-------|------|-------------|
| `year_month` | string | `YYYY-MM` format. Defaults to previous month. |
| `categories` | string | Comma-separated arXiv categories. |
| `title_keywords` | string | JSON dict `{"keyword": points, ...}`. Overrides `TITLE_KEYWORDS`. |
| `abstract_keywords` | string | JSON dict `{"keyword": points, ...}`. Overrides `ABSTRACT_KEYWORDS`. |

Keyword inputs are passed to `ranker.py` via environment variables `TITLE_KEYWORDS` and `ABSTRACT_KEYWORDS`. The ranker parses these as JSON and uses them instead of the hardcoded defaults.

**Steps:**
1. Checkout repo
2. Install Python deps + restore S2 cache
3. `python src/ranker.py "$CATEGORIES" "$YEAR_MONTH"` (reads keyword env vars)
4. `python src/site_builder.py` — writes `site/public/data/<dataset_key>/papers.json`, updates `index.json`
5. Commit + push data

### update.yml — Re-score Existing Rankings

| Property | Value |
|----------|-------|
| **Trigger** | Cron: `0 6 * * 1` (every Monday, 06:00 UTC) |
| **Manual** | `workflow_dispatch` with optional `run_id` |
| **Cron behavior** | Runs `src/run_updates.py` — updates **all entries within the past 12 months** |
| **Manual behavior** | If `run_id` is provided, updates only that single entry |

**Steps:**
1. Checkout repo
2. Install Python deps + restore S2 cache
3. Run update (batch via `run_updates.py` or single via `ranker.py --update`)
4. `site_builder.py` rebuilds site JSON — marks newly discovered papers with `New: true`
5. Commit + push data

### deploy.yml — Site Deployment

| Property | Value |
|----------|-------|
| **Trigger** | On push to `main`, or after `Generate Rankings`, `Update Rankings`, or `Save Analysis` completes |
| **What it does** | Builds React app (`npm ci && npm run build`), deploys to GitHub Pages |

Env vars injected at build time: `VITE_GITHUB_REPO`, `VITE_GITHUB_PAT`, `VITE_OPENAI_API_KEY`.

### save-analysis.yml — Persist AI Analysis

| Property | Value |
|----------|-------|
| **Trigger** | `workflow_dispatch` from frontend after AI analysis completes |
| **Inputs** | `arxiv_id`, `paper_title`, `summary` |
| **What it does** | Writes `site/public/data/summaries/{arxiv_id}.json`, commits + pushes |

### Rate Limiting

`run_updates.py` waits **300 seconds (5 minutes)** between consecutive updates to respect Semantic Scholar API limits.

### Secrets

| Secret | Where | Purpose |
|--------|-------|---------|
| `S2_API_KEY` | GitHub repo → Settings → Secrets → Actions | **Required.** Semantic Scholar API key. Ranker raises `RuntimeError` if missing. |
| `VITE_OPENAI_API_KEY` | GitHub repo → Settings → Secrets → Actions | OpenAI API key for client-side paper analysis |
| `VITE_GITHUB_PAT` | GitHub repo → Settings → Secrets → Actions | GitHub PAT for workflow dispatch from UI |
| `VITE_GITHUB_REPO` | Injected at build time via `${{ github.repository }}` | Used by frontend to trigger workflows |

---

## Entry Points

### New Mode (default)
```bash
python src/ranker.py cs.MA,cs.CL 2026-02
```
Flow: `main()` → `fetch_category()` per category → `merge_papers()` → `enrich_papers()` → `rank_all()` → `export_papers()`

### New Mode with Custom Keywords
```bash
TITLE_KEYWORDS='{"multi-agent": 50, "llm": 30}' \
ABSTRACT_KEYWORDS='{"agent": 10}' \
python src/ranker.py cs.MA,cs.CL 2026-02
```
Custom keywords override the hardcoded defaults entirely when provided via env vars.

### Update Mode
```bash
python src/ranker.py --update output/csMA_2026_02/papers_raw.json
```
Flow: `main()` → `run_update()` → S2 refresh → re-rank with citation filters → export

---

## ranker.py Classes

### VenueScorer
Static class. Scores publication venue from S2 `publicationVenue` field.

```python
VenueScorer.score(paper) → (int, str)  # (points, matched_key)
```

**Data:**
- `VENUES`: dict, abbreviation → points
- `VENUE_NAMES`: dict, full name → points
- `_SORTED_VENUES`, `_SORTED_NAMES`: pre-sorted by key length desc

**Logic:**
1. Check downgraders (`workshop` → 40, `findings` → 50)
2. Substring match against `VENUES` (longest key first)
3. Substring match against `VENUE_NAMES`
4. No match → 0

---

### SemanticScholarCache
File-based JSON cache for S2 API responses.

```python
cache = SemanticScholarCache()
cache.has(arxiv_id) → bool
cache.get(arxiv_id) → dict | None
cache.set(arxiv_id, data)
cache.save()
```

**Storage:** `.arxiv_cache/s2_data.json`

**Cache poisoning prevention:** Empty dicts `{}` (from failed lookups) are never written to cache. On read, empty cached entries are skipped — the paper is re-fetched from S2 instead.

---

### SemanticScholarEnricher
Batch API client for S2. Fetches up to 500 papers per request.

```python
enricher = SemanticScholarEnricher()
enricher.enrich_papers(papers, force_refresh=False) → papers
```

**API:** `POST https://api.semanticscholar.org/graph/v1/paper/batch`

**Auth:** **Required.** Reads `S2_API_KEY` from env. Raises `RuntimeError` immediately if missing. No unauthenticated fallback.

**Rate limiting:** Exponential backoff on 429/timeout. Capped at `MAX_RETRIES=5`. Raises `RuntimeError` if retries exhausted.

**Methods:**

| Method | Description |
|--------|-------------|
| `enrich_papers(papers, force_refresh)` | Main entry. Checks cache, batches fetches, applies data. |
| `_fetch_batch(ids)` | POST request with retry logic. Returns list aligned with input. |
| `_apply_s2_data(paper, s2_data)` | Mutates paper dict with S2 fields. |

**Fields added to paper:**
- `Venue`: str (from `publicationVenue.alternate_names` or `.name`)
- `Citation_Count`: int
- `Influential_Citations`: int
- `Max_Author_hIndex`: int (max across all authors)
- `Abstract`: str (if not already present)

---

### ArxivRetriever
Scrapes arXiv listing page via HTTP GET.

```python
retriever = ArxivRetriever(category="cs.MA", year_month="2026-02", max_papers=2000)
papers = retriever.fetch_papers() → list[dict]
```

**URL pattern:** `https://arxiv.org/list/{category}/{YYYY-MM}?show={max_papers}`

**Parsing:** BeautifulSoup. Iterates `<dt>`/`<dd>` pairs.

**Extracted fields:**
- `arXiv_ID`
- `Title`
- `Authors`
- `Subjects`
- `Category` (injected, not from HTML)

**Initialized to empty:**
- `Abstract`, `Venue`, `Citation_Count`, `Influential_Citations`, `Max_Author_hIndex`

---

### PaperRanker
Applies scoring filters to papers.

```python
ranker = PaperRanker(update_mode=False, title_keywords=None, abstract_keywords=None)
ranker.add_papers(papers)
ranked = ranker.rank_all() → list[dict]
```

Constructor accepts optional `title_keywords` and `abstract_keywords` dicts (`{term: points}`). When provided, they override the class-level `TITLE_KEYWORDS` and `ABSTRACT_KEYWORDS` defaults. When `None`, the hardcoded defaults are used.

**Filters (see ARCHITECTURE.md for weights/formulas):**

| Filter | Source | Method | Active |
|--------|--------|--------|--------|
| A: Venue | `Venue` | `VenueScorer.score()` | always |
| B: Title Keywords | `Title` | cumulative dict match, cap 70 | always |
| C: Abstract Keywords | `Abstract` | cumulative dict match, cap 60 | always |
| D: hIndex | `Max_Author_hIndex` | power-law formula | always |
| E: Citations | `Citation_Count` | linear benchmark formula | update only |
| F: Influential Ratio | `Influential_Citations / Citation_Count` | tier thresholds | update only |

**Scoring constants:**
- `TITLE_KEYWORDS`: dict, keyword → points (50 for MAS, 25 for reasoning/framework)
- `ABSTRACT_KEYWORDS`: dict, keyword → points (10-25)
- `HINDEX_MAX_PTS=35`, `HINDEX_REF=253`, `HINDEX_EXP=1.36`
- `CITATION_MULTIPLIER=60`, `CITATION_BENCHMARK=58848`
- `INFLUENTIAL_RATIO_TIERS`: `[(0.15, 30), (0.10, 15), (0.05, 5)]`

**Methods:**

| Method | Description |
|--------|-------------|
| `score_paper(paper)` | Returns `(score: int, factors: list[str])` |
| `assign_tier(score)` | Returns tier label string |
| `rank_all()` | Mutates papers with `Score`, `Factors`, `Tier`. Sorts desc. |

---

## Standalone Functions

### fetch_category
```python
fetch_category(category, year_month) → list[dict]
```
Instantiates `ArxivRetriever` for a single category. Returns raw paper list (no enrichment/ranking).

### merge_papers
```python
merge_papers(all_papers) → list[dict]
```
Deduplicates by `arXiv_ID`. Cross-listed papers are merged: all source categories combined into a `Categories` list. First occurrence's metadata retained.

### run_update
```python
run_update(update_path)
```
Loads `papers_raw.json`, re-fetches S2 data with `force_refresh=True`, re-ranks with `update_mode=True`, exports as `papers_updated_*`.

### parse_args
```python
parse_args() → dict
```
Parses `sys.argv` for positional args (categories, year_month, `--update`). Also reads `TITLE_KEYWORDS` and `ABSTRACT_KEYWORDS` from environment variables — if set, parses them as JSON dicts and includes them in the returned args.

---

## Frontend

### Routing

The frontend is a single-page application with hash-based routing for the analysis view.

| Hash | View |
|------|------|
| (empty) | Homepage — run cards, filters, generate panel |
| `#analyze/{datasetKey}/{arxivId}` | Paper analysis page |

`datasetKey` is the folder name derived from categories + date (e.g., `csMA_csCL_csAI_2026_02`). `arxivId` is the arXiv paper ID.

**New-tab behavior:** Clicking "Analyze" on any paper calls `window.open('#analyze/{datasetKey}/{arxivId}', '_blank')`. The new tab boots the app, reads the hash, fetches `data/{datasetKey}/papers.json`, finds the paper by arXiv ID, and renders the analysis view. The original tab is unaffected.

`App.tsx` listens for `hashchange` events, so browser back/forward navigation works.

### Caching Strategy

All `fetch()` calls use `cache: 'no-store'` to bypass the browser HTTP cache entirely. This ensures:
- Workflow status polls always hit GitHub's API
- Data files reflect the latest deployment
- No stale responses after deploys

`index.html` includes `Cache-Control: no-cache, no-store, must-revalidate` meta tags to prevent HTML caching.

### AI Analysis Flow

1. `PaperAnalysisView` mounts
2. Calls `fetchSummary(arxivId)` — checks for cached analysis at `data/summaries/{arxivId}.json`
3. If cached → render immediately
4. If not cached → calls `analyzeWithAI()` (OpenAI API from browser), then `saveSummaryToRepo()` triggers `save-analysis.yml` to persist it
5. Supports regeneration with optional feedback text

### Generate Panel

The header "New Ranking" button opens a slide-down panel with:
- Period selector (month picker)
- Categories input
- Run button
- Collapsible "View Ranking Terms" section with editable keyword chips for title and abstract keywords, including add/remove/reset

Keywords edited in the UI are serialized as JSON and passed as workflow dispatch inputs. The ranker reads them from environment variables and uses them to override the hardcoded defaults.

### Dataset Structure

Each generate creates a folder under `site/public/data/`:

```
data/
  index.json                          # Manifest of all datasets
  summaries/                          # Persisted AI analyses
    2401.12345.json
  csMA_csCL_csAI_2026_02/
    papers.json                       # Lightweight paper data for frontend
    papers_raw.json                   # Full ranker output
  csMA_csCL_csAI_2026_01/
    papers.json
    papers_raw.json
```

Datasets accumulate over time. They are never deleted — generating for the same date overwrites that dataset's folder.

---

## exporter.py Functions

### export_papers
```python
export_papers(papers, output_dir=None, base_name="papers", export_json=True) → dict
```

Creates directory if needed. Writes:
- `{base_name}_ALL_RANKED.csv`
- `{base_name}_landmark.csv` (if any)
- `{base_name}_important.csv` (if any)
- `{base_name}_notable.csv` (if any)
- `{base_name}_SUMMARY.txt`
- `{base_name}_raw.json` (if `export_json=True`)

Returns dict of `{tier_name: filepath}`.

---

### compute_statistics
```python
compute_statistics(papers) → dict
```

Returns:
```python
{
  'total': int,
  'with_abstracts': int,
  'max_score': int,
  'min_score': int,
  'avg_score': float,
  'median_score': float,
  '🔥 TIER-1 LANDMARK': int,
  '⭐ TIER-2 IMPORTANT': int,
  '✓ TIER-3 NOTABLE': int,
}
```

---

### print_top_papers
```python
print_top_papers(papers, top_n=15)
```
Prints to stdout. Sorts by score if not already sorted.

---

### print_statistics
```python
print_statistics(stats)
```
Prints stats dict to stdout.

---

## Data Flow

### New Mode

```
parse_args() + env vars (TITLE_KEYWORDS, ABSTRACT_KEYWORDS)
    ↓
for category in categories:
    fetch_category()
        → list[paper]
    all_papers.extend()
    ↓
merge_papers(all_papers)
    → deduplicate by arXiv_ID, combine Categories
    ↓
SemanticScholarEnricher.enrich_papers(unique_papers)
    → mutates papers with S2 data (single pass)
    ↓
PaperRanker(title_keywords=..., abstract_keywords=...).rank_all()
    → mutates papers with Score, Factors, Tier
    ↓
sort by Score desc
    ↓
export_papers()
```

### Update Mode

```
parse_args() → update_path
    ↓
load papers_raw.json
    ↓
SemanticScholarEnricher.enrich_papers(force_refresh=True)
    → re-fetches all S2 data, updates cache
    ↓
PaperRanker(update_mode=True).rank_all()
    → applies citation filters (E, F)
    ↓
export_papers(base_name="papers_updated")
```

---

## Paper Dict Schema

After full pipeline, each paper dict contains:

| Field | Type | Source |
|-------|------|--------|
| `arXiv_ID` | str | arXiv |
| `Title` | str | arXiv |
| `Authors` | str | arXiv |
| `Subjects` | str | arXiv |
| `Category` | str | injected per-category |
| `Categories` | list[str] | merge_papers |
| `Abstract` | str | S2 |
| `Venue` | str | S2 |
| `Citation_Count` | int | S2 |
| `Influential_Citations` | int | S2 |
| `Max_Author_hIndex` | int | S2 |
| `Score` | int | ranker |
| `Factors` | list[str] | ranker |
| `Tier` | str | ranker |

---

## Environment Variables

| Var | Required | Description |
|-----|----------|-------------|
| `S2_API_KEY` | **Yes** | Semantic Scholar API key. Ranker refuses to run without it. |
| `TITLE_KEYWORDS` | No | JSON dict overriding default title keywords. Set by workflow from UI. |
| `ABSTRACT_KEYWORDS` | No | JSON dict overriding default abstract keywords. Set by workflow from UI. |

---

## Cache Behavior

| Mode | Cache Read | Cache Write |
|------|------------|-------------|
| New | Yes (skips empty entries) | Yes (only successful lookups) |
| Update | No (`force_refresh=True`) | Yes (overwrites) |

Cache path: `.arxiv_cache/s2_data.json`

Empty dicts from failed S2 lookups are never written to cache. On read, entries that are empty `{}` are skipped and the paper is re-fetched.

---

## Error Handling

- **S2_API_KEY missing:** `RuntimeError` immediately. No unauthenticated fallback.
- **arXiv 4xx/5xx:** Returns empty list, prints error.
- **S2 429 (rate limited):** Exponential backoff, max 5 retries. `RuntimeError` if exhausted.
- **S2 timeout:** Exponential backoff, max 5 retries. `RuntimeError` if exhausted.
- **S2 paper not found:** Sets default zeros, does not cache the empty result.
- **Parse failure:** Skips paper, prints warning, continues.
