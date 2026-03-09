"""
arXiv Paper Retrieval and Ranking System

Usage:
    python arxiv-retrieval.py [categories] [year-month]
    python arxiv-retrieval.py --update <path/to/papers_raw.json>
    
Examples:
    python arxiv-retrieval.py                              # Defaults: cs.MA,cs.CL,cs.AI, current month
    python arxiv-retrieval.py cs.MA 2025-10                # Single category
    python arxiv-retrieval.py cs.MA,cs.CL 2025-10          # Multiple categories
    python arxiv-retrieval.py --update output/csMA_2025_10/papers_raw.json
    
Categories:
    Any valid arXiv category (see https://arxiv.org/category_taxonomy)
    
Modes:
    New (default): Fetch current month papers from arXiv, enrich each with
                   Semantic Scholar (venue, abstract, citations, hIndex),
                   score with all filters, export.
    Update (--update): Re-fetch S2 data for a previous run's JSON output.
                       Re-scores with citation count as a dominant signal.

Data sources:
    - arXiv: bulk paper listing by category/month (Title, Authors, Subjects)
    - Semantic Scholar: per-paper enrichment (venue, abstract, citations, hIndex)

Output:
    Files are organized in: output/<categories>_<year>_<month>/
"""

import os
import requests
from bs4 import BeautifulSoup
import json
import sys
import time
from datetime import datetime
from pathlib import Path

from exporter import export_papers, print_top_papers, print_statistics, compute_statistics

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Default categories to fetch (can be overridden via command line)
DEFAULT_CATEGORIES = ['cs.MA', 'cs.CL', 'cs.AI']


# =============================================================================
# VENUE SCORING
# =============================================================================

class VenueScorer:
    """
    Scores a paper's publication venue using Semantic Scholar data.
    
    Lookup order:
      1. Check downgraders (workshop, findings) — these override parent venue
      2. Match against VENUES dict using alternate_names then name
      3. Longer keys checked first to avoid "acl" matching "naacl"
      4. No match → 0
    """

    VENUES = {
        # Tier S: Top ML conferences
        'neurips': 120, 'nips': 120, 'icml': 120, 'iclr': 120,

        # Tier A: Top specialized conferences
        'emnlp': 100, 'cvpr': 100, 'iccv': 100, 'eccv': 100,
        'aaai': 100, 'ijcai': 100, 'sigir': 100, 'kdd': 100,
        'aamas': 100, 'acl': 100,

        # Tier A: Top journals
        'nature': 100, 'science': 100, 'jmlr': 100,
        'tacl': 90, 'tpami': 90,

        # Tier B: Strong conferences
        'naacl': 80, 'coling': 80, 'eacl': 80,
        'icra': 80, 'iros': 80,
        'uai': 80, 'aistats': 80, 'colt': 80, 'corl': 80, 'colm': 80,
        'tmlr': 80, 'jair': 80,
    }

    # Full name mappings for publicationVenue.name fallback
    VENUE_NAMES = {
        'neural information processing': 120,
        'international conference on machine learning': 120,
        'international conference on learning representations': 120,
        'association for computational linguistics': 100,
        'empirical methods in natural language processing': 100,
        'computer vision and pattern recognition': 100,
        'international conference on computer vision': 100,
        'european conference on computer vision': 100,
        'association for the advancement of artificial intelligence': 100,
        'autonomous agents and multi-agent systems': 100,
        'knowledge discovery and data mining': 100,
        'journal of machine learning research': 100,
        'transactions of the association for computational linguistics': 90,
        'pattern analysis and machine intelligence': 90,
        'north american chapter': 80,
        'uncertainty in artificial intelligence': 80,
        'artificial intelligence and statistics': 80,
        'conference on robot learning': 80,
        'transactions on machine learning research': 80,
        'journal of artificial intelligence research': 80,
    }

    # Sorted by key length descending so "naacl" matches before "acl",
    # "aistats" before "aaai", etc.
    _SORTED_VENUES = sorted(VENUES.items(), key=lambda x: (-len(x[0]), -x[1]))
    _SORTED_NAMES = sorted(VENUE_NAMES.items(), key=lambda x: (-len(x[0]), -x[1]))

    @classmethod
    def score(cls, paper):
        """
        Score a paper's venue from its S2-enriched Venue field.
        
        Returns:
            (score, venue_matched): score int, matched key str (or '' if none)
        """
        venue_str = paper.get('Venue', '').lower()
        if not venue_str:
            return 0, ''

        # Downgraders override parent venue
        if 'workshop' in venue_str:
            return 40, 'workshop'
        if 'findings' in venue_str:
            return 50, 'findings'

        # Try short abbreviations first (from alternate_names)
        for key, points in cls._SORTED_VENUES:
            if key in venue_str:
                return points, key

        # Fallback to full name matching (from publicationVenue.name)
        for name, points in cls._SORTED_NAMES:
            if name in venue_str:
                return points, name

        return 0, ''


