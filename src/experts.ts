/**
 * Expert Mode — the real Conviction architecture (per Mathis pivot).
 *
 * We do NOT discover markets. The human (Mathis) ASSIGNS markets via the
 * ASSIGNED_MARKETS env var. For each assigned market, we maintain ONE
 * dedicated expert agent that:
 *
 *   - has its own persistent state file (./agents/<marketId>/state.json)
 *   - has its own accumulated context (research notes growing over cycles)
 *   - has its own AGENT.md (auto-generated on first cycle)
 *   - runs every cycle on its assigned market only — never switches
 *   - decides to: research deeper, place a trade, monitor, exit, claim
 *
 * Same wallet shared across all experts. Hard cap MAX_BET_USD per trade,
 * DRAWDOWN_STOP_PCT account-wide.
 *
 * Run: bun run src/experts.ts
 */
import "./lib/env.ts";
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import * as jupiter from "./lib/jupiter.ts";
import { runAgent } from "./lib/claude.ts";
import { tools as researchTools, handle as handleResearch } from "./lib/research-tools.ts";
import { kellySize } from "./lib/kelly.ts";
import { pubkey, signAndSend } from "./lib/wallet.ts";
import { sendToMathis, pollNewReplies } from "./lib/telegram.ts";
import { loadActiveSkills, renderSkillsForPrompt } from "./lib/skills.ts";

const ASSIGNED_MARKETS = (process.env.ASSIGNED_MARKETS ?? "").split(",").map(s => s.trim()).filter(Boolean);
const POLL_INTERVAL_MS = Number(process.env.EXPERT_INTERVAL_MS ?? 90_000);
const HANDSOFF_END = process.env.HANDSOFF_END;
const MAX_BET_USD = Number(process.env.MAX_BET_USD ?? 5);
const BANKROLL_USD = Number(process.env.TOTAL_BANKROLL_USD ?? 50);
const CONVICTION_THRESHOLD = Number(process.env.CONVICTION_THRESHOLD ?? 0.08);

const AGENTS_ROOT = "./agents";
const TRAIL = process.env.EXPERT_TRAIL ?? "./expert-trail.jsonl";

if (!ASSIGNED_MARKETS.length) {
  console.error("ASSIGNED_MARKETS empty. Set in .env: ASSIGNED_MARKETS=POLY-X,POLY-Y,POLY-Z");
  process.exit(1);
}

console.log(`Conviction Expert Mode — assigned to ${ASSIGNED_MARKETS.length} markets:`);
for (const m of ASSIGNED_MARKETS) console.log(`  • ${m}`);
console.log(`Interval: ${POLL_INTERVAL_MS / 1000}s · Handsoff end: ${HANDSOFF_END ?? "infinite"}`);

type Forecast = {
  probabilityYes: number;
  confidence: number;
  side: "YES" | "NO";
  reasoning: string;
};

type ExpertState = {
  marketId: string;
  question: string;
  rulesPrimary: string;
  createdAt: number;
  cycleCount: number;
  lastForecast: Forecast | null;
  contextNotes: string[];
  trades: { txSig: string; side: "YES" | "NO"; betUsd: number; at: number; entryPrice: number }[];
  exits: { txSig: string; kind: "take_profit" | "stop_loss" | "manual" | "claim"; at: number }[];
  lastUpdatedAt: number;
};

function expertDir(marketId: string): string {
  return join(AGENTS_ROOT, marketId);
}

function loadState(marketId: string): ExpertState | null {
  const path = join(expertDir(marketId), "state.json");
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return null; }
}

function saveState(state: ExpertState) {
  const dir = expertDir(state.marketId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2));
}

