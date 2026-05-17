/**
 * Orchestrator — the main loop of Conviction.
 *
 * Every cycle:
 *   1. discoverMarkets()  → pick a small set of candidate markets via Jupiter
 *   2. for each, route to a specialist based on category
 *   3. specialist returns a SpecialistOpinion
 *   4. Public Markets Desk decides + executes (or skips)
 *   5. log everything to a JSONL trail for the dashboard
 *
 * Runs forever when invoked via `bun run src/index.ts`. Designed to be
 * autonomous during the hands-off window.
 */

import * as jupiter from "./lib/jupiter.ts";
import { evaluateAndTrade } from "./desks/public-markets.ts";
import { reflectAndPropose } from "./lib/self-improve.ts";
import { loadActiveSkills } from "./lib/skills.ts";
import { sendToMathis, pollNewReplies } from "./lib/telegram.ts";
import type { Market } from "./types.ts";
import { appendFileSync } from "fs";

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 60_000);
const TRAIL_FILE = process.env.TRAIL_FILE ?? "./trail.jsonl";

// Markets per PRD §4: Operational KPI + R&D / Product release.
// Skips: BTC/oil/gold ladders, daily up-down, tweet count — too TA/latency-arb.
const DEMO_QUERIES = [
  "Tesla deliveries",
  "NVIDIA earnings",
  "Microsoft earnings",
  "Gemini",
  "Cybercab",
  "Starship",
];

const seenMarkets = new Set<string>();

export async function discoverMarkets(): Promise<Market[]> {
  const all: Market[] = [];
  for (const q of DEMO_QUERIES) {
    try {
      const events = await jupiter.searchEvents(q, 10, { includeMarkets: true });
      for (const ev of events) {
        for (const m of ev.markets ?? []) {
          if (m.status !== "open") continue;
          if (seenMarkets.has(m.marketId)) continue;
          all.push(normalizeMarket(m, ev));
        }
      }
    } catch (e: any) {
      log({ type: "discover_error", query: q, error: e.message });
    }
  }
  return rankCandidates(all).slice(0, 3); // top 3 per cycle to keep cost bounded
}

/**
 * Jupiter returns prices in micro USD (1_000_000 = $1.00). Outcome titles
 * are per-market (e.g. "↓ $405", "Yes", "No"). Each event has metadata.title
 * for the umbrella question.
 */
function normalizeMarket(m: any, ev: any): Market {
  const eventTitle = ev.metadata?.title ?? ev.title ?? "(no title)";
  const marketTitle = m.title ? ` — ${m.title}` : "";
  const closeTimeIso = m.closeTime
    ? new Date(m.closeTime * 1000).toISOString()
    : ev.metadata?.closeTime ?? new Date(Date.now() + 86400000).toISOString();

  const buyYes = (m.pricing?.buyYesPriceUsd ?? 500000) / 1_000_000;
  const sellYes = (m.pricing?.sellYesPriceUsd ?? 500000) / 1_000_000;
  const buyNo = (m.pricing?.buyNoPriceUsd ?? 500000) / 1_000_000;
  const sellNo = (m.pricing?.sellNoPriceUsd ?? 500000) / 1_000_000;

  return {
    marketId: m.marketId ?? m.id,
    eventId: ev.eventId ?? ev.id,
    question: `${eventTitle}${marketTitle}`,
    category: ev.category ?? "unknown",
    outcomes: [
      { label: "YES", isYes: true, buyPrice: buyYes, sellPrice: sellYes },
      { label: "NO", isYes: false, buyPrice: buyNo, sellPrice: sellNo },
    ],
    endsAt: closeTimeIso,
    volumeUsd: Number(ev.volumeUsd ?? 0) / 1_000_000,
    // Jupiter doesn't expose a clean liquidity number; use per-market volume as proxy.
    liquidityUsd: Number(m.pricing?.volume ?? 0) / 1_000_000,
  };
}

