import type { RunEntry, Paper, PaperSummary } from './types';
import type { TrackedRun } from '../components/WorkflowTracker';

const BASE = import.meta.env.BASE_URL;
const REPO = import.meta.env.VITE_GITHUB_REPO ?? '';
const PAT = import.meta.env.VITE_GITHUB_PAT ?? '';

const NO_CACHE: RequestInit = { cache: 'no-store' };

function ghHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${PAT}`,
    Accept: 'application/vnd.github.v3+json',
  };
}

export async function fetchIndex(): Promise<RunEntry[]> {
  const res = await fetch(`${BASE}data/index.json`, NO_CACHE);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPapers(datasetKey: string): Promise<Paper[]> {
  const res = await fetch(`${BASE}data/${datasetKey}/papers.json`, NO_CACHE);
  if (!res.ok) return [];
  return res.json();
}

export async function triggerWorkflow(
  workflowFile: string,
  inputs: Record<string, string>,
): Promise<boolean> {
  if (!PAT || !REPO) return false;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: ghHeaders(),
        body: JSON.stringify({ ref: 'main', inputs }),
      },
    );
    return res.status === 204;
  } catch {
    return false;
  }
}

export async function fetchSummary(arXivId: string): Promise<PaperSummary | null> {
  try {
    const res = await fetch(`${BASE}data/summaries/${arXivId}.json`, NO_CACHE);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveSummaryToRepo(
  arXivId: string,
  paperTitle: string,
  summary: string,
): Promise<boolean> {
  return triggerWorkflow('save-analysis.yml', {
    arxiv_id: arXivId,
    paper_title: paperTitle,
    summary,
  });
}

function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export async function fetchWorkflowRuns(): Promise<TrackedRun[]> {
  if (!PAT || !REPO) return [];

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/runs?per_page=10`,
      {
        cache: 'no-store',
        headers: ghHeaders(),
      },
    );
    if (!res.ok) return [];

    const data = await res.json();
    const runs = data.workflow_runs ?? [];

    const tracked: TrackedRun[] = [];
    for (const run of runs) {
      if (run.name === 'Deploy Site') continue;

      const isActive = run.status === 'queued' || run.status === 'in_progress';
      const isRecent = Date.now() - new Date(run.created_at).getTime() < 3600000;

      if (!isActive && !isRecent) continue;

      let currentStep: string | undefined;
      if (run.status === 'in_progress') {
        try {
          const jobsRes = await fetch(run.jobs_url, {
            cache: 'no-store',
            headers: ghHeaders(),
          });
          if (jobsRes.ok) {
            const jobsData = await jobsRes.json();
            const activeJob = jobsData.jobs?.find((j: { status: string }) => j.status === 'in_progress');
            if (activeJob) {
              const activeStep = activeJob.steps?.find((s: { status: string }) => s.status === 'in_progress');
              if (activeStep) currentStep = activeStep.name;
            }
          }
        } catch { /* ignore */ }
      }

      tracked.push({
        id: run.id,
        name: run.name ?? run.display_title,
        status: run.status as TrackedRun['status'],
        conclusion: run.conclusion as TrackedRun['conclusion'],
        startedAt: run.run_started_at ?? run.created_at,
        elapsed: formatElapsed(run.run_started_at ?? run.created_at),
        currentStep,
        url: run.html_url,
      });
    }

    return tracked;
  } catch {
    return [];
  }
}
