import { useState, useEffect, useRef } from 'react';
import type { Paper, PaperSummary } from '../lib/types';
import { tierClass, tierLabel, shortVenue } from '../lib/format';
import { fetchSummary, saveSummaryToRepo } from '../lib/api';
import { analyzeWithAI } from '../lib/openai';

interface Props {
  paper: Paper;
  onBack: () => void;
}

export default function PaperAnalysisView({ paper, onBack }: Props) {
  const [summary, setSummary] = useState<PaperSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const cached = await fetchSummary(paper.arXiv_ID);
      if (cached && !cancelled) {
        setSummary(cached);
        setLoading(false);
        return;
      }

      try {
        const result = await analyzeWithAI(paper.Title, paper.arXiv_ID);
        if (cancelled) return;
        setSummary(result);
        saveSummaryToRepo(paper.arXiv_ID, paper.Title, result.summary);
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

  const tc = tierClass(paper.Tier);
  const venue = shortVenue(paper.Venue);

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
            {venue !== '-' && <span className="pa-venue-pill">{venue}</span>}
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
            {(paper.Influential_Citations ?? 0) > 0 && (
              <span className="pa-stat-chip">{paper.Influential_Citations} influential</span>
            )}
            <span className="pa-stat-chip">h-index: {paper.Max_Author_hIndex ?? 0}</span>
          </div>

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