# =============================================================================
# SEMANTIC SCHOLAR ENRICHMENT
# =============================================================================

class SemanticScholarCache:
    """File-based cache for Semantic Scholar data to avoid re-fetching"""

    def __init__(self, cache_dir=None):
        self.cache_dir = Path(cache_dir) if cache_dir else PROJECT_ROOT / ".arxiv_cache"
        self.cache_dir.mkdir(exist_ok=True)
        self.cache_file = self.cache_dir / "s2_data.json"
        self.cache = self._load()

    def _load(self):
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r') as f:
                    cache = json.load(f)
                    print(f"✓ Loaded {len(cache)} cached S2 entries")
                    return cache
            except Exception:
                return {}
        return {}

    def save(self):
        with open(self.cache_file, 'w') as f:
            json.dump(self.cache, f)

    def get(self, arxiv_id):
        return self.cache.get(arxiv_id)

    def has(self, arxiv_id):
        return arxiv_id in self.cache

    def set(self, arxiv_id, data):
        self.cache[arxiv_id] = data


class SemanticScholarEnricher:
    """Enriches papers with Semantic Scholar data using the batch API (1 request per 500 papers)"""

    BATCH_URL = "https://api.semanticscholar.org/graph/v1/paper/batch"
    FIELDS = "publicationVenue,citationCount,influentialCitationCount,authors.hIndex,abstract"
    BATCH_SIZE = 500

    def __init__(self):
        self.cache = SemanticScholarCache()
        self.api_key = os.environ.get("S2_API_KEY")
        self.headers = {"x-api-key": self.api_key} if self.api_key else {}

    def enrich_papers(self, papers, force_refresh=False):
        """
        Enrich papers with Semantic Scholar data via batch API.
        
        Args:
            force_refresh: If True, bypass cache and re-fetch all S2 data.
        """
        mode_label = "FORCE REFRESH" if force_refresh else "ENRICHMENT"
        print(f"\n{'='*60}")
        print(f"SEMANTIC SCHOLAR {mode_label}: {len(papers)} papers")
        print(f"{'='*60}\n")

        to_fetch = []
        cached = 0

        for paper in papers:
            arxiv_id = paper['arXiv_ID']
            if not force_refresh and self.cache.has(arxiv_id):
                self._apply_s2_data(paper, self.cache.get(arxiv_id))
                cached += 1
            else:
                to_fetch.append(paper)

        if cached:
            print(f"  ✓ {cached} papers loaded from cache")

        if not to_fetch:
            print(f"  ✓ All papers already cached")
            return papers

        fetched = 0
        failed = 0

        for batch_start in range(0, len(to_fetch), self.BATCH_SIZE):
            batch = to_fetch[batch_start:batch_start + self.BATCH_SIZE]
            ids = [f"arXiv:{p['arXiv_ID']}" for p in batch]

            print(f"  Fetching batch {batch_start+1}-{batch_start+len(batch)} of {len(to_fetch)}...")
            results = self._fetch_batch(ids)

            if results is None:
                failed += len(batch)
                continue

            for paper, s2_data in zip(batch, results):
                if s2_data is not None:
                    self.cache.set(paper['arXiv_ID'], s2_data)
                    self._apply_s2_data(paper, s2_data)
                    fetched += 1
                else:
                    self.cache.set(paper['arXiv_ID'], {})
                    self._apply_s2_data(paper, {})
                    failed += 1

            self.cache.save()

        print(f"\n✓ S2 enrichment complete:")
        print(f"  - Fetched: {fetched} new")
        print(f"  - From cache: {cached}")
        print(f"  - Not found: {failed}")
        print(f"  - Total: {fetched + cached}/{len(papers)}")

        return papers

    def _fetch_batch(self, ids):
        """POST batch request to S2. Retries on 429. Returns list aligned with input ids."""
        attempt = 0
        while True:
            try:
                response = requests.post(
                    self.BATCH_URL,
                    params={"fields": self.FIELDS},
                    json={"ids": ids},
                    headers=self.headers,
                    timeout=30,
                )

                if response.status_code == 200:
                    return response.json()
                if response.status_code == 429:
                    attempt += 1
                    wait = min(2 ** attempt, 60)
                    print(f"    ⚠ S2 rate limited, waiting {wait}s (attempt {attempt})")
                    time.sleep(wait)
                    continue

                print(f"    ⚠ S2 batch HTTP {response.status_code}")
                return None

            except requests.exceptions.Timeout:
                attempt += 1
                wait = min(2 ** attempt, 60)
                print(f"    ⚠ S2 timeout, retrying in {wait}s (attempt {attempt})")
                time.sleep(wait)
            except Exception as e:
                print(f"    ⚠ S2 batch error: {e}")
                return None

    def _apply_s2_data(self, paper, s2_data):
        """Apply Semantic Scholar data to a paper dict"""
        if not s2_data:
            paper['Venue'] = ''
            paper['Citation_Count'] = 0
            paper['Influential_Citations'] = 0
            paper['Max_Author_hIndex'] = 0
            return

        pub_venue = s2_data.get('publicationVenue') or {}
        alt_names = pub_venue.get('alternate_names', [])
        venue_name = pub_venue.get('name', '')
        paper['Venue'] = ', '.join(alt_names) if alt_names else venue_name

        paper['Citation_Count'] = s2_data.get('citationCount', 0) or 0
        paper['Influential_Citations'] = s2_data.get('influentialCitationCount', 0) or 0

        abstract = s2_data.get('abstract', '') or ''
        if abstract and not paper.get('Abstract'):
            paper['Abstract'] = abstract

        authors = s2_data.get('authors', [])
        h_indices = [a.get('hIndex', 0) or 0 for a in authors]
        paper['Max_Author_hIndex'] = max(h_indices) if h_indices else 0


