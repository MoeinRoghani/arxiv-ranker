# Developer Reference

## File Structure

```
src/
  ranker.py      # Main entry point, retrieval, enrichment, ranking
  exporter.py    # CSV/JSON export utilities
docs/
  ARCHITECTURE.md  # Scoring algorithm specification
  DEVELOPER.md     # This file
output/            # Generated results per run
.arxiv_cache/
  s2_data.json     # Semantic Scholar response cache
```

## Entry Points

### New Mode (default)
```bash
python src/ranker.py cs.MA,cs.CL 2026-02
```
Flow: `main()` → `fetch_category()` per category → `merge_papers()` → `enrich_papers()` → `rank_all()` → `export_papers()`

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

**Format:**
```json
{
  "2602.12345": { "citationCount": 5, "authors": [...], ... },
  ...
}
```

---

### SemanticScholarEnricher
Batch API client for S2. Fetches up to 500 papers per request.

```python
enricher = SemanticScholarEnricher()
enricher.enrich_papers(papers, force_refresh=False) → papers
```

**API:** `POST https://api.semanticscholar.org/graph/v1/paper/batch`

**Request body:**
```json
{
  "ids": ["arXiv:2602.12345", "arXiv:2602.67890", ...]
}
```

**Query params:** `fields=publicationVenue,citationCount,influentialCitationCount,authors.hIndex,abstract`

**Auth:** Optional. Set `S2_API_KEY` env var for higher rate limits.

**Rate limiting:** Exponential backoff on 429. Retries indefinitely.

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
ranker = PaperRanker(update_mode=False)
ranker.add_papers(papers)
ranked = ranker.rank_all() → list[dict]
```

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
- `HINDEX_MAX_PTS=35`, `HINDEX_REF=223`, `HINDEX_EXP=1.36`
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
Parses `sys.argv`. Returns `{'categories': list, 'year_month': str, 'update_path': str|None}`. Categories can be comma-separated.

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
parse_args()
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
PaperRanker.rank_all()
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
| `S2_API_KEY` | No | Semantic Scholar API key. Increases rate limit. |

---

## Cache Behavior

| Mode | Cache Read | Cache Write |
|------|------------|-------------|
| New | Yes | Yes |
| Update | No (`force_refresh=True`) | Yes (overwrites) |

Cache path: `.arxiv_cache/s2_data.json`

---

## Error Handling

- **arXiv 4xx/5xx:** Returns empty list, prints error.
- **S2 429:** Exponential backoff, retries indefinitely.
- **S2 timeout:** Exponential backoff, retries.
- **S2 paper not found:** Stores empty dict `{}` in cache, sets defaults.
- **Parse failure:** Skips paper, prints warning, continues.
