# arXiv Research Ranker

Automated pipeline that fetches monthly arXiv paper listings, enriches them with Semantic Scholar metadata, scores them with a multi-signal ranking algorithm, and publishes results to a static website with AI-powered paper analysis.

**Live site:** [rankedresearch.com](https://rankedresearch.com)

## How It Works

1. **Fetch** — Scrapes arXiv listings by category and month
2. **Enrich** — Batch API call to Semantic Scholar for venue, citations, hIndex, abstract
3. **Score** — Multi-filter ranking (venue, keywords, hIndex, citations)
4. **Publish** — Builds a React frontend, deploys to GitHub Pages
5. **Analyze** — On-demand AI analysis of individual papers via OpenAI

Runs automatically via GitHub Actions. See [docs/DEVELOPER.md](docs/DEVELOPER.md) for full technical reference.

## Automation

| Workflow | Schedule | What it does |
|----------|----------|--------------|
| `generate.yml` | 1st of each month, 06:00 UTC | Generates rankings for the previous month |
| `update.yml` | Every Monday, 06:00 UTC | Re-scores all entries from the past 12 months with fresh citation data |
| `deploy.yml` | After generate/update/save | Builds and deploys the site |
| `save-analysis.yml` | On demand | Persists AI paper analysis to the repo |

Generate and update also support manual triggering from the website UI. Generate accepts custom keyword overrides from the UI's keyword editor.

## Local Development

```bash
pip install -r requirements.txt

# Generate rankings
python src/ranker.py cs.MA,cs.CL,cs.AI 2026-02

# Generate with custom keywords
TITLE_KEYWORDS='{"multi-agent": 50, "llm": 30}' python src/ranker.py cs.MA 2026-02

# Update existing rankings
python src/ranker.py --update output/csMA_csCL_csAI_2026_02/papers_raw.json

# Run the frontend
cd site && npm install && npm run dev
```

### Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `S2_API_KEY` | GitHub Secrets / local env | **Required.** Semantic Scholar API key |
| `VITE_OPENAI_API_KEY` | GitHub Secrets | OpenAI API key for paper analysis |
| `VITE_GITHUB_REPO` | `site/.env` (local) / injected by workflow | Repository name for workflow dispatch |
| `VITE_GITHUB_PAT` | `site/.env` (local) / GitHub Secrets | GitHub PAT for triggering workflows from UI |

## Scoring

| Filter | Source | Max Points | Notes |
|--------|--------|------------|-------|
| Venue | S2 `publicationVenue` | 120 | Tiered by conference ranking |
| Title keywords | Title text | 70 | Customizable via UI or env var |
| Abstract keywords | S2 abstract | 60 | Customizable via UI or env var |
| hIndex | S2 `authors.hIndex` | 35 | Power-law formula |
| Citations | S2 `citationCount` | continuous | Update mode only |
| Influential ratio | S2 influential/total | 30 | Update mode only, requires >= 10 citations |

**Tiers:** Landmark (>= 150), Important (>= 100), Notable (< 100)

Default keywords are tuned for multi-agent systems and LLM agent research. They can be customized per-run from the UI's keyword editor. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full scoring specification.

## Project Structure

```
src/
  ranker.py          # Retrieval, enrichment, scoring
  exporter.py        # CSV/JSON/summary export
  site_builder.py    # Transforms output → site JSON, manages dataset index
  run_updates.py     # Batch updater for weekly cron
site/                # React + Vite frontend
  src/
    App.tsx          # Root component, hash routing, workflow polling
    lib/             # API layer, types, formatters, OpenAI client
    components/      # UI components (tables, cards, analysis, generate panel)
  public/data/       # Generated datasets (one folder per month)
.github/workflows/   # generate.yml, update.yml, deploy.yml, save-analysis.yml
docs/                # ARCHITECTURE.md, DEVELOPER.md
```