# =============================================================================
# RETRIEVAL
# =============================================================================

class ArxivRetriever:
    """Fetches papers from arXiv listing page"""
    
    def __init__(self, category="cs.MA", year_month=None, max_papers=2000):
        self.category = category
        self.year_month = year_month or datetime.now().strftime("%Y-%m")
        self.max_papers = max_papers
        self.base_url = f"https://arxiv.org/list/{category}/{self.year_month}?show={max_papers}"
    
    def fetch_papers(self):
        """Fetch papers from arXiv listing page. Returns list of paper dicts."""
        print(f"Fetching papers from: {self.base_url}")
        
        response = requests.get(self.base_url)
        if response.status_code != 200:
            print(f"✗ Failed to fetch: HTTP {response.status_code}")
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        dt_tags = soup.find_all('dt')
        dd_tags = soup.find_all('dd')
        
        papers = []
        total = min(len(dt_tags), len(dd_tags))
        
        print(f"Found {total} papers, processing...")
        
        for i, (dt, dd) in enumerate(zip(dt_tags, dd_tags)):
            try:
                paper = self._parse_paper_entry(dt, dd)
                if paper:
                    paper['Category'] = self.category
                    papers.append(paper)
                    if (i + 1) % 100 == 0:
                        print(f"  Parsed {i + 1}/{total} papers...")
            except Exception as e:
                print(f"  Warning: Failed to parse paper {i}: {e}")
                continue
        
        print(f"✓ Parsed {len(papers)} papers from listing")
        return papers
    
    def _parse_paper_entry(self, dt, dd):
        """Parse a single paper entry from dt/dd tags"""
        arxiv_link = dt.find('a', title='Abstract')
        if not arxiv_link:
            return None
        arxiv_id = arxiv_link.text.strip().replace('arXiv:', '')
        
        title_div = dd.find('div', class_='list-title')
        title = title_div.get_text().replace('Title:', '').strip() if title_div else ''
        
        authors_div = dd.find('div', class_='list-authors')
        authors = authors_div.get_text().replace('Authors:', '').strip() if authors_div else ''
        
        subjects_div = dd.find('div', class_='list-subjects')
        subjects = subjects_div.get_text().replace('Subjects:', '').strip() if subjects_div else ''
        
        return {
            'arXiv_ID': arxiv_id,
            'Title': title,
            'Authors': authors,
            'Subjects': subjects,
            'Abstract': '',
            'Venue': '',
            'Citation_Count': 0,
            'Influential_Citations': 0,
            'Max_Author_hIndex': 0,
        }


# =============================================================================
# RANKING
# =============================================================================

