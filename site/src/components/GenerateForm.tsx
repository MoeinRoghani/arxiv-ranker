import { useState } from 'react';
import type { RunEntry } from '../lib/types';
import ConfirmDialog from './ConfirmDialog';
import MonthPicker from './MonthPicker';

interface Props {
  entries: RunEntry[];
  open: boolean;
  onGenerate: (yearMonth: string, categories: string) => void;
}

function getLastMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function GenerateForm({ entries, open, onGenerate }: Props) {
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
    <div className={`gen-panel-wrapper ${open ? 'gen-panel-open' : ''}`}>
      <div className="gen-panel">
        <div className="container">
          <form className="gen-panel-form" onSubmit={handleSubmit}>
            <div className="gen-panel-field">
              <label className="gen-panel-label">Period</label>
              <MonthPicker
                value={yearMonth}
                max={getLastMonth()}
                onChange={setYearMonth}
              />
            </div>
            <div className="gen-panel-field">
              <label className="gen-panel-label">Categories</label>
              <input
                type="text"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="cs.MA,cs.CL,cs.AI"
                className="gen-panel-input"
                spellCheck={false}
                autoCorrect="off"
              />
            </div>
            <button type="submit" className="btn btn-primary gen-panel-run">
              Run
            </button>
          </form>
        </div>
      </div>

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
    </div>
  );
}
