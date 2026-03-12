import type { RunEntry, Paper } from './types';

const BASE = import.meta.env.BASE_URL;
const REPO = import.meta.env.VITE_GITHUB_REPO ?? '';
const PAT = import.meta.env.VITE_GITHUB_PAT ?? '';

export async function fetchIndex(): Promise<RunEntry[]> {
  const res = await fetch(`${BASE}data/index.json`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPapers(runId: string): Promise<Paper[]> {
  const res = await fetch(`${BASE}data/${runId}/papers.json`);
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
        headers: {
          Authorization: `Bearer ${PAT}`,
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({ ref: 'main', inputs }),
      },
    );
    return res.status === 204;
  } catch {
    return false;
  }
}