class PaperRanker:
    """Multi-criteria paper ranking system with tier classification"""
    
    # Tier thresholds
    TIER1_THRESHOLD = 150  # LANDMARK
    TIER2_THRESHOLD = 100  # IMPORTANT
    
    MAS_KEYWORDS = [
        'multi-agent', 'multiagent', 'agent coordination', 'agent-to-agent',
        'llm agent', 'agentic', 'multi agent', 'autonomous agent'
    ]
    
    REASONING_KEYWORDS = [
        'communication', 'collaboration', 'cooperation', 'orchestration',
        'framework', 'reasoning', 'planning', 'coordination', 'negotiation',
        'benchmark', 'survey'
    ]
    
    ABSTRACT_KEYWORDS = {
        'multi-agent': 25,
        'agent': 10,
        'network architecture': 15,
        'large language model': 15,
        'coordination': 15,
        'cooperation': 15,
        'emergent': 20,
        'decentralized': 15,
        'distributed': 10,
    }
    
    HINDEX_TIERS = [(60, 35), (40, 25), (20, 15)]

    CITATION_TIERS = [(1000, 100), (500, 80), (200, 60), (50, 40), (10, 20)]

    INFLUENTIAL_RATIO_TIERS = [(0.15, 25), (0.10, 15), (0.05, 5)]

    def __init__(self, update_mode=False):
        self.papers = []
        self.update_mode = update_mode
    
    def add_papers(self, papers_data):
        self.papers = papers_data
        print(f"✓ Loaded {len(papers_data)} papers for ranking")
    
    def score_paper(self, paper):
        """Calculate relevance score with explainable factors"""
        score = 0
        factors = []
        
        title = paper.get('Title', '').lower()
        abstract = paper.get('Abstract', '').lower()
        has_abstract = len(abstract) > 50
        
        # FILTER A: Venue (from Semantic Scholar data)
        venue_score, venue_matched = VenueScorer.score(paper)
        if venue_score > 0:
            score += venue_score
            factors.append(f"VENUE(+{venue_score}:{venue_matched})")
        
        # FILTER B: Core MAS Keywords in title
        if any(kw in title for kw in self.MAS_KEYWORDS):
            score += 50
            factors.append("MAS_TITLE(+50)")
        
        # FILTER C: Reasoning/Framework/Structure in title
        if any(kw in title for kw in self.REASONING_KEYWORDS):
            score += 25
            factors.append("REASONING(+25)")
        
        # FILTER D: Abstract-based scoring
        if has_abstract:
            abstract_score = 0
            for kw, kw_score in self.ABSTRACT_KEYWORDS.items():
                if kw in abstract:
                    abstract_score += kw_score
            abstract_score = min(50, abstract_score)
            if abstract_score > 0:
                score += abstract_score
                factors.append(f"ABSTRACT(+{abstract_score})")
        
        # FILTER E: Author hIndex (active in both modes)
        h_index = paper.get('Max_Author_hIndex', 0)
        for threshold, pts in self.HINDEX_TIERS:
            if h_index >= threshold:
                score += pts
                factors.append(f"HINDEX(+{pts}:h={h_index})")
                break

        # FILTER F: Citation count (update mode only)
        if self.update_mode:
            citations = paper.get('Citation_Count', 0)
            for threshold, pts in self.CITATION_TIERS:
                if citations >= threshold:
                    score += pts
                    factors.append(f"CITATIONS(+{pts}:n={citations})")
                    break

        # FILTER G: Influential citation ratio (update mode only, requires >= 10 citations)
        if self.update_mode:
            citations = paper.get('Citation_Count', 0)
            influential = paper.get('Influential_Citations', 0)
            if citations >= 10:
                ratio = influential / citations
                for threshold, pts in self.INFLUENTIAL_RATIO_TIERS:
                    if ratio >= threshold:
                        score += pts
                        factors.append(f"INFLUENTIAL(+{pts}:{ratio:.0%})")
                        break
        
        return score, factors
    
    def assign_tier(self, score):
        if score >= self.TIER1_THRESHOLD:
            return "🔥 TIER-1 LANDMARK"
        elif score >= self.TIER2_THRESHOLD:
            return "⭐ TIER-2 IMPORTANT"
        else:
            return "✓ TIER-3 NOTABLE"
    
    def rank_all(self):
        """Rank all papers and return sorted list"""
        print("\nRanking papers...")
        
        for paper in self.papers:
            score, factors = self.score_paper(paper)
            paper['Score'] = score
            paper['Factors'] = factors
            paper['Tier'] = self.assign_tier(score)
        
        self.papers.sort(key=lambda x: x['Score'], reverse=True)
        print(f"✓ Ranked {len(self.papers)} papers")
        return self.papers


# =============================================================================
# MAIN
# =============================================================================

