import { useMemo } from 'react';
import type { Paper } from '../lib/types';
import { tierClass, tierLabel, truncateAuthors, shortVenue } from '../lib/format';

interface Props {
  papers: Paper[];
  tierFilter: string | null;
  categoryFilter: string | null;
  venueFilter?: string | null;
  onViewAll?: () => void;
  onAnalyze?: (paper: Paper) => void;
  showAll?: boolean;
}

export default function PapersTable({ papers, tierFilter, categoryFilter, venueFilter, onViewAll, onAnalyze, showAll = false }: Props) {
  const filtered = useMemo(() => {
    let result = papers;

    if (tierFilter === 'landmarks') {
      result = result.filter(p => p.Tier?.includes('LANDMARK'));
    } else if (tierFilter === 'important') {
      result = result.filter(p => p.Tier?.includes('IMPORTANT'));
    } else if (tierFilter === 'notable') {
      result = result.filter(p => p.Tier?.includes('NOTABLE'));
    }

    if (categoryFilter) {
      result = result.filter(p =>
        p.Categories?.some(c => c.toLowerCase() === categoryFilter.toLowerCase())
      );
    }

    if (venueFilter) {
      result = result.filter(p => shortVenue(p.Venue) === venueFilter);
    }

    return result;
  }, [papers, tierFilter, categoryFilter, venueFilter]);

  const landmarks = filtered.filter(p => p.Tier?.includes('LANDMARK'));
  const others = filtered.filter(p => !p.Tier?.includes('LANDMARK'));
  const topOthers = others.slice(0, 6);
  const remaining = others.slice(6);

  const visible = showAll
    ? [...landmarks, ...others]
    : [...landmarks, ...topOthers];

  if (filtered.length === 0) {
    return <div className="loading">No papers match the current filters.</div>;
  }

  return (
    <div>
      <table className="papers-table">
        <colgroup>
          <col style={{ width: '28px' }} />
          <col style={{ width: '96px' }} />
          <col style={{ width: '44px' }} />
          <col style={{ width: '42%' }} />
          <col style={{ width: '64px' }} />
          <col style={{ width: '120px' }} />
          <col style={{ width: '74px' }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Tier</th>
            <th>Score</th>
            <th>Title</th>
            <th>Venue</th>
            <th className="col-authors">Authors</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p, i) => (
            <PaperRow key={p.arXiv_ID} paper={p} rank={i + 1} onAnalyze={onAnalyze} />
          ))}
        </tbody>
      </table>

      {!showAll && remaining.length > 0 && onViewAll && (
        <button className="show-more" onClick={onViewAll}>
          View all {filtered.length} papers →
        </button>
      )}
    </div>
  );
}

function PaperRow({ paper, rank, onAnalyze }: { paper: Paper; rank: number; onAnalyze?: (paper: Paper) => void }) {
  const tc = tierClass(paper.Tier);
  const factors = Array.isArray(paper.Factors)
    ? paper.Factors.slice(0, 3).join(', ')
    : '';

  return (
    <tr className={tc === 'landmark' ? 'landmark-row' : ''}>
      <td className="paper-rank">{rank}</td>
      <td>
        <span className={`tier-badge tier-${tc}`}>{tierLabel(paper.Tier)}</span>
        <div className="paper-categories">
          {paper.Categories?.map(c => (
            <span key={c} className="cat-tag">{c}</span>
          ))}
        </div>
      </td>
      <td className="paper-score">{paper.Score}</td>
      <td className="paper-title">
        <a
          href={`https://arxiv.org/abs/${paper.arXiv_ID}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {paper.Title}
        </a>
        {paper.New && <span className="new-badge">Newly discovered</span>}
        {factors && <div className="paper-factors">{factors}</div>}
      </td>
      <td className="paper-venue" title={paper.Venue || ''}>{shortVenue(paper.Venue)}</td>
      <td className="paper-authors"><div className="authors-clamp">{truncateAuthors(paper.Authors, 80)}</div></td>
      <td className="paper-actions">
        {onAnalyze && (
          <button
            className="analyze-btn"
            onClick={() => onAnalyze(paper)}
            title="AI Analysis"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Analyze
          </button>
        )}
      </td>
    </tr>
  );
}
