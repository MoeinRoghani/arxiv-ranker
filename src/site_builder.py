"""
Transforms ranker output into lightweight JSON for the static site.
Maintains site/data/index.json manifest.

Usage:
    python src/site_builder.py <papers_json> --categories cs.MA,cs.CL --year-month 2026-03
"""

import json
import sys
import shutil
from pathlib import Path
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SITE_DATA_DIR = PROJECT_ROOT / 'site' / 'public' / 'data'

SITE_FIELDS = [
    'arXiv_ID', 'Title', 'Authors', 'Score', 'Tier', 'Factors',
    'Venue', 'Categories', 'Citation_Count', 'Influential_Citations',
    'Max_Author_hIndex',
]


def build(papers_json_path, categories, year_month):
    """Read full papers JSON, write lightweight site JSON + raw copy, update index."""
    papers_path = Path(papers_json_path)
    with open(papers_path) as f:
        papers = json.load(f)

    cat_str = '_'.join(c.replace('.', '') for c in categories)
    ym_str = year_month.replace('-', '_')
    run_id = f"{cat_str}_{ym_str}"
    run_dir = SITE_DATA_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    prev_ids = set()
    prev_papers_path = run_dir / 'papers.json'
    if prev_papers_path.exists():
        with open(prev_papers_path) as f:
            prev_ids = {p['arXiv_ID'] for p in json.load(f)}

    site_papers = []
    for p in papers:
        sp = {k: p.get(k) for k in SITE_FIELDS if p.get(k) is not None}
        if prev_ids and sp.get('arXiv_ID') not in prev_ids:
            sp['New'] = True
        site_papers.append(sp)
    site_papers.sort(key=lambda x: x.get('Score', 0), reverse=True)

    with open(run_dir / 'papers.json', 'w') as f:
        json.dump(site_papers, f)

    raw_dest = run_dir / 'papers_raw.json'
    if papers_path.resolve() != raw_dest.resolve():
        shutil.copy2(papers_path, raw_dest)

    _update_index(run_id, categories, year_month, site_papers)

    new_count = sum(1 for p in site_papers if p.get('New'))
    print(f"✓ Site data written to {run_dir}" +
          (f" ({new_count} newly added)" if new_count else ""))
    return run_id


def _update_index(run_id, categories, year_month, papers):
    """Add or replace an entry in site/data/index.json."""
    SITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    index_path = SITE_DATA_DIR / 'index.json'
    index = []
    if index_path.exists():
        with open(index_path) as f:
            index = json.load(f)

    index = [e for e in index if e['id'] != run_id]

    landmarks = sum(1 for p in papers if 'LANDMARK' in p.get('Tier', ''))
    important = sum(1 for p in papers if 'IMPORTANT' in p.get('Tier', ''))

    index.append({
        'id': run_id,
        'categories': categories,
        'year_month': year_month,
        'paper_count': len(papers),
        'landmarks': landmarks,
        'important': important,
        'last_updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    })

    index.sort(key=lambda x: x['year_month'], reverse=True)

    with open(index_path, 'w') as f:
        json.dump(index, f, indent=2)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python src/site_builder.py <papers_json> --categories cs.MA,cs.CL --year-month 2026-03")
        sys.exit(1)

    papers_path = sys.argv[1]
    categories = ['cs.MA', 'cs.CL', 'cs.AI']
    year_month = None

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--categories' and i + 1 < len(sys.argv):
            categories = [c.strip() for c in sys.argv[i + 1].split(',')]
            i += 2
        elif sys.argv[i] == '--year-month' and i + 1 < len(sys.argv):
            year_month = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    if not year_month:
        parts = Path(papers_path).parent.name.split('_')
        if len(parts) >= 2:
            year_month = f"{parts[-2]}-{parts[-1]}"
        else:
            year_month = datetime.now().strftime('%Y-%m')

    build(papers_path, categories, year_month)
