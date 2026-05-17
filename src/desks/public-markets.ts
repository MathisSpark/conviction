/**
 * Public Markets Desk.
 *
 * Ties together: market data (Jupiter) → specialist opinion → Kelly sizing →
 * order build (Jupiter) → sign+send (wallet).
 *
 * Logs every step so the orchestrator + dashboard can stream the trace live.
 */

import * as jupiter from "../lib/jupiter.ts";
import * as wallet from "../lib/wallet.ts";
import { kellySize } from "../lib/kelly.ts";
import { researchMarket } from "../specialists/tech-company.ts";
import type { Market } from "../types.ts";

const MAX_BET_USD = Number(process.env.MAX_BET_USD ?? 5);
const BANKROLL_USD = Number(process.env.TOTAL_BANKROLL_USD ?? 50);
const CONVICTION_THRESHOLD = Number(process.env.CONVICTION_THRESHOLD ?? 0.08);
const DRAWDOWN_STOP_PCT = Number(process.env.DRAWDOWN_STOP_PCT ?? 0.40);

// Position-check cache: avoid an API call to Jupiter every trade.
// Refreshed lazily on each evaluateAndTrade call.
let cachedPositions: { ts: number; marketIds: Set<string>; lostUsd: number } | null = null;
const POSITION_CACHE_TTL_MS = 30_000;

export type DeskResult =
  | { status: "skipped"; market: Market; reason: string; opinion: any }
  | { status: "executed"; market: Market; opinion: any; sizing: any; txSig: string };

export async function evaluateAndTrade(market: Market): Promise<DeskResult> {
  // Pre-flight safety checks.
  const guard = await preflightGuard(market);
  if (guard) return guard;

  log(`[desk] researching ${market.marketId} :: ${market.question}`);

  const opinion = await researchMarket(market);
  log(`[desk] opinion :: pYES=${opinion.probabilityYes.toFixed(3)} conf=${opinion.confidence.toFixed(2)} side=${opinion.side}`);
  log(`[desk] reasoning :: ${opinion.reasoning}`);

  const yesPrice = priceFromMarket(market);
  if (yesPrice === null) {
    return { status: "skipped", market, reason: "no YES price available", opinion };
  }

  const sizing = kellySize({
    probabilityEstimated: opinion.probabilityYes,
    marketPriceYes: yesPrice,
    bankrollUsd: BANKROLL_USD,
    maxBetUsd: MAX_BET_USD,
    confidence: opinion.confidence,
    convictionThreshold: CONVICTION_THRESHOLD,
  });
  log(`[desk] sizing :: ${sizing.rationale}`);

  if (sizing.betUsd <= 0) {
    return { status: "skipped", market, reason: sizing.rationale, opinion };
  }

  const order = await jupiter.buildOrder({
    ownerPubkey: wallet.pubkey(),
    marketId: market.marketId,
    isYes: sizing.side === "YES",
    isBuy: true,
    depositUsd: sizing.betUsd,
  });
  log(`[desk] order built :: ${order.contracts} contracts · fee $${order.feeUsd ?? "?"}`);

  const txSig = await wallet.signAndSend(order.transaction);
  log(`[desk] tx signed and sent :: ${txSig}`);

  // Invalidate cache so the next trade sees this new position immediately.
  invalidatePositionCache();

  return { status: "executed", market, opinion, sizing, txSig };
}

function priceFromMarket(market: Market): number | null {
  const yesOutcome = market.outcomes.find(o => o.isYes);
  if (!yesOutcome) return null;
  return yesOutcome.buyPrice;
}

/**
 * Pre-flight: skip if we already hold a position on this market, OR if
 * the account has lost more than DRAWDOWN_STOP_PCT of bankroll.
 */
async function preflightGuard(market: Market): Promise<DeskResult | null> {
  try {
    const now = Date.now();
    if (!cachedPositions || now - cachedPositions.ts > POSITION_CACHE_TTL_MS) {
      const positions = await jupiter.getPositions(wallet.pubkey());
      const marketIds = new Set<string>();
      let lostUsd = 0;
      for (const p of positions as any[]) {
        if (p.marketId) marketIds.add(p.marketId);
        const pnl = Number(p.pnlUsdAfterFees ?? p.pnlUsd ?? 0) / 1_000_000;
        if (pnl < 0) lostUsd += Math.abs(pnl);
      }
      cachedPositions = { ts: now, marketIds, lostUsd };
    }
    if (cachedPositions.marketIds.has(market.marketId)) {
      return {
        status: "skipped",
        market,
        reason: "already hold a position on this market",
        opinion: null as any,
      };
    }
    if (cachedPositions.lostUsd > BANKROLL_USD * DRAWDOWN_STOP_PCT) {
      return {
        status: "skipped",
        market,
        reason: `drawdown stop: lost $${cachedPositions.lostUsd.toFixed(2)} > ${(BANKROLL_USD * DRAWDOWN_STOP_PCT).toFixed(2)} threshold`,
        opinion: null as any,
      };
    }
    return null;
  } catch (e: any) {
    log(`[desk] preflight check failed (continuing): ${e.message}`);
    return null;
  }
}

export function invalidatePositionCache() {
  cachedPositions = null;
}

function log(line: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`${ts} ${line}`);
}
