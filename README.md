# arXiv Paper Retrieval & Ranking System

Fetches monthly paper listings from arXiv, enriches each paper with Semantic Scholar metadata, scores them with a multi-signal ranking algorithm, and exports ranked results.

## Requirements

- Python 3.8+
- `pip install -r requirements.txt`

## Setup

### Semantic Scholar API Key

The system uses the Semantic Scholar batch API. A key is optional but recommended to avoid rate limits.

1. Request a key at https://www.semanticscholar.org/product/api#api-key-form
2. Set it as an environment variable:

```bash
export S2_API_KEY=your_key_here
```

Without a key, the public rate limit applies (100 requests per 5 minutes).

## Usage

### New Mode (default)

Fetch papers from arXiv for a given month, enrich with Semantic Scholar, score, and export.

```bash
# Default categories (cs.MA, cs.CL, cs.AI), current month
python src/ranker.py

# Single category
python src/ranker.py cs.MA

# Multiple categories, specific month
python src/ranker.py cs.MA,cs.CL,cs.AI 2025-10
```

Any valid [arXiv category](https://arxiv.org/category_taxonomy) is accepted. Multiple categories are comma-separated, no spaces.

### Update Mode

Re-rank a previous run's papers with fresh Semantic Scholar data. Enables citation-based scoring filters that are inactive in new mode (citations are ~0 for freshly released papers).

```bash
python src/ranker.py --update output/csMA_csCL_csAI_2025_10/papers_raw.json
```

Takes the `papers_raw.json` from any previous run, bypasses cache, re-fetches S2 data, and re-scores with citation count and influential citation ratio as additional signals.

## Data Sources

### arXiv

Bulk paper listing by category and month. Provides:
- `Title`, `Authors`, `Subjects`

### Semantic Scholar (Batch API)

Per-paper enrichment via `POST /graph/v1/paper/batch`. Provides:
- `publicationVenue` (alternate names + full name) — used for venue scoring
- `abstract` — used for keyword scoring
- `citationCount`, `influentialCitationCount` — used in update mode
- `authors[].hIndex` — max across authors, used in both modes

All S2 responses are cached locally in `.arxiv_cache/s2_data.json`. Subsequent runs for the same papers skip the API call unless `--update` is used.

## Scoring Filters

All filters run on every paper. Filters F and G are only active in update mode.

| Filter | Source | Weight | Signal |
|--------|--------|--------|--------|
| A | Venue (S2) | 40-120 | Tiered venue scoring with workshop/findings downgrade |
| B | Title | +50 | Core MAS keywords (`multi-agent`, `agentic`, `llm agent`, ...) |
| C | Title | +25 | Reasoning/framework keywords (`planning`, `coordination`, `benchmark`, ...) |
| D | Abstract | up to +50 | Weighted keyword matching, capped |
| E | hIndex (S2) | 5-35 | Author reputation tiers |
| F | Citations (S2) | 20-100 | Citation count tiers (update mode only) |
| G | Influential ratio (S2) | 5-25 | Influential/total citation ratio (update mode only, requires >= 10 citations) |

## Tier Assignment

| Tier | Threshold |
|------|-----------|
| TIER-1 LANDMARK | score >= 150 |
| TIER-2 IMPORTANT | score >= 100 |
| TIER-3 NOTABLE | score < 100 |

## Output

Files are written to `output/<categories>_<year>_<month>/`:

```
output/csMA_csCL_csAI_2026_03/
  papers_ALL_RANKED.csv      # All papers sorted by score
  papers_landmark.csv        # Tier-1 only
  papers_important.csv       # Tier-2 only
  papers_notable.csv         # Tier-3 only
  papers_raw.json            # Full data (input for --update)
  papers_SUMMARY.txt         # Statistics
```

### CSV Columns

`arXiv_ID`, `Title`, `Authors`, `Subjects`, `Abstract`, `Venue`, `Citation_Count`, `Influential_Citations`, `Max_Author_hIndex`, `Category`, `Score`, `Factors`, `Tier`

## Project Structure

```
src/
  ranker.py            # Main script: retrieval, enrichment, scoring
  exporter.py          # Export logic: CSV, JSON, summary generation
docs/
  ARCHITECTURE.md      # Scoring algorithm specification
.arxiv_cache/          # Local S2 response cache (auto-created)
output/                # Ranked results (auto-created)
```
