import { useState } from 'react';
import type { RunEntry } from '../lib/types';
import ConfirmDialog from './ConfirmDialog';
import MonthPicker from './MonthPicker';

interface Props {
  entries: RunEntry[];
  onGenerate: (yearMonth: string, categories: string) => void;
}

function getLastMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function GenerateForm({ entries, onGenerate }: Props) {
  const [open, setOpen] = useState(true);
  const [yearMonth, setYearMonth] = useState(getLastMonth());
  const [categories, setCategories] = useState('cs.MA,cs.CL,cs.AI');
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!yearMonth || !categories.trim()) return;

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
          <MonthPicker
            value={yearMonth}
            max={getLastMonth()}
            onChange={setYearMonth}
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
