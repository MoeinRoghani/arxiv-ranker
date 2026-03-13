import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { RunEntry, Paper } from './lib/types';
import { fetchIndex, triggerWorkflow, fetchWorkflowRuns, fetchPapers } from './lib/api';
import GenerateForm from './components/GenerateForm';
import FilterBar from './components/FilterBar';
import RunCard from './components/RunCard';
import Toast from './components/Toast';
import WorkflowTracker from './components/WorkflowTracker';
import type { TrackedRun } from './components/WorkflowTracker';
import AllPapersView from './components/AllPapersView';
import PaperAnalysisView from './components/PaperAnalysisView';

type SortMode = 'newest' | 'oldest' | 'most_papers' | 'most_landmarks';

export default function App() {
  const [entries, setEntries] = useState<RunEntry[]>([]);
  const [toast, setToast] = useState({ message: '', isError: false });
  const [trackedRuns, setTrackedRuns] = useState<TrackedRun[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('newest');
  const [viewAllRunId, setViewAllRunId] = useState<string | null>(null);
  const [analyzePaper, setAnalyzePaper] = useState<Paper | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const dismissed = useRef<Set<number>>(new Set());

  useEffect(() => {
    fetchIndex().then(setEntries);
  }, []);

  useEffect(() => {
    let active = true;

    async function poll() {
      const runs = await fetchWorkflowRuns();
      if (!active) return;
      setTrackedRuns(runs.filter(r => !dismissed.current.has(r.id)));

      const hasActive = runs.some(r => r.status !== 'completed');
      const delay = hasActive ? 5000 : 15000;
      if (active) setTimeout(poll, delay);
    }

    poll();
    return () => { active = false; };
  }, []);

  const years = useMemo(() => {
    const set = new Set(entries.map(e => e.year_month.split('-')[0]));
    return Array.from(set).sort().reverse();
  }, [entries]);

  const allCategories = useMemo(() => {
    const set = new Set(entries.flatMap(e => e.categories));
    return Array.from(set).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = entries;

    if (selectedYear) {
      result = result.filter(e => e.year_month.startsWith(selectedYear));
    }

    switch (sort) {
      case 'newest':
        result = [...result].sort((a, b) => b.year_month.localeCompare(a.year_month));
        break;
      case 'oldest':
        result = [...result].sort((a, b) => a.year_month.localeCompare(b.year_month));
        break;
      case 'most_papers':
        result = [...result].sort((a, b) => b.paper_count - a.paper_count);
        break;
      case 'most_landmarks':
        result = [...result].sort((a, b) => b.landmarks - a.landmarks);
        break;
    }

    return result;
  }, [entries, selectedYear, sort]);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
  }, []);

  function handleDismissRun(id: number) {
    dismissed.current.add(id);
    setTrackedRuns(prev => prev.filter(r => r.id !== id));
  }

  async function handleGenerate(yearMonth: string, categories: string, titleKw: string, abstractKw: string) {
    const ok = await triggerWorkflow('generate.yml', {
      year_month: yearMonth,
      categories,
      title_keywords: titleKw,
      abstract_keywords: abstractKw,
    });
    if (ok) {
      showToast('Workflow triggered. Rankings will appear once the run completes.');
    } else {
      showToast('Failed to trigger workflow. Check PAT configuration.', true);
    }
  }

  async function handleUpdate(runId: string) {
    const ok = await triggerWorkflow('update.yml', { run_id: runId });
    if (ok) {
      showToast(`Update triggered for ${runId}.`);
    } else {
      showToast('Failed to trigger workflow. Check PAT configuration.', true);
    }
  }

  if (analyzePaper) {
    return (
      <PaperAnalysisView
        paper={analyzePaper}
        onBack={() => setAnalyzePaper(null)}
      />
    );
  }

  if (viewAllRunId) {
    const entry = entries.find(e => e.id === viewAllRunId);
    return (
      <AllPapersView
        runId={viewAllRunId}
        entry={entry ?? null}
        onBack={() => setViewAllRunId(null)}
        fetchPapers={fetchPapers}
        onAnalyze={setAnalyzePaper}
      />
    );
  }

  return (
    <>
      <header>
        <div className="container header-inner">
          <div className="header-brand">
            <h1>Ranked Research</h1>
            <a
              href="https://github.com/MoeinRoghani/arxiv-ranker"
              target="_blank"
              rel="noopener noreferrer"
              className="header-github"
              aria-label="GitHub repository"
            >
              <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span>Source</span>
            </a>
          </div>
          <button
            className={`header-generate-btn ${genOpen ? 'header-generate-active' : ''}`}
            onClick={() => setGenOpen(!genOpen)}
          >
            {genOpen ? '✕ Close' : 'New Ranking'}
          </button>
        </div>
      </header>

      <GenerateForm
        entries={entries}
        open={genOpen}
        onGenerate={handleGenerate}
      />

      {years.length > 0 && (
        <nav className="year-nav">
          <button
            className={`year-btn ${selectedYear === null ? 'active' : ''}`}
            onClick={() => setSelectedYear(null)}
          >
            All
          </button>
          {years.map(y => (
            <button
              key={y}
              className={`year-btn ${selectedYear === y ? 'active' : ''}`}
              onClick={() => setSelectedYear(selectedYear === y ? null : y)}
            >
              {y}
            </button>
          ))}
        </nav>
      )}

      <main className="container main-content">

        {entries.length > 0 && (
          <FilterBar
            tiers={['landmarks', 'important']}
            activeTier={activeTier}
            onTierChange={setActiveTier}
            categories={allCategories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            sort={sort}
            onSortChange={setSort}
          />
        )}

        {filteredEntries.length === 0 && entries.length === 0 && (
          <div className="empty-state">
            <h2>No rankings yet</h2>
            <p>Click + Generate to create your first ranking.</p>
          </div>
        )}

        {filteredEntries.length === 0 && entries.length > 0 && (
          <div className="empty-state">
            <h2>No results match filters</h2>
          </div>
        )}

        {filteredEntries.map((entry) => (
          <RunCard
            key={entry.id}
            entry={entry}
            onUpdate={handleUpdate}
            tierFilter={activeTier}
            categoryFilter={activeCategory}
            onViewAll={(runId) => setViewAllRunId(runId)}
            onAnalyze={setAnalyzePaper}
          />
        ))}
      </main>

      <WorkflowTracker runs={trackedRuns} onDismiss={handleDismissRun} />

      <Toast
        message={toast.message}
        isError={toast.isError}
        onDismiss={() => setToast({ message: '', isError: false })}
      />
    </>
  );
}
