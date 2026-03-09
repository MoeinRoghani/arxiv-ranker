"""
Paper Export Module

Reusable CSV/JSON export for ranked papers from any source (arXiv, Semantic Scholar, etc.)

Usage:
    from export_to_csv import export_papers, print_top_papers, print_statistics
    
    # Export ranked papers to organized folder
    export_papers(papers_data, output_dir="output/cs_MA_2025_11")
    
    # Print to console
    print_top_papers(papers_data, top_n=15)
    print_statistics(stats_dict)
"""

import pandas as pd
import json
import statistics
from datetime import datetime
from pathlib import Path


# Tier labels used throughout the system
TIERS = [
    '🔥 TIER-1 LANDMARK',
    '⭐ TIER-2 IMPORTANT', 
    '✓ TIER-3 NOTABLE',
]


def export_papers(papers_data, output_dir=None, base_name=None, export_json=True):
    """
    Export papers to organized folder with CSV files and JSON
    
    Args:
        papers_data (list): List of paper dictionaries with keys:
                           arXiv_ID (or any ID), Title, Authors, Score, Factors, Tier
        output_dir (str/Path): Directory to save files. Created if doesn't exist.
                              If None, creates "output/Papers_TIMESTAMP"
        base_name (str): Base name for files (e.g., "papers"). If None, uses "papers"
        export_json (bool): Whether to also export raw JSON
    
    Returns:
        dict: Paths to created files
    """
    if not papers_data:
        print("✗ No papers to export")
        return {}
    
    # Setup output directory
    if output_dir is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = Path("output") / f"Papers_{timestamp}"
    else:
        output_dir = Path(output_dir)
    
    # Create directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Base name for files
    if base_name is None:
        base_name = "papers"
    
    # Create DataFrame and sort by score
    df = pd.DataFrame(papers_data)
    df = df.sort_values('Score', ascending=False).reset_index(drop=True)
    
    output_files = {}
    
    # 1. Export ALL papers (ranked)
    all_file = output_dir / f"{base_name}_ALL_RANKED.csv"
    df.to_csv(all_file, index=False)
    output_files['all'] = str(all_file)
    print(f"✓ Exported all {len(df)} papers to: {all_file}")
    
    # 2. Export by Tier
    for tier in TIERS:
        tier_df = df[df['Tier'] == tier]
        if len(tier_df) > 0:
            tier_name = tier.split()[-1].lower()
            tier_file = output_dir / f"{base_name}_{tier_name}.csv"
            tier_df.to_csv(tier_file, index=False)
            output_files[tier_name] = str(tier_file)
            print(f"✓ Exported {len(tier_df)} {tier_name} papers to: {tier_file}")
    
    # 3. Generate summary text file
    summary_file = output_dir / f"{base_name}_SUMMARY.txt"
    _write_summary(df, summary_file)
    output_files['summary'] = str(summary_file)
    
    # 4. Export JSON if requested
    if export_json:
        json_file = output_dir / f"{base_name}_raw.json"
        with open(json_file, 'w') as f:
            json.dump(papers_data, f, indent=2)
        output_files['json'] = str(json_file)
        print(f"✓ Saved raw data: {json_file}")
    
    print(f"\n✓ EXPORT COMPLETE - {len(output_files)} files created in {output_dir}/")
    return output_files


