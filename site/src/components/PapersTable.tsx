import { useState, useMemo } from 'react';
import type { Paper } from '../lib/types';
import { tierClass, tierLabel, truncateAuthors } from '../lib/format';

interface Props {
  papers: Paper[];
  tierFilter: string | null;
  categoryFilter: string | null;
}

export default function PapersTable({ papers, tierFilter, categoryFilter }: Props) {
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    let result = papers;

    if (tierFilter === 'landmarks') {
      result = result.filter(p => p.Tier?.includes('LANDMARK'));
    } else if (tierFilter === 'important') {
      result = result.filter(p => p.Tier?.includes('IMPORTANT'));
    }

    if (categoryFilter) {
      result = result.filter(p =>
        p.Categories?.some(c => c.toLowerCase() === categoryFilter.toLowerCase())
      );
    }

    return result;
  }, [papers, tierFilter, categoryFilter]);

  const hasActiveFilter = tierFilter !== null || categoryFilter !== null;

  const landmarks = filtered.filter(p => p.Tier?.includes('LANDMARK'));
  const others = filtered.filter(p => !p.Tier?.includes('LANDMARK'));
  const topOthers = others.slice(0, 6);
  const remaining = others.slice(6);

  const visible = hasActiveFilter || showAll
    ? [...landmarks, ...others]
    : [...landmarks, ...topOthers];

  if (filtered.length === 0) {
    return <div className="loading">No papers match the current filters.</div>;
  }

  return (
    <div>
      <table className="papers-table">
        <colgroup>
          <col style={{ width: '36px' }} />
          <col style={{ width: '100px' }} />
          <col style={{ width: '50px' }} />
          <col />
          <col style={{ width: '110px' }} />
          <col style={{ width: '70px' }} />
          <col style={{ width: '200px' }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Tier</th>
            <th>Score</th>
            <th>Title</th>
            <th>Categories</th>
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

      {!hasActiveFilter && remaining.length > 0 && (
        <button
          className="show-more"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? 'Show fewer papers'
            : `Show ${remaining.length} more papers`}
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
      <td className="paper-categories">
        {paper.Categories?.map(c => (
          <span key={c} className="cat-tag">{c}</span>
        )) || '-'}
      </td>
      <td className="paper-venue">{paper.Venue || '-'}</td>
      <td className="paper-authors">{truncateAuthors(paper.Authors)}</td>
    </tr>
  );
}
