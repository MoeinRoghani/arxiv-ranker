import { useState, useEffect, useMemo } from 'react';
import type { RunEntry, Paper } from '../lib/types';
import { formatYearMonth, shortVenue } from '../lib/format';
import PapersTable from './PapersTable';

interface Props {
  datasetKey: string;
  entry: RunEntry | null;
  onBack: () => void;
  fetchPapers: (datasetKey: string) => Promise<Paper[]>;
}

export default function AllPapersView({ datasetKey, entry, onBack, fetchPapers }: Props) {
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeVenue, setActiveVenue] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'venue' | 'citations'>('score');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchPapers(datasetKey).then((data) => {
      setPapers(data);
      setLoading(false);
    });
  }, [datasetKey, fetchPapers]);

  const categories = useMemo(() => {
    if (!papers) return [];
    const set = new Set(papers.flatMap(p => p.Categories ?? []));
    return Array.from(set).sort();
  }, [papers]);

  const venues = useMemo(() => {
    if (!papers) return [];
    const counts = new Map<string, number>();
    for (const p of papers) {
      const v = shortVenue(p.Venue);
      if (v !== '-') counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v);
  }, [papers]);

  const sortedPapers = useMemo(() => {
    if (!papers) return null;
    const sorted = [...papers];
    switch (sortBy) {
      case 'score':
        sorted.sort((a, b) => b.Score - a.Score);
        break;
      case 'venue':
        sorted.sort((a, b) => (a.Venue || '').localeCompare(b.Venue || '') || b.Score - a.Score);
        break;
      case 'citations':
        sorted.sort((a, b) => b.Citation_Count - a.Citation_Count || b.Score - a.Score);
        break;
    }
    return sorted;
  }, [papers, sortBy]);

  return (
    <>
      <header>
        <div className="container header-inner">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h1>
            {entry ? formatYearMonth(entry.year_month) : datasetKey}
            {entry && (
              <span className="all-papers-meta">
                {entry.paper_count} papers · {entry.categories.join(', ')}
              </span>
            )}
          </h1>
        </div>
      </header>

      <main className="container main-content">
        {papers && (
          <div className="filter-bar">
            <div className="filter-group filter-group-search">
              <input
                type="text"
                className="search-input"
                placeholder="Search by title or author..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <button
                className={`filter-chip ${activeTier === null ? 'active' : ''}`}
                onClick={() => setActiveTier(null)}
              >All tiers</button>
              {['landmarks', 'important', 'notable'].map(t => (
                <button
                  key={t}
                  className={`filter-chip ${activeTier === t ? 'active' : ''}`}
                  onClick={() => setActiveTier(activeTier === t ? null : t)}
                >{t}</button>
              ))}
            </div>

            <div className="filter-group">
              <button
                className={`filter-chip ${activeCategory === null ? 'active' : ''}`}
                onClick={() => setActiveCategory(null)}
              >All categories</button>
              {categories.map(c => (
                <button
                  key={c}
                  className={`filter-chip ${activeCategory === c ? 'active' : ''}`}
                  onClick={() => setActiveCategory(activeCategory === c ? null : c)}
                >{c}</button>
              ))}
            </div>

            {venues.length > 0 && (
              <div className="filter-group">
                <select
                  className="filter-select"
                  value={activeVenue ?? ''}
                  onChange={(e) => setActiveVenue(e.target.value || null)}
                >
                  <option value="">All venues</option>
                  {venues.slice(0, 20).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="filter-group">
              <select
                className="filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="score">Sort by score</option>
                <option value="citations">Sort by citations</option>
                <option value="venue">Sort by venue</option>
              </select>
            </div>
          </div>
        )}

        {loading && <div className="loading">Loading all papers...</div>}
        {sortedPapers && (
          <PapersTable
            papers={sortedPapers}
            datasetKey={datasetKey}
            tierFilter={activeTier}
            categoryFilter={activeCategory}
            venueFilter={activeVenue}
            searchQuery={search}
            showAll
          />
        )}
      </main>
    </>
  );
}
