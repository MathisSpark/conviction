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
import type { Market } from "./types.ts";
import { appendFileSync } from "fs";

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 60_000);
const TRAIL_FILE = process.env.TRAIL_FILE ?? "./trail.jsonl";

const DEMO_QUERIES = ["Tesla", "NVIDIA", "Apple", "Microsoft"]; // narrow scope for the MVP

const seenMarkets = new Set<string>();

export async function discoverMarkets(): Promise<Market[]> {
  const all: Market[] = [];
  for (const q of DEMO_QUERIES) {
    try {
      const events = await jupiter.searchEvents(q, 10);
      for (const ev of events) {
        for (const m of ev.markets ?? []) {
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

function normalizeMarket(m: any, ev: any): Market {
  return {
    marketId: m.marketId ?? m.id,
    eventId: ev.eventId ?? ev.id,
    question: ev.title ?? m.question ?? "(no title)",
    category: ev.category ?? "unknown",
    outcomes: m.outcomes ?? [
      { label: "YES", isYes: true, buyPrice: m.yesPrice ?? 0.5, sellPrice: m.yesPrice ?? 0.5 },
      { label: "NO", isYes: false, buyPrice: m.noPrice ?? 0.5, sellPrice: m.noPrice ?? 0.5 },
    ],
    endsAt: ev.endsAt ?? m.endsAt ?? new Date(Date.now() + 86400000).toISOString(),
    volumeUsd: Number(ev.volumeUsd ?? m.volumeUsd ?? 0),
    liquidityUsd: Number(ev.liquidityUsd ?? m.liquidityUsd ?? 0),
  };
}

function rankCandidates(markets: Market[]): Market[] {
  // Prefer: short resolution window + decent liquidity + not yet traded.
  return markets
    .filter(m => m.liquidityUsd >= 500)
    .map(m => ({
      m,
      score:
        (m.liquidityUsd / 1000) +
        (m.volumeUsd / 10000) +
        Math.max(0, 7 - daysUntil(m.endsAt)) * 2,
    }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.m);
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return ms / (1000 * 60 * 60 * 24);
}

export async function runCycle(): Promise<void> {
  const cycleStart = Date.now();
  log({ type: "cycle_start", at: new Date().toISOString() });

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

  log({ type: "cycle_end", duration_ms: Date.now() - cycleStart });
}

export async function runForever(): Promise<void> {
  // graceful shutdown
  process.on("SIGINT", () => { log({ type: "shutdown" }); process.exit(0); });

  while (true) {
    try {
      await runCycle();
    } catch (e: any) {
      log({ type: "cycle_error", error: e.message });
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
