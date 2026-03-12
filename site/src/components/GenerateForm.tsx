import { useState } from 'react';
import type { RunEntry } from '../lib/types';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  entries: RunEntry[];
  onGenerate: (yearMonth: string, categories: string) => void;
}

function getLastMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function getMaxMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

export default function GenerateForm({ entries, onGenerate }: Props) {
  const [open, setOpen] = useState(true);
  const [yearMonth, setYearMonth] = useState(getLastMonth());
  const [categories, setCategories] = useState('cs.MA,cs.CL,cs.AI');
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!yearMonth || !categories.trim()) return;

    const currentMonth = new Date().toISOString().slice(0, 7);
    if (yearMonth >= currentMonth) return;

    const catStr = categories.split(',').map(c => c.trim().replace('.', '')).join('_');
    const ymStr = yearMonth.replace('-', '_');
    const runId = `${catStr}_${ymStr}`;

    if (entries.some(e => e.id === runId)) {
      setConfirmOpen(true);
      return;
    }

    onGenerate(yearMonth, categories.trim());
  }

  return (
    <section className="generate-section">
      <button
        className="generate-toggle"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span>Generate New Rankings</span>
        <span className={`chevron ${open ? 'open' : ''}`}>&#9654;</span>
      </button>

      {open && (
        <form className="generate-form" onSubmit={handleSubmit}>
          <input
            type="month"
            value={yearMonth}
            max={getMaxMonth()}
            onChange={(e) => setYearMonth(e.target.value)}
          />
          <input
            type="text"
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="cs.MA,cs.CL,cs.AI"
          />
          <button type="submit" className="btn btn-primary">Generate</button>
        </form>
      )}

      {confirmOpen && (
        <ConfirmDialog
          message="Rankings already exist for this period. Generate anyway?"
          onConfirm={() => {
            setConfirmOpen(false);
            onGenerate(yearMonth, categories.trim());
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </section>
  );
}
