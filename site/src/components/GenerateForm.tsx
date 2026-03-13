import { useState } from 'react';
import type { RunEntry } from '../lib/types';
import ConfirmDialog from './ConfirmDialog';
import MonthPicker from './MonthPicker';

interface Props {
  entries: RunEntry[];
  open: boolean;
  onGenerate: (yearMonth: string, categories: string, titleKw: string, abstractKw: string) => void;
}

interface KeywordEntry {
  term: string;
  pts: number;
}

const DEFAULT_TITLE_KEYWORDS: KeywordEntry[] = [
  { term: 'multi-agent', pts: 50 }, { term: 'multiagent', pts: 50 },
  { term: 'agent coordination', pts: 50 }, { term: 'agent-to-agent', pts: 50 },
  { term: 'llm agent', pts: 50 }, { term: 'agentic', pts: 50 },
  { term: 'multi agent', pts: 50 }, { term: 'autonomous agent', pts: 50 },
  { term: 'communication', pts: 25 }, { term: 'collaboration', pts: 25 },
  { term: 'cooperation', pts: 25 }, { term: 'orchestration', pts: 25 },
  { term: 'framework', pts: 25 }, { term: 'reasoning', pts: 25 },
  { term: 'planning', pts: 25 }, { term: 'coordination', pts: 25 },
  { term: 'negotiation', pts: 25 }, { term: 'benchmark', pts: 25 },
  { term: 'survey', pts: 25 },
];

const DEFAULT_ABSTRACT_KEYWORDS: KeywordEntry[] = [
  { term: 'multi-agent', pts: 25 }, { term: 'agent', pts: 10 },
  { term: 'network architecture', pts: 15 }, { term: 'large language model', pts: 15 },
  { term: 'coordination', pts: 15 }, { term: 'cooperation', pts: 15 },
  { term: 'emergent', pts: 20 }, { term: 'decentralized', pts: 15 },
  { term: 'distributed', pts: 10 },
];

function getLastMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function KeywordTag({ kw, onRemove }: { kw: KeywordEntry; onRemove: () => void }) {
  return (
    <span className="kw-tag">
      <span className="kw-term">{kw.term}</span>
      <span className="kw-pts">+{kw.pts}</span>
      <button type="button" className="kw-remove" onClick={onRemove}>×</button>
    </span>
  );
}

function KeywordSection({
  label,
  keywords,
  defaults,
  onChange,
}: {
  label: string;
  keywords: KeywordEntry[];
  defaults: KeywordEntry[];
  onChange: (kws: KeywordEntry[]) => void;
}) {
  const [input, setInput] = useState('');
  const [pts, setPts] = useState(25);

  function handleAdd() {
    const term = input.trim().toLowerCase();
    if (!term || keywords.some(k => k.term === term)) return;
    onChange([...keywords, { term, pts }]);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="kw-section">
      <div className="kw-section-header">
        <span className="kw-section-label">{label}</span>
        <span className="kw-section-count">{keywords.length} terms</span>
        <button type="button" className="kw-reset" onClick={() => onChange(defaults)}>Reset</button>
      </div>
      <div className="kw-tags">
        {keywords.map((kw, i) => (
          <KeywordTag
            key={kw.term}
            kw={kw}
            onRemove={() => onChange(keywords.filter((_, j) => j !== i))}
          />
        ))}
      </div>
      <div className="kw-add-row">
        <input
          type="text"
          className="kw-add-input"
          placeholder="Add keyword..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />
        <input
          type="number"
          className="kw-add-pts"
          value={pts}
          onChange={(e) => setPts(parseInt(e.target.value) || 0)}
          min={1}
          max={100}
        />
        <button type="button" className="kw-add-btn" onClick={handleAdd}>Add</button>
      </div>
    </div>
  );
}

export default function GenerateForm({ entries, open, onGenerate }: Props) {
  const [yearMonth, setYearMonth] = useState(getLastMonth());
  const [categories, setCategories] = useState('cs.MA,cs.CL,cs.AI');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [titleKeywords, setTitleKeywords] = useState<KeywordEntry[]>(DEFAULT_TITLE_KEYWORDS);
  const [abstractKeywords, setAbstractKeywords] = useState<KeywordEntry[]>(DEFAULT_ABSTRACT_KEYWORDS);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!yearMonth || !categories.trim()) return;

    const catStr = categories.split(',').map(c => c.trim().replace('.', '')).join('_');
    const ymStr = yearMonth.replace('-', '_');
    const datasetKey = `${catStr}_${ymStr}`;

    if (entries.some(e => e.id === datasetKey)) {
      setConfirmOpen(true);
      return;
    }

    const tkw = JSON.stringify(Object.fromEntries(titleKeywords.map(k => [k.term, k.pts])));
    const akw = JSON.stringify(Object.fromEntries(abstractKeywords.map(k => [k.term, k.pts])));
    onGenerate(yearMonth, categories.trim(), tkw, akw);
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
            <button
              type="button"
              className={`gen-terms-toggle ${showTerms ? 'gen-terms-active' : ''}`}
              onClick={() => setShowTerms(!showTerms)}
            >
              {showTerms ? 'Hide' : 'View'} Ranking Terms
              <span className={`gen-terms-chevron ${showTerms ? 'open' : ''}`}>›</span>
            </button>
          </form>

          {showTerms && (
            <div className="kw-editor">
              <KeywordSection
                label="Title Keywords"
                keywords={titleKeywords}
                defaults={DEFAULT_TITLE_KEYWORDS}
                onChange={setTitleKeywords}
              />
              <KeywordSection
                label="Abstract Keywords"
                keywords={abstractKeywords}
                defaults={DEFAULT_ABSTRACT_KEYWORDS}
                onChange={setAbstractKeywords}
              />
            </div>
          )}
        </div>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          message="Rankings already exist for this period. Generate anyway?"
          onConfirm={() => {
            setConfirmOpen(false);
            const tkw = JSON.stringify(Object.fromEntries(titleKeywords.map(k => [k.term, k.pts])));
            const akw = JSON.stringify(Object.fromEntries(abstractKeywords.map(k => [k.term, k.pts])));
            onGenerate(yearMonth, categories.trim(), tkw, akw);
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
