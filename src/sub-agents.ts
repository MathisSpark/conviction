/**
 * Sub-agents — the multi-agent system per Mathis vision.
 *
 * Each expert (per-market) dispatches IN PARALLEL to N sub-agents,
 * each focused on a narrow task. The aggregator (pricing-math) takes
 * all their structured outputs and produces the final decision.
 *
 * This is the difference between:
 *   - Before:  1 expert does everything in 1 Claude call with tools
 *   - After:   1 expert orchestrates 3 sub-agents in parallel, then
 *              calls a 4th to aggregate. Visible "agents talk to agents".
 *
 * Cost per cycle per market: ~4x more Claude calls vs single-expert.
 */
import Anthropic from "@anthropic-ai/sdk";
import { MODELS, runAgent } from "./lib/claude.ts";
import { tools as researchTools, handle as handleResearch } from "./lib/research-tools.ts";
import { loadActiveSkills, renderSkillsForPrompt } from "./lib/skills.ts";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------- Shared input ----------

export type MarketCtx = {
  marketId: string;
  question: string;
  rulesPrimary: string;
  closeTimeIso: string;
  buyYes: number;     // 0-1
  buyNo: number;      // 0-1
  positionLine: string; // human-readable description of any open position
  priorNotes: string[];
  priorForecast: { probabilityYes: number; confidence: number; side: string; reasoning: string } | null;
};

// ---------- 1. Resolution Analyst (Haiku) ----------

export type ResolutionAnalysis = {
  exactCriteria: string;
  resolutionSource: string;
  deadline: string;
  ambiguities: string[];
  edgeCases: string[];
};

