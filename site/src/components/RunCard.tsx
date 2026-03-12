import { useState, useEffect } from 'react';
import type { RunEntry, Paper } from '../lib/types';
import { fetchPapers } from '../lib/api';
import { formatYearMonth, formatDate } from '../lib/format';
import PapersTable from './PapersTable';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  entry: RunEntry;
  onUpdate: (runId: string) => void;
  tierFilter: string | null;
  categoryFilter: string | null;
}

export default function RunCard({ entry, onUpdate, tierFilter, categoryFilter }: Props) {
  const [open, setOpen] = useState(false);
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open && !papers) {
      setLoading(true);
      fetchPapers(entry.id).then((data) => {
        setPapers(data);
        setLoading(false);
      });
    }
  }, [open, papers, entry.id]);

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
          {entry.landmarks > 0 && (
            <span className="stat stat-landmark">
              {entry.landmarks} landmark{entry.landmarks !== 1 ? 's' : ''}
            </span>
          )}
          {entry.important > 0 && (
            <span className="stat stat-important">
              {entry.important} important
            </span>
          )}
          <span className="stat stat-total">
            {entry.paper_count} papers
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
              tierFilter={tierFilter}
              categoryFilter={categoryFilter}
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
