import { useState, useRef, useEffect } from 'react';

export interface TrackedRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | null;
  startedAt: string;
  elapsed: string;
  currentStep?: string;
  url: string;
}

interface Props {
  runs: TrackedRun[];
  onDismiss: (id: number) => void;
}

function statusIcon(run: TrackedRun): string {
  if (run.status === 'queued') return '◻';
  if (run.status === 'in_progress') return '⟳';
  if (run.conclusion === 'success') return '✓';
  if (run.conclusion === 'failure') return '✕';
  return '•';
}

function statusClass(run: TrackedRun): string {
  if (run.status === 'queued') return 'queued';
  if (run.status === 'in_progress') return 'running';
  if (run.conclusion === 'success') return 'success';
  if (run.conclusion === 'failure') return 'failure';
  return '';
}

export default function WorkflowTracker({ runs, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    if (expanded) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [expanded]);

  const visible = runs.slice(0, 3);

  if (visible.length === 0) return null;

  const activeCount = visible.filter(r => r.status !== 'completed').length;
  const label = activeCount > 0
    ? `${activeCount} workflow${activeCount !== 1 ? 's' : ''} running`
    : 'Workflows complete';

  return (
    <div className="wf-tracker" ref={ref}>
      <button
        className="wf-tracker-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`wf-dot ${activeCount > 0 ? 'pulse' : 'done'}`} />
        <span className="wf-label">{label}</span>
        <span className={`wf-chevron ${expanded ? 'open' : ''}`}>&#9654;</span>
      </button>

      {expanded && (
        <div className="wf-tracker-list">
          {visible.map(run => (
            <div key={run.id} className={`wf-run wf-${statusClass(run)}`}>
              <div className="wf-run-header">
                <span className="wf-icon">{statusIcon(run)}</span>
                <span className="wf-name">{run.name}</span>
                <span className="wf-time">{run.elapsed}</span>
              </div>
              {run.currentStep && (
                <div className="wf-step">{run.currentStep}</div>
              )}
              <div className="wf-run-footer">
                <a
                  href={run.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wf-link"
                >
                  View on GitHub
                </a>
                {run.status === 'completed' && (
                  <button
                    className="wf-dismiss"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(run.id);
                    }}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
