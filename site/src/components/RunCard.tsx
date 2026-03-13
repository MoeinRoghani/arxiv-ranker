import { useState, useEffect, useMemo } from 'react';
import type { RunEntry } from '../lib/types';
import { fetchPapers } from '../lib/api';
import { formatYearMonth, formatDate } from '../lib/format';
import PapersTable from './PapersTable';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  entry: RunEntry;
  onUpdate: (datasetKey: string) => void;
  tierFilter: string | null;
  categoryFilter: string | null;
  onViewAll: (datasetKey: string) => void;
}

export default function RunCard({ entry, onUpdate, tierFilter, categoryFilter, onViewAll }: Props) {
  const [open, setOpen] = useState(false);
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasFilter = tierFilter !== null || categoryFilter !== null;

  useEffect(() => {
    if ((open || hasFilter) && !papers) {
      setLoading(true);
      fetchPapers(entry.id).then((data) => {
        setPapers(data);
        setLoading(false);
      });
    }
  }, [open, hasFilter, papers, entry.id]);

  const stats = useMemo(() => {
    if (!papers || !hasFilter) {
      return {
        landmarks: entry.landmarks,
        important: entry.important,
        total: entry.paper_count,
      };
    }

    let filtered = papers;
    if (categoryFilter) {
      filtered = filtered.filter(p =>
        p.Categories?.some(c => c.toLowerCase() === categoryFilter.toLowerCase())
      );
    }

    if (tierFilter === 'landmarks') {
      return {
        landmarks: filtered.filter(p => p.Tier?.includes('LANDMARK')).length,
        important: 0,
        total: filtered.filter(p => p.Tier?.includes('LANDMARK')).length,
      };
    }
    if (tierFilter === 'important') {
      return {
        landmarks: 0,
        important: filtered.filter(p => p.Tier?.includes('IMPORTANT')).length,
        total: filtered.filter(p => p.Tier?.includes('IMPORTANT')).length,
      };
    }

    return {
      landmarks: filtered.filter(p => p.Tier?.includes('LANDMARK')).length,
      important: filtered.filter(p => p.Tier?.includes('IMPORTANT')).length,
      total: filtered.length,
    };
  }, [papers, hasFilter, tierFilter, categoryFilter, entry]);

  return (
    <div className="run-card">
      <div className="run-header" onClick={() => setOpen(!open)}>
        <div className="run-info">
          <h3>{formatYearMonth(entry.year_month)}</h3>
          <span className="run-categories">
            {entry.categories.join(', ')}
          </span>
        </div>

        <div className="run-meta">
          {stats.landmarks > 0 && (
            <span className="stat stat-landmark">
              {stats.landmarks} landmark{stats.landmarks !== 1 ? 's' : ''}
            </span>
          )}
          {stats.important > 0 && (
            <span className="stat stat-important">
              {stats.important} important
            </span>
          )}
          <span className="stat stat-total">
            {stats.total} papers
          </span>
        </div>

        <div className="run-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmOpen(true);
            }}
          >
            Update
          </button>
          <span className="last-updated">{formatDate(entry.last_updated)}</span>
          <span className={`chevron ${open ? 'open' : ''}`}>&#9654;</span>
        </div>
      </div>

      {open && (
        <div className="run-body">
          {loading && <div className="loading">Loading papers...</div>}
          {papers && (
            <PapersTable
              papers={papers}
              datasetKey={entry.id}
              tierFilter={tierFilter}
              categoryFilter={categoryFilter}
              onViewAll={() => onViewAll(entry.id)}
            />
          )}
          {!loading && papers && papers.length === 0 && (
            <div className="loading">No papers found.</div>
          )}
        </div>
      )}

      {confirmOpen && (
        <ConfirmDialog
          message={`Re-fetch and re-score all papers for ${formatYearMonth(entry.year_month)}?`}
          onConfirm={() => {
            setConfirmOpen(false);
            onUpdate(entry.id);
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