function writeAgentMd(state: ExpertState) {
  const dir = expertDir(state.marketId);
  mkdirSync(dir, { recursive: true });
  const md = `---
name: expert-${state.marketId}
description: Dedicated expert agent for Jupiter Predict market ${state.marketId}. Researches this single market deeply over time, accumulates context, trades when edge appears, monitors positions, exits when warranted.
---

# Expert — ${state.marketId}

**Market**: ${state.question}

**Resolution criteria** (excerpt):
${state.rulesPrimary.slice(0, 800)}

**Assigned at**: ${new Date(state.createdAt).toISOString()}
**Cycles**: ${state.cycleCount}
**Trades placed**: ${state.trades.length}
**Exits**: ${state.exits.length}

## Latest forecast
${state.lastForecast ? `- pYES: ${state.lastForecast.probabilityYes}
- confidence: ${state.lastForecast.confidence}
- side: ${state.lastForecast.side}
- reasoning: ${state.lastForecast.reasoning}` : "(none yet)"}

## Recent research notes
${state.contextNotes.slice(-5).map((n, i) => `${i + 1}. ${n}`).join("\n")}
`;
  writeFileSync(join(dir, "AGENT.md"), md);
}

function log(entry: any) {
  const line = JSON.stringify({ ts: Date.now(), ...entry });
  console.log(line);
  try { appendFileSync(TRAIL, line + "\n"); } catch {}
}

function withinHandsoff(): boolean {
  if (!HANDSOFF_END) return true;
  return Date.now() < new Date(HANDSOFF_END).getTime();
}

async function ensureState(marketId: string): Promise<ExpertState> {
  let state = loadState(marketId);
  if (state) return state;
  const market: any = await jupiter.getMarket(marketId);
  state = {
    marketId,
    question: market.title ?? `(market ${marketId})`,
    rulesPrimary: market.rulesPrimary ?? "",
    createdAt: Date.now(),
    cycleCount: 0,
    lastForecast: null,
    contextNotes: [],
    trades: [],
    exits: [],
    lastUpdatedAt: Date.now(),
  };
  saveState(state);
  writeAgentMd(state);
  log({ type: "expert_init", marketId, question: state.question });
  return state;
}

async function ourOpenPosition(marketId: string): Promise<any | null> {
  try {
    const positions: any[] = await jupiter.getPositions(pubkey()) as any[];
    return positions.find(p => p.marketId === marketId) ?? null;
  } catch { return null; }
}