export async function callResolutionAnalyst(ctx: MarketCtx): Promise<ResolutionAnalysis> {
  const system = `You are the Resolution Analyst sub-agent of a prediction-market trading system.

Your only job: read the resolution criteria of a market and produce a STRUCTURED breakdown of:
1. The exact resolution criteria (one sentence, no fluff)
2. The official resolution source (URL or named entity)
3. The hard deadline (ISO timestamp if available)
4. Ambiguities (things a trader could read 2 different ways)
5. Edge cases (corner outcomes that would resolve unexpectedly)

This breakdown is consumed by 3 other sub-agents (evidence-gatherer, base-rate-historian, pricing-math). Be precise and exhaustive on the criteria; do NOT estimate probability — that is not your job.

Output JSON only:
{
  "exactCriteria": "...",
  "resolutionSource": "...",
  "deadline": "...",
  "ambiguities": ["...", "..."],
  "edgeCases": ["...", "..."]
}`;

  const user = `Market: ${ctx.question}
Close time: ${ctx.closeTimeIso}

Full resolution text:
${ctx.rulesPrimary}

Produce your structured analysis.`;

  const r = await client.messages.create({
    model: MODELS.fast, // Haiku — cheap + fast
    max_tokens: 1000,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = r.content.filter(b => b.type === "text").map((b: any) => b.text).join("");
  return extractJson(text);
}

// ---------- 2. Evidence Gatherer (Sonnet + tools) ----------

export type Evidence = {
  signals: { source: string; weight: number; claim: string; quote: string }[];
  netDirection: "favors_yes" | "favors_no" | "ambiguous";
  freshFindings: string[]; // what is NEW vs prior notes
  confidence: number;       // how good is the evidence overall (0-1)
};

export async function callEvidenceGatherer(ctx: MarketCtx, resolution: ResolutionAnalysis): Promise<Evidence> {
  const skills = loadActiveSkills();
  const skillSection = renderSkillsForPrompt(skills, { full: false });

  const system = `You are the Evidence Gatherer sub-agent.

Your job: search the open web for evidence about a single prediction market, with the resolution criteria already locked by the Resolution Analyst sub-agent. You do NOT estimate probability — you collect signals and tell us their direction.

Workflow:
1. Search the web for the most recent / authoritative information bearing on this exact resolution.
2. Focus on what is NEW since prior notes (do not duplicate them).
3. Prefer primary sources (official changelogs, leaderboards, regulatory filings) over commentary.
4. Cite 4-8 signals max. Each with a verifiable URL.

Output JSON only:
{
  "signals": [
    { "source": "URL or named entity", "weight": 0-1, "claim": "...", "quote": "verbatim short quote" }
  ],
  "netDirection": "favors_yes" | "favors_no" | "ambiguous",
  "freshFindings": ["...", "..."],
  "confidence": 0-1
}

Stop after 6 tool calls max. Quality > volume.

${skillSection}`;

  const user = `Market: ${ctx.question}
Close: ${ctx.closeTimeIso}
Buy YES price: ${ctx.buyYes}  Buy NO price: ${ctx.buyNo}

Resolution Analyst said:
  - exactCriteria: ${resolution.exactCriteria}
  - resolutionSource: ${resolution.resolutionSource}
  - deadline: ${resolution.deadline}
  - ambiguities: ${JSON.stringify(resolution.ambiguities)}
  - edgeCases: ${JSON.stringify(resolution.edgeCases)}

Prior notes from this expert's history (avoid duplicating these):
${ctx.priorNotes.length === 0 ? "(no prior notes)" : ctx.priorNotes.slice(-10).map((n, i) => `${i + 1}. ${n}`).join("\n")}

Gather evidence and return the structured JSON.`;

  const { text } = await runAgent({
    model: "specialist",
    system,
    user,
    tools: researchTools,
    toolHandler: handleResearch,
    maxTurns: 8,
    maxTokens: 2500,
  });
  return extractJson(text);
}

// ---------- 3. Base Rate Historian (Sonnet, no tools) ----------

export type BaseRate = {
  baseRate: number; // 0-1
  comparableCases: { description: string; outcome: "yes" | "no" | "unknown" }[];
  reasoning: string;
};

export async function callBaseRateHistorian(ctx: MarketCtx, resolution: ResolutionAnalysis): Promise<BaseRate> {
  const system = `You are the Base Rate Historian sub-agent.

Your job: given the resolution criteria, recall comparable past outcomes from your training knowledge and compute a calibrated BASE RATE. You ignore market price and live evidence — you reason from history.

Examples of base rates:
- "Will SpaceX launch a rocket within 7 days of NET?" → SpaceX historical hit rate, ~60-70% in recent years
- "Will Google ship a model with version label X.Y by date D?" → Google product release base rate, ~50-65%
- "Will Tesla deliver in bracket 400-425k?" → Tesla delivery hit rate vs guidance, ~40%
- "Will a stock close above X today?" → essentially a random walk base rate ~50%

Output JSON only:
{
  "baseRate": 0-1,
  "comparableCases": [
    { "description": "...", "outcome": "yes" | "no" | "unknown" }
  ],
  "reasoning": "2-3 sentences"
}

Cite at least 3 comparable cases. If the question is genuinely novel, say so and use a wide prior (e.g. 0.50 ± 0.20).`;

  const user = `Market: ${ctx.question}
Close: ${ctx.closeTimeIso}

Resolution Analyst said:
  - exactCriteria: ${resolution.exactCriteria}
  - resolutionSource: ${resolution.resolutionSource}

Recall comparable past cases and return the structured JSON.`;

  const r = await client.messages.create({
    model: MODELS.specialist, // Sonnet, no tools needed
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = r.content.filter(b => b.type === "text").map((b: any) => b.text).join("");
  return extractJson(text);
}

// ---------- 4. Pricing Math (aggregator, Sonnet) ----------

export type FinalDecision = {
  probabilityYes: number;
  confidence: number;
  side: "YES" | "NO";
  edgePct: number;
  action: "trade" | "exit" | "hold";
  reasoning: string;
  newNotes: string[];
  citations: { from: "resolution" | "evidence" | "base_rate"; insight: string }[];
};

export async function callPricingMath(
  ctx: MarketCtx,
  resolution: ResolutionAnalysis,
  evidence: Evidence,
  baseRate: BaseRate,
  maxBetUsd: number,
  convictionThreshold: number,
): Promise<FinalDecision> {
  const system = `You are the Pricing Math sub-agent — the aggregator.

You receive structured outputs from 3 other sub-agents (resolution, evidence, base rate) and must produce ONE final decision: forecast + recommended action.

Method:
1. Start from the base rate (prior).
2. Update with the evidence signals, weighted by their quality (signal.weight).
3. Apply ambiguity penalty: if resolution has 2+ ambiguities, lower confidence by 0.1-0.2.
4. Compare your final probabilityYes to market buyYes/buyNo prices.
5. Decide action:
   - "trade" if NO open position AND edge >= ${convictionThreshold} AND confidence >= 0.4
   - "exit" if there IS open position AND market has converged to within 3 cents of your forecast OR your forecast direction has reversed vs the position direction
   - "hold" otherwise

Output JSON only:
{
  "probabilityYes": 0-1,
  "confidence": 0-1,
  "side": "YES" | "NO",
  "edgePct": (your prob - market price for chosen side, decimal),
  "action": "trade" | "exit" | "hold",
  "reasoning": "2-4 sentences synthesizing the 3 sub-agent inputs",
  "newNotes": ["short note 1", "short note 2"],
  "citations": [
    { "from": "resolution" | "evidence" | "base_rate", "insight": "..." }
  ]
}

Max bet ${maxBetUsd} USD. Conviction threshold ${convictionThreshold}.`;

  const user = `Market: ${ctx.question}
Buy YES: ${ctx.buyYes}  Buy NO: ${ctx.buyNo}
${ctx.positionLine}

Prior forecast: ${ctx.priorForecast ? JSON.stringify(ctx.priorForecast) : "none"}

──── Resolution Analyst ────
${JSON.stringify(resolution, null, 2)}

──── Evidence Gatherer ────
${JSON.stringify(evidence, null, 2)}

──── Base Rate Historian ────
${JSON.stringify(baseRate, null, 2)}

Now aggregate and produce the final decision.`;

  const r = await client.messages.create({
    model: MODELS.specialist,
    max_tokens: 1800,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = r.content.filter(b => b.type === "text").map((b: any) => b.text).join("");
  return extractJson(text);
}

// ---------- Orchestration helper ----------

/**
 * Run all 4 sub-agents for one cycle of one market.
 * Resolution + evidence + base-rate are dispatched in PARALLEL.
 * Then pricing-math is called with all 3 outputs.
 *
 * Returns the FinalDecision + the intermediate trace (for the dashboard).
 */
export async function runMultiAgentCycle(ctx: MarketCtx, maxBetUsd: number, convictionThreshold: number): Promise<{
  decision: FinalDecision;
  trace: {
    resolution: ResolutionAnalysis;
    evidence: Evidence;
    baseRate: BaseRate;
    durations: { resolution: number; evidence: number; baseRate: number; pricingMath: number; total: number };
  };
}> {
  const t0 = Date.now();

  // Step 1: lock resolution criteria (fast, Haiku)
  const tRes0 = Date.now();
  const resolution = await callResolutionAnalyst(ctx);
  const tRes = Date.now() - tRes0;

  // Step 2: evidence + base rate IN PARALLEL
  const [evidence, baseRate, durations] = await Promise.all([
    (async () => { const s = Date.now(); const r = await callEvidenceGatherer(ctx, resolution); return [r, Date.now() - s] as const; })(),
    (async () => { const s = Date.now(); const r = await callBaseRateHistorian(ctx, resolution); return [r, Date.now() - s] as const; })(),
    Promise.resolve(null),
  ]);
  const [ev, tEv] = evidence;
  const [br, tBr] = baseRate;

  // Step 3: aggregate
  const tPm0 = Date.now();
  const decision = await callPricingMath(ctx, resolution, ev, br, maxBetUsd, convictionThreshold);
  const tPm = Date.now() - tPm0;

  return {
    decision,
    trace: {
      resolution,
      evidence: ev,
      baseRate: br,
      durations: { resolution: tRes, evidence: tEv, baseRate: tBr, pricingMath: tPm, total: Date.now() - t0 },
    },
  };
}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const raw = (fence ? fence[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error(`No JSON in sub-agent output: ${text.slice(0, 200)}`);
  return JSON.parse(raw.slice(start, end + 1));
}