def _write_summary(df, filepath):
    """Write summary statistics to text file"""
    with open(filepath, 'w') as f:
        f.write("=" * 80 + "\n")
        f.write("PAPER RANKING SUMMARY\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"Total papers: {len(df)}\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        # Tier breakdown
        f.write("TIER BREAKDOWN:\n")
        for tier in TIERS:
            count = len(df[df['Tier'] == tier])
            if count > 0:
                f.write(f"  {tier}: {count} papers\n")
        
        # Score statistics
        f.write(f"\nSCORE STATISTICS:\n")
        f.write(f"  Max:    {int(df['Score'].max())} pts\n")
        f.write(f"  Min:    {int(df['Score'].min())} pts\n")
        f.write(f"  Mean:   {int(df['Score'].mean())} pts\n")
        f.write(f"  Median: {int(df['Score'].median())} pts\n")
        
        # Top 15 papers
        f.write(f"\nTOP 15 PAPERS:\n")
        for i, (_, row) in enumerate(df.head(15).iterrows()):
            title = row.get('Title', 'Unknown')[:70]
            paper_id = row.get('arXiv_ID', row.get('ID', 'Unknown'))
            score = int(row['Score'])
            tier = row['Tier']
            f.write(f"\n  [{i+1}] {title}\n")
            f.write(f"      ID: {paper_id} | Score: {score} | {tier}\n")
    
    print(f"✓ Generated summary: {filepath}")


def print_top_papers(papers, top_n=15):
    """
    Print top papers to console
    
    Args:
        papers (list): List of paper dictionaries (must have Score, Tier, Title, Factors)
        top_n (int): Number of papers to print
    """
    sorted_papers = sorted(papers, key=lambda x: x.get('Score', 0), reverse=True)
    
    print("\n" + "=" * 80)
    print(f"TOP {min(top_n, len(sorted_papers))} PAPERS")
    print("=" * 80)
    
    for i, paper in enumerate(sorted_papers[:top_n]):
        factors = paper.get('Factors', [])
        if isinstance(factors, list):
            factors_str = ', '.join(factors[:3]) if factors else 'None'
        else:
            factors_str = str(factors)
        
        has_abstract = "📄" if len(paper.get('Abstract', '')) > 50 else ""
        paper_id = paper.get('arXiv_ID', paper.get('ID', paper.get('id', 'Unknown')))
        
        print(f"\n[{i+1}] {paper.get('Tier', 'UNRANKED')} | SCORE: {paper.get('Score', 0)} pts {has_abstract}")
        print(f"    Title: {paper.get('Title', 'Unknown')[:75]}")
        print(f"    ID: {paper_id} | Factors: {factors_str}")


def print_statistics(stats):
    """
    Print ranking statistics to console
    
    Args:
        stats (dict): Statistics dictionary with keys:
                     total, max_score, min_score, avg_score, median_score,
                     and tier counts
    """
    print("\n" + "=" * 80)
    print("RANKING STATISTICS")
    print("=" * 80)
    print(f"Total papers: {stats.get('total', 0)}")
    
    if stats.get('with_abstracts', 0) > 0:
        print(f"Papers with abstracts: {stats['with_abstracts']}")
    
    print(f"Score range: {stats.get('min_score', 0)} - {stats.get('max_score', 0)} pts")
    print(f"Average: {int(stats.get('avg_score', 0))} pts | Median: {int(stats.get('median_score', 0))} pts")
    
    print(f"\nTier Distribution:")
    for tier in TIERS:
        count = stats.get(tier, 0)
        if count > 0:
            print(f"  {tier}: {count} papers")


def compute_statistics(papers):
    """
    Compute statistics from a list of ranked papers
    
    Args:
        papers (list): List of paper dictionaries with Score and Tier fields
    
    Returns:
        dict: Statistics dictionary
    """
    if not papers:
        return {}
    
    scores = [p.get('Score', 0) for p in papers]
    abstracts_count = len([p for p in papers if len(p.get('Abstract', '')) > 50])
    
    stats = {
        'total': len(papers),
        'with_abstracts': abstracts_count,
        'max_score': max(scores),
        'min_score': min(scores),
        'avg_score': statistics.mean(scores),
        'median_score': statistics.median(scores),
    }
    
    for tier in TIERS:
        stats[tier] = len([p for p in papers if p.get('Tier') == tier])
    
    return stats


if __name__ == "__main__":
    print("Paper Export Module")
    print("-" * 40)
    print("This is a library module. Import and use:")
    print()
    print("  from export_to_csv import export_papers, print_top_papers")
    print()
    print("Functions:")
    print("  export_papers(papers, output_dir)  - Export to organized folder")
    print("  print_top_papers(papers, n)        - Print top N papers to console")
    print("  print_statistics(stats)            - Print statistics to console")
    print("  compute_statistics(papers)         - Compute stats from paper list")
