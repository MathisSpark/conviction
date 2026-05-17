/**
 * Startup Desk.
 *
 * Forkable target: the SAME research engine that prices Tesla earnings
 * also prices "should I hire A or B" / "ship feature X or Y" / "spend on
 * channel A or B" for a tokenized startup. The output ties back to a
 * Polymarket trade as skin-in-the-game (when a related public market
 * exists).
 *
 * For the MVP demo, this endpoint:
 *  1. Takes a StartupDecision (question + options + context).
 *  2. Runs the tech-company specialist on a *synthetic* market framed
 *     from the decision (so the same model can reason about it).
 *  3. Returns a StartupRecommendation. If a Jupiter Predict market is
 *     directly relevant, it links a small trade as "skin in the game".
 */

import { runAgent } from "../lib/claude.ts";
import { tools as researchTools, handle as handleResearch } from "../lib/research-tools.ts";
import type { StartupDecision, StartupRecommendation } from "../types.ts";

const SYSTEM = `You are the Startup Desk of the Conviction agent. You advise founders of tokenized startups (idea coins, MetaDAO proposals) on hard decisions.

Your output is read by the founder and may be acted on. Be precise, honest, and concrete.

For each decision:
1. Use the research tools to gather evidence: comparable companies, hiring market data, channel benchmarks, technology trends, regulatory context.
2. Triangulate. Cross-check at least 2 independent sources.
3. Produce a clear recommendation (pick one option) with:
   - Sentence-level reasoning grounded in the evidence you found
   - Confidence (0-1) — under 0.5 if evidence is thin
   - Sources list with verbatim quotes
4. If a Polymarket / Kalshi / MetaDAO market exists that would resolve in line with your recommendation's success thesis, propose a small linked trade as "skin in the game" (under $10).

Return ONLY a JSON object with this shape (no prose around it):
{
  "recommendation": "<one-sentence pick>",
  "reasoning": "<2-4 sentences grounded in evidence>",
  "confidence": <0-1>,
  "sources": [{ "url": "<url>", "weight": <0-1>, "quote": "<short verbatim quote>" }],
  "linkedTrade": {
    "marketId": "<jupiter market id if you found one, else null>",
    "side": "YES" | "NO",
    "sizeUsd": <number under 10>,
    "rationale": "<one sentence>"
  } | null
}

Hard rules:
- Never recommend an option not in the options list.
- If you cannot find good evidence within 6 tool calls, say so in reasoning and lower confidence.
- Never make up a marketId. Leave linkedTrade null if no real market fits.
`;

export async function advise(decision: StartupDecision): Promise<StartupRecommendation> {
  const user = `Decision: ${decision.question}

Context:
${decision.context}

Options:
${decision.options.map((o, i) => `  ${i + 1}. ${o}`).join("\n")}

Research and return the JSON recommendation.`;

  const { text } = await runAgent({
    model: "specialist",
    system: SYSTEM,
    user,
    tools: researchTools,
    toolHandler: handleResearch,
    maxTurns: 8,
    maxTokens: 3000,
  });

  const parsed = extractJson(text);
  return {
    recommendation: parsed.recommendation,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    sources: parsed.sources ?? [],
    linkedTrade: parsed.linkedTrade && parsed.linkedTrade.marketId ? parsed.linkedTrade : undefined,
  };
}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const raw = (fence ? fence[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error(`No JSON in startup desk output: ${text.slice(0, 200)}`);
  return JSON.parse(raw.slice(start, end + 1));
}