function rankCandidates(markets: Market[]): Market[] {
  // Prefer: short resolution window + non-degenerate price + not yet traded.
  return markets
    .filter(m => {
      const yes = m.outcomes.find(o => o.isYes)?.buyPrice ?? 0;
      // Skip markets pinned to 0 or 1 — no edge to find.
      return yes > 0.02 && yes < 0.98;
    })
    .map(m => ({
      m,
      score:
        (m.volumeUsd / 1000) +
        Math.max(0, 7 - daysUntil(m.endsAt)) * 5 +
        (m.liquidityUsd / 100),
    }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.m);
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return ms / (1000 * 60 * 60 * 24);
}

let cycleNum = 0;
const REFLECT_EVERY = Number(process.env.REFLECT_EVERY ?? 5);

export async function runCycle(): Promise<void> {
  cycleNum += 1;
  const cycleStart = Date.now();
  const skills = loadActiveSkills();
  log({ type: "cycle_start", n: cycleNum, at: new Date().toISOString(), activeSkills: skills.map(s => s.name) });

  const markets = await discoverMarkets();
  log({ type: "discovered", count: markets.length, ids: markets.map(m => m.marketId) });

  for (const m of markets) {
    seenMarkets.add(m.marketId);
    try {
      const result = await evaluateAndTrade(m);
      log({ type: "desk_result", marketId: m.marketId, status: result.status, result });
    } catch (e: any) {
      log({ type: "desk_error", marketId: m.marketId, error: e.message });
    }
  }

  // Self-improvement: every N cycles, reflect on the trail and propose a Skill.
  if (cycleNum % REFLECT_EVERY === 0) {
    try {
      const r = await reflectAndPropose();
      log({ type: "reflect", n: cycleNum, ...r });
    } catch (e: any) {
      log({ type: "reflect_error", n: cycleNum, error: e.message });
    }
  }

  log({ type: "cycle_end", n: cycleNum, duration_ms: Date.now() - cycleStart });
}

const HANDSOFF_START = process.env.HANDSOFF_START;
const HANDSOFF_END = process.env.HANDSOFF_END;

function withinHandsoff(): { ok: boolean; reason: string } {
  if (!HANDSOFF_END) return { ok: true, reason: "no HANDSOFF_END set, running forever" };
  const now = Date.now();
  const end = new Date(HANDSOFF_END).getTime();
  // Don't gate on HANDSOFF_START — pre-warming the loop before the public
  // window is fine. Only HANDSOFF_END is a hard stop.
  if (now > end) return { ok: false, reason: `past HANDSOFF_END (${HANDSOFF_END})` };
  return { ok: true, reason: `${Math.round((end - now) / 60000)} min remaining until HANDSOFF_END` };
}

export async function runForever(): Promise<void> {
  // graceful shutdown
  process.on("SIGINT", () => { log({ type: "shutdown" }); process.exit(0); });

  // Boot ping to Telegram so Mathis knows we're alive.
  try {
    const r = await sendToMathis(`✦ Conviction is alive — entering loop. handsoff=${HANDSOFF_END ?? "infinite"}`);
    log({ type: "telegram_boot", ok: r.ok, chatId: r.chatId, error: r.error });
  } catch (e: any) {
    log({ type: "telegram_boot_error", error: e.message });
  }

  while (true) {
    const window = withinHandsoff();
    if (!window.ok) {
      log({ type: "handsoff_done", reason: window.reason });
      try { await sendToMathis(`✦ Conviction loop stopping: ${window.reason}`); } catch {}
      process.exit(0);
    }
    try {
      await runCycle();
    } catch (e: any) {
      log({ type: "cycle_error", error: e.message });
    }

    // Poll Telegram for any guidance from Mathis (non-blocking, short).
    try {
      const updates = await pollNewReplies(2);
      for (const u of updates) {
        log({ type: "mathis_reply", text: u.text, from: u.from });
      }
    } catch (e: any) {
      log({ type: "telegram_poll_error", error: e.message });
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function log(entry: Record<string, any>) {
  const line = JSON.stringify({ ts: Date.now(), ...entry });
  console.log(line);
  try { appendFileSync(TRAIL_FILE, line + "\n"); } catch {}
}