const EXPERT_SYSTEM = (state: ExpertState, marketData: any, position: any | null) => {
  const skills = loadActiveSkills();
  const skillSection = renderSkillsForPrompt(skills, { full: false });
  const buyYes = (marketData.pricing?.buyYesPriceUsd ?? 500000) / 1e6;
  const buyNo = (marketData.pricing?.buyNoPriceUsd ?? 500000) / 1e6;
  const closeTimeIso = marketData.closeTime ? new Date(marketData.closeTime * 1000).toISOString() : "?";
  const positionLine = position
    ? `YES — open position: ${position.isYes ? "YES" : "NO"} side, contracts=${position.contracts}, avgPrice=$${(Number(position.avgPriceUsd) / 1e6).toFixed(3)}, markPrice=$${(Number(position.markPriceUsd) / 1e6).toFixed(3)}, pnl=$${(Number(position.pnlUsdAfterFees ?? 0) / 1e6).toFixed(2)} (${(position.pnlUsdAfterFeesPercent ?? 0).toFixed(1)}%)`
    : "NO open position on this market yet.";

  return `You are the DEDICATED EXPERT on Jupiter Predict market ${state.marketId}.

This is the only market you cover. You stay on it for the entire 3h hands-off window and grow your understanding of it cycle after cycle.

═══════════════════════════════════════════════════════════════
MARKET FIXED CONTEXT (does not change)
═══════════════════════════════════════════════════════════════
Title: ${state.question}
Resolution: ${state.rulesPrimary.slice(0, 700)}
Close at: ${closeTimeIso}

═══════════════════════════════════════════════════════════════
LIVE STATE (refreshes every cycle)
═══════════════════════════════════════════════════════════════
Current cycle: ${state.cycleCount + 1}
Buy YES price: $${buyYes}
Buy NO price:  $${buyNo}
${positionLine}

═══════════════════════════════════════════════════════════════
YOUR ACCUMULATED CONTEXT (grows over cycles — read this carefully)
═══════════════════════════════════════════════════════════════
${state.contextNotes.length === 0 ? "(no notes yet — this is cycle 1)" : state.contextNotes.map((n, i) => `[note ${i + 1}] ${n}`).join("\n\n")}

═══════════════════════════════════════════════════════════════
YOUR PRIOR FORECAST
═══════════════════════════════════════════════════════════════
${state.lastForecast ? `pYES=${state.lastForecast.probabilityYes}, confidence=${state.lastForecast.confidence}, side=${state.lastForecast.side}
Reasoning: ${state.lastForecast.reasoning}` : "(no prior forecast)"}

═══════════════════════════════════════════════════════════════
YOUR PRIOR TRADES
═══════════════════════════════════════════════════════════════
${state.trades.length === 0 ? "(none)" : state.trades.map(t => `- ${t.side} $${t.betUsd} @ $${t.entryPrice.toFixed(3)} on ${new Date(t.at).toISOString()} — tx ${t.txSig.slice(0, 12)}...`).join("\n")}
${state.exits.length > 0 ? "\nExits: " + state.exits.map(e => `${e.kind} on ${new Date(e.at).toISOString()}`).join(", ") : ""}

═══════════════════════════════════════════════════════════════
YOUR JOB THIS CYCLE
═══════════════════════════════════════════════════════════════
1. Refresh your understanding. Use search_web, read_url, get_x_posts, get_market_details ONLY if you need to check recent news. Be cheap — don't redo cycle 1 every time. Look for what's CHANGED since your last cycle.
2. Update your forecast (probabilityYes, confidence). Cite the source of any update in your reasoning.
3. Decide ONE of:
   - "trade": NO open position AND fresh edge ≥ 8% with confidence ≥ 0.4. Specify side YES/NO.
   - "exit": you HAVE an open position AND the market has converged toward your forecast (gap to your forecast < 3¢) OR your forecast has reversed direction.
   - "hold": observe, deepen notes, no action.
4. Write 1-3 SHORT new notes (under 200 chars each) summarizing what you learned THIS cycle.

═══════════════════════════════════════════════════════════════
SAFETY
═══════════════════════════════════════════════════════════════
- Max bet $${MAX_BET_USD}. Period.
- Bankroll total $${BANKROLL_USD}.
- If unsure, return action "hold".

Output JSON ONLY (no prose):
{
  "forecast": { "probabilityYes": 0-1, "confidence": 0-1, "side": "YES"|"NO", "reasoning": "1-3 sentences" },
  "action": "trade"|"exit"|"hold",
  "newNotes": ["note 1", "note 2"],
  "rationale": "1 sentence explaining the action"
}

${skillSection}`;
};

