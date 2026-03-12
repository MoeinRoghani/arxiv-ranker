import { useMemo } from 'react';
import type { Paper } from '../lib/types';
import { tierClass, tierLabel, truncateAuthors, shortVenue } from '../lib/format';

interface Props {
  papers: Paper[];
  tierFilter: string | null;
  categoryFilter: string | null;
  venueFilter?: string | null;
  onViewAll?: () => void;
  showAll?: boolean;
}

export default function PapersTable({ papers, tierFilter, categoryFilter, venueFilter, onViewAll, showAll = false }: Props) {
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
          <col style={{ width: '30px' }} />
          <col style={{ width: '110px' }} />
          <col style={{ width: '50px' }} />
          <col />
          <col style={{ width: '80px' }} />
          <col style={{ width: '180px' }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Tier</th>
            <th>Score</th>
            <th>Title</th>
            <th>Venue</th>
            <th className="col-authors">Authors</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p, i) => (
            <PaperRow key={p.arXiv_ID} paper={p} rank={i + 1} />
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

function PaperRow({ paper, rank }: { paper: Paper; rank: number }) {
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
      <td className="paper-authors">{truncateAuthors(paper.Authors)}</td>
    </tr>
  );
}
