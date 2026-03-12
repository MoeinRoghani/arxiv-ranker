"""
Runs --update on all site data entries within the past 12 months.
Waits 5 minutes between each update to respect S2 rate limits.

Called by the weekly cron workflow. Not intended for manual use.
"""

import json
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SITE_DATA_DIR = PROJECT_ROOT / 'site' / 'public' / 'data'
WAIT_SECONDS = 300  # 5 minutes between updates


def main():
    index_path = SITE_DATA_DIR / 'index.json'
    if not index_path.exists():
        print("No index.json found. Nothing to update.")
        return

    with open(index_path) as f:
        index = json.load(f)

    cutoff = (datetime.now(timezone.utc) - timedelta(days=365)).strftime('%Y-%m')
    eligible = [e for e in index if e['year_month'] >= cutoff]

    if not eligible:
        print("No entries within past 12 months.")
        return

    print(f"Found {len(eligible)} entries to update (cutoff >= {cutoff})")

    for i, entry in enumerate(eligible):
        run_id = entry['id']
        raw_path = SITE_DATA_DIR / run_id / 'papers_raw.json'

        if not raw_path.exists():
            print(f"⚠ Skipping {run_id}: papers_raw.json not found")
            continue

        print(f"\n{'='*60}")
        print(f"Updating [{i+1}/{len(eligible)}]: {run_id}")
        print(f"{'='*60}")

        result = subprocess.run(
            [sys.executable, 'src/ranker.py', '--update', str(raw_path)],
            cwd=str(PROJECT_ROOT),
        )

        if result.returncode != 0:
            print(f"⚠ Update failed for {run_id}")
            continue

        # ranker writes papers_updated_raw.json — replace the original
        updated_path = raw_path.parent / 'papers_updated_raw.json'
        if updated_path.exists():
            updated_path.rename(raw_path)

        # Clean up CSV/TXT artifacts from update export
        for f in raw_path.parent.iterdir():
            if f.name.startswith('papers_updated_') and f.name != 'papers_raw.json':
                f.unlink()

        # Rebuild site display JSON
        categories = entry['categories']
        year_month = entry['year_month']

        subprocess.run(
            [sys.executable, 'src/site_builder.py', str(raw_path),
             '--categories', ','.join(categories),
             '--year-month', year_month],
            cwd=str(PROJECT_ROOT),
        )

        if i < len(eligible) - 1:
            print(f"\n⏳ Waiting {WAIT_SECONDS}s before next update...")
            time.sleep(WAIT_SECONDS)

    print(f"\n✓ All updates complete")


if __name__ == '__main__':
    main()