async function runOneExpertCycle(marketId: string): Promise<void> {
  const state = await ensureState(marketId);
  state.cycleCount += 1;
  state.lastUpdatedAt = Date.now();

  log({ type: "expert_cycle_start", marketId, cycle: state.cycleCount });

  let marketData: any;
  try {
    marketData = await jupiter.getMarket(marketId);
  } catch (e: any) {
    log({ type: "expert_market_error", marketId, error: e.message });
    saveState(state);
    return;
  }

  const position = await ourOpenPosition(marketId);

  const sys = EXPERT_SYSTEM(state, marketData, position);
  const user = `Run cycle ${state.cycleCount}. Update your understanding, decide action, write new notes.`;

  let parsed: any;
  try {
    const { text } = await runAgent({
      model: "specialist",
      system: sys,
      user,
      tools: researchTools,
      toolHandler: handleResearch,
      maxTurns: 8,
      maxTokens: 3000,
    });
    parsed = extractJson(text);
  } catch (e: any) {
    log({ type: "expert_research_error", marketId, error: e.message });
    saveState(state);
    return;
  }

  if (parsed.forecast) state.lastForecast = parsed.forecast;
  if (Array.isArray(parsed.newNotes)) {
    for (const n of parsed.newNotes) {
      if (typeof n === "string" && n.trim().length > 0) state.contextNotes.push(`[cycle ${state.cycleCount}] ${n.trim().slice(0, 240)}`);
    }
    if (state.contextNotes.length > 30) state.contextNotes = state.contextNotes.slice(-30);
  }
  log({ type: "expert_forecast", marketId, cycle: state.cycleCount, forecast: parsed.forecast, action: parsed.action, rationale: parsed.rationale });

  if (parsed.action === "trade" && !position) {
    const yesPrice = (marketData.pricing?.buyYesPriceUsd ?? 500000) / 1e6;
    const sizing = kellySize({
      probabilityEstimated: state.lastForecast!.probabilityYes,
      marketPriceYes: yesPrice,
      bankrollUsd: BANKROLL_USD,
      maxBetUsd: MAX_BET_USD,
      confidence: state.lastForecast!.confidence,
      convictionThreshold: CONVICTION_THRESHOLD,
    });
    if (sizing.betUsd > 0) {
      try {
        const order = await jupiter.buildOrder({
          ownerPubkey: pubkey(),
          marketId,
          isYes: sizing.side === "YES",
          isBuy: true,
          depositUsd: sizing.betUsd,
        });
        const sig = await signAndSend(order.transaction);
        const entryPrice = sizing.side === "YES" ? yesPrice : (1 - yesPrice);
        state.trades.push({ txSig: sig, side: sizing.side, betUsd: sizing.betUsd, at: Date.now(), entryPrice });
        log({ type: "expert_trade_executed", marketId, side: sizing.side, betUsd: sizing.betUsd, txSig: sig });
        await sendToMathis(`💼 Expert ${marketId}: ${sizing.side} $${sizing.betUsd} (edge ${(sizing.edgePct * 100).toFixed(1)}%) — tx ${sig.slice(0, 12)}...`);
      } catch (e: any) {
        log({ type: "expert_trade_error", marketId, error: e.message });
      }
    } else {
      log({ type: "expert_trade_skipped", marketId, reason: sizing.rationale });
    }
  } else if (parsed.action === "exit" && position) {
    try {
      const r: any = await jupiter.closePosition(position.pubkey ?? position.positionPubkey, pubkey());
      const sig = await signAndSend(r.transaction);
      state.exits.push({ txSig: sig, kind: "take_profit", at: Date.now() });
      log({ type: "expert_exit_executed", marketId, txSig: sig });
      await sendToMathis(`✂️ Expert ${marketId}: exit position — tx ${sig.slice(0, 12)}...`);
    } catch (e: any) {
      log({ type: "expert_exit_error", marketId, error: e.message });
    }
  }

  saveState(state);
  writeAgentMd(state);
  log({ type: "expert_cycle_end", marketId, cycle: state.cycleCount });
}

// boot ping
try {
  await sendToMathis(`🦞 Expert mode booting. ${ASSIGNED_MARKETS.length} agents assigned: ${ASSIGNED_MARKETS.join(", ")}. Handsoff end ${HANDSOFF_END}.`);
} catch {}

while (withinHandsoff()) {
  for (const marketId of ASSIGNED_MARKETS) {
    try {
      await runOneExpertCycle(marketId);
    } catch (e: any) {
      log({ type: "expert_loop_error", marketId, error: e.message });
    }
  }
  try {
    const updates = await pollNewReplies(2);
    for (const u of updates) log({ type: "mathis_reply", text: u.text });
  } catch {}
  await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
}

log({ type: "expert_loop_stop", reason: "handsoff_end" });
try { await sendToMathis(`✦ Expert mode stopped at HANDSOFF_END. ${ASSIGNED_MARKETS.length} experts persisted state in /agents/.`); } catch {}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const raw = (fence ? fence[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error(`No JSON: ${text.slice(0, 200)}`);
  return JSON.parse(raw.slice(start, end + 1));
}
