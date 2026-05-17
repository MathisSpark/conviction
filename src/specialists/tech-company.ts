/**
 * Tech / Company-Outcome Specialist.
 *
 * Researches markets about public companies (TSLA, NVDA, AAPL, MSFT, …) and
 * returns a SpecialistOpinion. Uses: web search, X scrape, market data.
 *
 * Called by the orchestrator with a specific Jupiter Predict market. Returns
 * its probability estimate + reasoning trace.
 */

import { runAgent } from "../lib/claude.ts";
import { tools, handle } from "../lib/research-tools.ts";
import { loadActiveSkills, renderSkillsForPrompt } from "../lib/skills.ts";
import type { Market, SpecialistOpinion } from "../types.ts";

const BASE_SYSTEM = `You are the Tech/Company-Outcome research specialist of the Conviction agent.

Your job: given a Jupiter Predict market about a public tech company (Tesla, NVIDIA, Apple, Microsoft, SpaceX, etc.), produce a calibrated probability estimate of the YES outcome.

Workflow:
1. Read the market question carefully. Identify the resolution criterion (exact threshold + date + source).
2. Gather evidence with the tools available. Prioritize:
   - Recent earnings reports, guidance, analyst consensus
   - Real production/delivery/revenue numbers
   - Executive signaling (X posts, interviews)
   - Supply chain / industry context
   - Macro context (Fed, sector ETF, peer moves)
3. Triangulate. A single source is never enough. Cross-check with at least 2 independent sources before committing to a probability.
4. Output a JSON object with exactly this shape (no prose around it):

{
  "probabilityYes": 0.0-1.0,
  "confidence": 0.0-1.0,
  "reasoning": "2-4 sentence summary of why",
  "sources": [{"url": "...", "weight": 0-1, "quote": "key fact"}, ...],
  "caveats": ["...", ...]
}

Rules:
- Be calibrated, not aggressive. If the market price is already accurate, say so (probability close to current price).
- "confidence" reflects how much evidence you actually gathered. If you ran 1 search and got vague results, confidence < 0.3.
- Never invent sources. If you couldn't find good evidence, say so in caveats and keep confidence low.
- Stop after at most 8 tool calls. Quality > quantity.`;

export async function researchMarket(market: Market): Promise<SpecialistOpinion> {
  // Defensive: if invoked with a raw Jupiter market (research mode), the
  // normalized fields may be missing. Fall back to safe defaults.
  const q = market.question ?? (market as any).title ?? `(market ${market.marketId})`;
  const cat = market.category ?? "unknown";
  const vol = (market.volumeUsd ?? 0).toLocaleString();
  const liq = (market.liquidityUsd ?? 0).toLocaleString();
  const ends = market.endsAt ?? "?";
  const outcomes = JSON.stringify(market.outcomes ?? []);

  const user = `Market: "${q}"
Category: ${cat}
Outcomes: ${outcomes}
Volume: $${vol} · Liquidity: $${liq}
Ends at: ${ends}
Market ID: ${market.marketId}

Research this market and output your JSON opinion.`;

  // Inject any active Skills into the system prompt. Skills written by the
  // agent itself during the self-improvement loop appear here automatically.
  const skills = loadActiveSkills().filter(s =>
    s.name === "research-tech-companies" ||
    s.name === "research-product-releases" ||
    s.description.toLowerCase().includes("research") ||
    s.description.toLowerCase().includes("market"),
  );
  const system = BASE_SYSTEM + renderSkillsForPrompt(skills, { full: true });

  const { text, trace } = await runAgent({
    model: "specialist",
    system,
    user,
    tools,
    toolHandler: handle,
    maxTurns: 10,
    maxTokens: 4096,
  });

  const parsed = extractJson(text);

  return {
    marketId: market.marketId,
    side: parsed.probabilityYes >= 0.5 ? "YES" : "NO",
    probabilityYes: parsed.probabilityYes,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    sources: parsed.sources ?? [],
    recommendedSizePct: Math.min(0.05, parsed.confidence * 0.05),
    caveats: parsed.caveats ?? [],
  };
}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const raw = (fence ? fence[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error(`No JSON in specialist output: ${text.slice(0, 200)}`);
  return JSON.parse(raw.slice(start, end + 1));
}
