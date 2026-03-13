import { useState, useEffect, useRef } from 'react';
import type { Paper, PaperSummary } from '../lib/types';
import { tierClass, tierLabel, shortVenue, fullVenue } from '../lib/format';
import { fetchSummary, saveSummaryToRepo, fetchPapers } from '../lib/api';
import { analyzeWithAI } from '../lib/openai';

interface Props {
  paper?: Paper;
  datasetKey?: string;
  arxivId?: string;
  onBack: () => void;
}

export default function PaperAnalysisView({ paper: paperProp, datasetKey, arxivId, onBack }: Props) {
  const [paper, setPaper] = useState<Paper | null>(paperProp ?? null);
  const [paperLoading, setPaperLoading] = useState(!paperProp);

  useEffect(() => {
    if (paperProp) {
      setPaper(paperProp);
      setPaperLoading(false);
      return;
    }
    if (!datasetKey || !arxivId) {
      setPaperLoading(false);
      return;
    }

    let cancelled = false;
    fetchPapers(datasetKey).then(papers => {
      if (cancelled) return;
      const found = papers.find(p => p.arXiv_ID === arxivId);
      setPaper(found ?? null);
      setPaperLoading(false);
    });
    return () => { cancelled = true; };
  }, [paperProp, datasetKey, arxivId]);
  const [summary, setSummary] = useState<PaperSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [readerMode, setReaderMode] = useState(false);
  const [readerTheme, setReaderTheme] = useState<'light' | 'dark'>('dark');
  const [copied, setCopied] = useState(false);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!paper) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const cached = await fetchSummary(paper!.arXiv_ID);
      if (cached && !cancelled) {
        setSummary(cached);
        setLoading(false);
        return;
      }

      try {
        const result = await analyzeWithAI(paper!.Title, paper!.arXiv_ID);
        if (cancelled) return;
        setSummary(result);
        saveSummaryToRepo(paper!.arXiv_ID, paper!.Title, result.summary);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to analyze paper.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [paper]);

  async function handleRegenerate() {
    if (!paper) return;
    setLoading(true);
    setError(null);
    setShowFeedback(false);

    try {
      const result = await analyzeWithAI(
        paper.Title,
        paper.arXiv_ID,
        feedback || undefined,
      );
      setSummary(result);
      setFeedback('');
      saveSummaryToRepo(paper.arXiv_ID, paper.Title, result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate analysis.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (showFeedback && feedbackRef.current) {
      feedbackRef.current.focus();
    }
  }, [showFeedback]);

  if (paperLoading) {
    return (
      <div className="pa-page">
        <header>
          <div className="container header-inner">
            <button className="back-btn" onClick={onBack}>← Back</button>
            <h1>Paper Analysis</h1>
          </div>
        </header>
        <main className="pa-main"><div className="container"><div className="loading">Loading paper data...</div></div></main>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="pa-page">
        <header>
          <div className="container header-inner">
            <button className="back-btn" onClick={onBack}>← Back</button>
            <h1>Paper Analysis</h1>
          </div>
        </header>
        <main className="pa-main"><div className="container"><div className="pa-error"><p>Paper not found.</p></div></div></main>
      </div>
    );
  }

  const tc = tierClass(paper.Tier);
  const venue = shortVenue(paper.Venue);
  const venueFull = fullVenue(paper.Venue);

  function handleCopy() {
    if (!summary) return;
    const text = `${paper!.Title}\n\n${summary.summary}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (readerMode && summary && !loading && !error) {
    return (
      <div className={`reader-overlay reader-${readerTheme}`}>
        <div className="reader-toolbar">
          <button className="reader-close" onClick={() => setReaderMode(false)}>
            ← Back
          </button>
          <span className="reader-title">{paper.Title}</span>
          <div className="reader-actions">
            <button
              className="reader-btn"
              onClick={() => setReaderTheme(readerTheme === 'light' ? 'dark' : 'light')}
              title={readerTheme === 'light' ? 'Dark mode' : 'Light mode'}
            >
              {readerTheme === 'light' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>
            <button className="reader-btn" onClick={handleCopy} title="Copy to clipboard">
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="reader-content">
          {summary.summary.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pa-page">
      <header>
        <div className="container header-inner">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h1>Paper Analysis</h1>
        </div>
      </header>

      <div className="pa-hero">
        <div className="container">
          <div className="pa-hero-top">
            <span className={`tier-badge tier-${tc}`}>{tierLabel(paper.Tier)}</span>
            <span className="pa-score-pill">{paper.Score} pts</span>
            {venue !== '-' && (
              <span className="pa-venue-pill">
                {venue}{venueFull && <> · {venueFull}</>}
              </span>
            )}
            <a
              href={`https://arxiv.org/abs/${paper.arXiv_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm pa-view-paper"
            >
              View Paper ↗
            </a>
          </div>

          <h2 className="pa-title">{paper.Title}</h2>
          <p className="pa-authors">{paper.Authors}</p>

          <div className="pa-stats-row">
            <a
              href={`https://arxiv.org/abs/${paper.arXiv_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pa-stat-chip pa-stat-link"
            >
              arXiv: {paper.arXiv_ID}
            </a>
            <span className="pa-stat-chip">{paper.Citation_Count ?? 0} citations</span>
            <span className="pa-stat-chip">
              {paper.Influential_Citations ?? 0} influential
              {(paper.Citation_Count ?? 0) > 0 && (
                <> ({Math.round(((paper.Influential_Citations ?? 0) / paper.Citation_Count) * 100)}%)</>
              )}
            </span>
            <span className="pa-stat-chip">top author h-index: {paper.Max_Author_hIndex ?? 0}</span>
          </div>

          {Array.isArray(paper.Factors) && paper.Factors.length > 0 && (
            <div className="pa-score-breakdown">
              <span className="pa-breakdown-label">Score breakdown</span>
              <div className="pa-factors">
                {paper.Factors.map((f, i) => {
                  const m = f.match(/^(\w+)\(\+(\d+):?(.*)?\)$/);
                  if (!m) return <span key={i} className="pa-factor">{f}</span>;
                  const [, name, pts, detail] = m;
                  return (
                    <span key={i} className="pa-factor">
                      <span className="pa-factor-name">{name.toLowerCase()}</span>
                      <span className="pa-factor-pts">+{pts}</span>
                      {detail && <span className="pa-factor-detail">{detail}</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pa-tags">
            {paper.Categories?.map(c => (
              <span key={c} className="cat-tag">{c}</span>
            ))}
          </div>
        </div>
      </div>

      <main className="pa-main">
        <div className="container">
          <div className="pa-analysis">
            <div className="pa-analysis-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                <line x1="9" y1="21" x2="15" y2="21" />
                <line x1="10" y1="24" x2="14" y2="24" />
              </svg>
              Gen AI Analysis
              {summary && !loading && !error && (
                <button className="reader-toggle" onClick={() => setReaderMode(true)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                  Native Reader
                </button>
              )}
              {summary && !loading && (
                <span className="pa-generated-at">
                  {new Date(summary.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>

            {loading && (
              <div className="pa-loading">
                <div className="pa-loading-bar" />
                <p>Analyzing paper...</p>
              </div>
            )}

            {!loading && error && (
              <div className="pa-error">
                <p>{error}</p>
                <button className="btn btn-secondary btn-sm" onClick={handleRegenerate}>
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && summary && (
              <div className="pa-summary-body">
                {summary.summary.split('\n\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            )}

            {!loading && !error && summary && (
              <div className="pa-actions">
                {!showFeedback ? (
                  <div className="pa-action-row">
                    <button className="btn btn-secondary btn-sm" onClick={handleRegenerate}>
                      Regenerate
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowFeedback(true)}
                    >
                      Regenerate with feedback
                    </button>
                  </div>
                ) : (
                  <div className="pa-feedback">
                    <textarea
                      ref={feedbackRef}
                      className="pa-feedback-input"
                      placeholder="e.g. 'Focus more on methodology' or 'Compare with transformer approaches'..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={3}
                    />
                    <div className="pa-action-row">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setShowFeedback(false); setFeedback(''); }}
                      >
                        Cancel
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={handleRegenerate}>
                        Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
