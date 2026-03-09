# Architecture

## Pipeline

```
arXiv (HTML scrape by category/month)
  → Title, Authors, Subjects per paper
  → Semantic Scholar batch API (POST /graph/v1/paper/batch)
      → Venue, Abstract, Citations, Influential Citations, Author hIndex
  → Scoring (Filters A-G)
  → Tier assignment
  → Export (CSV per tier + JSON + summary)
```

Two modes:
- **New**: Filters A-E active. Citations are ~0 for current-month papers.
- **Update**: Filters A-G active. Re-fetches S2 data (bypasses cache) to get accumulated citations.

## Data Sources

**arXiv** — HTML listing at `https://arxiv.org/list/{category}/{YYYY-MM}?show=2000`. Parsed with BeautifulSoup. Extracts `Title`, `Authors`, `Subjects` from `dt`/`dd` tag pairs.

**Semantic Scholar** — `POST /graph/v1/paper/batch` with `arXiv:{id}` identifiers, up to 500 per request. Fields: `publicationVenue`, `abstract`, `citationCount`, `influentialCitationCount`, `authors.hIndex`. Responses cached in `.arxiv_cache/s2_data.json`. API key via `S2_API_KEY` env var (optional).

## Scoring

`final_score = Σ(Filter A..G)`

All filters use case-insensitive substring matching. Single-match per filter (any keyword triggers once) unless noted otherwise.

### Filter A — Venue

Source: `Venue` field (S2 `publicationVenue.alternate_names`, fallback `.name`).

Matching order:
1. Downgraders: `workshop` → 40 pts, `findings` → 50 pts. Terminates.
2. Abbreviation match against `VENUES` dict (longest key first to prevent `acl` matching `naacl`).
3. Full name match against `VENUE_NAMES` dict (longest key first).
4. No match → 0.

Tier S (120 pts): `neurips`, `nips`, `icml`, `iclr`

Tier A (100 pts): `emnlp`, `cvpr`, `iccv`, `eccv`, `aaai`, `ijcai`, `sigir`, `kdd`, `aamas`, `acl`, `nature`, `science`, `jmlr`

Tier A- (90 pts): `tacl`, `tpami`

Tier B (80 pts): `naacl`, `coling`, `eacl`, `icra`, `iros`, `uai`, `aistats`, `colt`, `corl`, `colm`, `tmlr`, `jair`

Downgraded (40-50 pts): workshops, findings

### Filter B — MAS Keywords

Source: `Title`. Weight: +50. Any-match.

`multi-agent`, `multiagent`, `agent coordination`, `agent-to-agent`, `llm agent`, `agentic`, `multi agent`, `autonomous agent`

### Filter C — Reasoning/Framework

Source: `Title`. Weight: +25. Any-match.

`communication`, `collaboration`, `cooperation`, `orchestration`, `framework`, `reasoning`, `planning`, `coordination`, `negotiation`, `benchmark`, `survey`

### Filter D — Abstract

Source: `Abstract` (requires length > 50 chars). Cumulative, capped at +50.

Each keyword contributes independently and scores are summed:

| Weight | Keywords |
|--------|----------|
| +25 | `multi-agent` |
| +20 | `emergent` |
| +15 | `network architecture`, `large language model`, `coordination`, `cooperation`, `decentralized` |
| +10 | `agent`, `distributed` |

### Filter E — Author hIndex

Source: `Max_Author_hIndex` (max hIndex across all authors, from S2). Active in both modes. First threshold matched wins.

| hIndex >= | Points |
|-----------|--------|
| 60 | +35 |
| 40 | +25 |
| 20 | +15 |

### Filter F — Citation Count (update mode only)

Source: `Citation_Count` (from S2). First threshold matched wins.

| Citations >= | Points |
|--------------|--------|
| 1000 | +100 |
| 500 | +80 |
| 200 | +60 |
| 50 | +40 |
| 10 | +20 |

### Filter G — Influential Citation Ratio (update mode only)

Source: `Influential_Citations / Citation_Count`. Requires >= 10 citations. First threshold matched wins.

| Ratio >= | Points |
|----------|--------|
| 15% | +25 |
| 10% | +15 |
| 5% | +5 |

## Tiers

| Threshold | Tier |
|-----------|------|
| >= 150 | TIER-1 LANDMARK |
| >= 100 | TIER-2 IMPORTANT |
| < 100 | TIER-3 NOTABLE |

## Deduplication

Papers appearing in multiple categories are deduplicated by `arXiv_ID`. First occurrence retained. Final list sorted by descending score.

## Caching

S2 responses stored in `.arxiv_cache/s2_data.json` as `{arxiv_id: s2_response}`. New mode reads from cache if available. Update mode bypasses cache (`force_refresh=True`) and overwrites entries with fresh data.

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