def parse_args():
    """Parse command line arguments"""
    args = {
        'categories': DEFAULT_CATEGORIES,
        'year_month': datetime.now().strftime("%Y-%m"),
        'update_path': None,
    }
    
    argv = sys.argv[1:]
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == '--update' and i + 1 < len(argv):
            args['update_path'] = argv[i + 1]
            i += 1
        elif '.' in arg and len(arg) < 20:
            if ',' in arg:
                args['categories'] = [c.strip() for c in arg.split(',')]
            else:
                args['categories'] = [arg]
        elif '-' in arg and len(arg) == 7:
            args['year_month'] = arg
        i += 1
    
    return args


def process_category(category, year_month):
    """Process a single category: arXiv scrape → S2 enrichment → ranking"""
    print(f"\n{'='*80}")
    print(f"PROCESSING: {category}")
    print(f"{'='*80}\n")
    
    retriever = ArxivRetriever(category=category, year_month=year_month)
    papers = retriever.fetch_papers()
    
    if not papers:
        print(f"✗ No papers retrieved for {category}")
        return []
    
    enricher = SemanticScholarEnricher()
    papers = enricher.enrich_papers(papers)
    
    ranker = PaperRanker()
    ranker.add_papers(papers)
    ranked_papers = ranker.rank_all()
    
    return ranked_papers


def run_update(update_path):
    """Update mode: reload previous papers, re-fetch S2 data, re-score with citations"""
    json_path = Path(update_path)
    if not json_path.exists():
        print(f"✗ File not found: {json_path}")
        return

    print("=" * 80)
    print("UPDATE MODE")
    print("=" * 80)
    print(f"\nLoading papers from: {json_path}")

    with open(json_path, 'r') as f:
        papers = json.load(f)

    print(f"✓ Loaded {len(papers)} papers")

    enricher = SemanticScholarEnricher()
    papers = enricher.enrich_papers(papers, force_refresh=True)

    ranker = PaperRanker(update_mode=True)
    ranker.add_papers(papers)
    ranked_papers = ranker.rank_all()

    stats = compute_statistics(ranked_papers)
    print_statistics(stats)
    print_top_papers(ranked_papers, top_n=15)

    output_dir = json_path.parent
    print(f"\n{'='*80}")
    print("RE-EXPORTING")
    print(f"{'='*80}\n")

    export_papers(
        ranked_papers,
        output_dir=output_dir,
        base_name="papers_updated",
        export_json=True
    )

    print(f"\n{'='*80}")
    print("✓ UPDATE COMPLETE!")
    print(f"{'='*80}")
    print(f"\nUpdated files saved to: {output_dir}/")


def main():
    args = parse_args()

    if args['update_path']:
        run_update(args['update_path'])
        return
    
    print("=" * 80)
    print("ARXIV PAPER RETRIEVAL & RANKING SYSTEM")
    print("=" * 80)
    print(f"\nCategories: {', '.join(args['categories'])}")
    print(f"Period: {args['year_month']}")
    print(f"Sources: arXiv (listing) + Semantic Scholar (enrichment)")
    
    # Process each category
    all_papers = []
    for category in args['categories']:
        papers = process_category(
            category=category,
            year_month=args['year_month'],
        )
        all_papers.extend(papers)
    
    if not all_papers:
        print("\n✗ No papers retrieved from any category. Exiting.")
        return
    
    # Remove duplicates (papers can appear in multiple categories)
    seen_ids = set()
    unique_papers = []
    for paper in all_papers:
        if paper['arXiv_ID'] not in seen_ids:
            seen_ids.add(paper['arXiv_ID'])
            unique_papers.append(paper)
    
    if len(unique_papers) < len(all_papers):
        print(f"\n✓ Removed {len(all_papers) - len(unique_papers)} duplicate papers")
    
    # Re-sort all papers by score
    unique_papers.sort(key=lambda x: x['Score'], reverse=True)
    
    # Print combined statistics
    stats = compute_statistics(unique_papers)
    print_statistics(stats)
    
    # Print top papers
    print_top_papers(unique_papers, top_n=15)
    
    # Export to organized folder
    print("\n" + "=" * 80)
    print("EXPORTING")
    print("=" * 80 + "\n")
    
    # Create output directory name
    categories_str = "_".join([c.replace('.', '') for c in args['categories']])
    year_month_str = args['year_month'].replace('-', '_')
    output_dir = PROJECT_ROOT / "output" / f"{categories_str}_{year_month_str}"
    
    export_papers(
        unique_papers,
        output_dir=output_dir,
        base_name="papers",
        export_json=True
    )
    
    print("\n" + "=" * 80)
    print("✓ COMPLETE!")
    print("=" * 80)
    print(f"\nAll files saved to: {output_dir}/")


if __name__ == '__main__':
    main()
