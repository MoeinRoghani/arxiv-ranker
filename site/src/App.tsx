import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { RunEntry } from './lib/types';
import { fetchIndex, triggerWorkflow, fetchWorkflowRuns, fetchPapers } from './lib/api';
import GenerateForm from './components/GenerateForm';
import FilterBar from './components/FilterBar';
import RunCard from './components/RunCard';
import Toast from './components/Toast';
import WorkflowTracker from './components/WorkflowTracker';
import type { TrackedRun } from './components/WorkflowTracker';
import AllPapersView from './components/AllPapersView';

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

  async function handleGenerate(yearMonth: string, categories: string) {
    const ok = await triggerWorkflow('generate.yml', {
      year_month: yearMonth,
      categories,
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

  if (viewAllRunId) {
    const entry = entries.find(e => e.id === viewAllRunId);
    return (
      <>
        <AllPapersView
          runId={viewAllRunId}
          entry={entry ?? null}
          onBack={() => setViewAllRunId(null)}
          fetchPapers={fetchPapers}
        />
        <WorkflowTracker runs={trackedRuns} onDismiss={handleDismissRun} />
      </>
    );
  }

  return (
    <>
      <header>
        <div className="container header-inner">
          <h1>Ranked Research</h1>
        </div>
      </header>

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
        <GenerateForm entries={entries} onGenerate={handleGenerate} />

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
            <p>Generate your first ranking using the form above.</p>
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
