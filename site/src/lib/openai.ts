import type { PaperSummary } from './types';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? '';

const SYSTEM_PROMPT = `
You are a technical research distillation agent. You are NOT a summarizer.

You will receive a list of research papers. For each paper, use web_search to look it up,
then produce one to two dense, technical paragraphs that distill it.

Each paragraph must cover: the specific problem tackled, the technical objective,
the core method or framework introduced, what was concretely built or demonstrated,
and key quantitative results if available.

Writing rules:
No filler. No "This paper explores..." or "The authors present an interesting...".
No generic summaries. Name exact methods, architectures, datasets, metrics, and numbers.
Every sentence must carry information. Tone should read like a Related Work section
in a top-tier venue paper. Do not editorialize.

BAD: "Smith et al. (2024) study error propagation in multi-agent systems and propose a solution."
GOOD: "Smith et al. (2024) formalize cascading hallucination in multi-agent LLM pipelines,
where a single upstream hallucination becomes an undetected premise in downstream reasoning. Through
controlled experiments on a 4-agent pipeline, they show error amplification follows a power-law distribution
with respect to pipeline depth. Their verification protocol introduces inter-agent consistency checks at
handoff boundaries, reducing cascade propagation by 73% on their benchmark without measurable latency overhead."

Output format is strictly plain text. No markdown, no bold, no italics, no headers,
no bullet points, no asterisks, no hashes, no code blocks, no special characters.
Just sentences and paragraphs.

For each paper, output exactly:

[Paper Title] - [Authors, Year]

[One to two paragraphs of technical distillation.]

Then a blank line before the next paper.

If a paper cannot be found via web search, state that and move on. Do not fabricate.
`.trim();

interface ResponseOutputItem {
  type: string;
  content?: Array<{ type: string; text?: string }>;
}

export async function analyzeWithAI(
  title: string,
  arXivId: string,
  feedback?: string,
): Promise<PaperSummary> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Set VITE_OPENAI_API_KEY.');
  }

  const input = `${title}\nhttps://arxiv.org/abs/${arXivId}`;

  let instructions = SYSTEM_PROMPT;
  if (feedback) {
    instructions += `\n\nAdditional user instructions: ${feedback}`;
  }

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.4',
      input,
      instructions,
      tools: [{ type: 'web_search' }],
      temperature: 0.2,
      top_p: 0.85,
      max_output_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json();

  const parts: string[] = [];
  for (const item of (data.output ?? []) as ResponseOutputItem[]) {
    if (item.type === 'message' && item.content) {
      for (const block of item.content) {
        if (block.type === 'output_text' && block.text) {
          parts.push(block.text);
        }
      }
    }
  }

  const summary = parts.join('\n') || 'No analysis could be generated.';

  return {
    arXiv_ID: arXivId,
    summary,
    generated_at: new Date().toISOString(),
    feedback: feedback || undefined,
  };
}
