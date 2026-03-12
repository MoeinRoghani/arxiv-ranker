import type { RunEntry, Paper } from './types';

const BASE = import.meta.env.BASE_URL;
const LS_PAT = 'arxiv_ranker_pat';
const REPO = import.meta.env.VITE_GITHUB_REPO ?? '';
const ENV_PAT = import.meta.env.VITE_GITHUB_PAT ?? '';

export function getRepo(): string {
  return REPO;
}

export function getPat(): string {
  return localStorage.getItem(LS_PAT) || ENV_PAT;
}

export function savePat(pat: string) {
  if (pat) localStorage.setItem(LS_PAT, pat);
  else localStorage.removeItem(LS_PAT);
}

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
  const pat = getPat();
  if (!pat) return false;
  const repo = getRepo();
  if (!repo) return false;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pat}`,
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
