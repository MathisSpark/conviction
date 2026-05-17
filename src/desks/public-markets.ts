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

const MAX_BET_USD = Number(process.env.MAX_BET_USD ?? 20);
const BANKROLL_USD = Number(process.env.TOTAL_BANKROLL_USD ?? 100);
const CONVICTION_THRESHOLD = Number(process.env.CONVICTION_THRESHOLD ?? 0.15);

export type DeskResult =
  | { status: "skipped"; market: Market; reason: string; opinion: any }
  | { status: "executed"; market: Market; opinion: any; sizing: any; txSig: string };

export async function evaluateAndTrade(market: Market): Promise<DeskResult> {
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

  return { status: "executed", market, opinion, sizing, txSig };
}

function priceFromMarket(market: Market): number | null {
  const yesOutcome = market.outcomes.find(o => o.isYes);
  if (!yesOutcome) return null;
  return yesOutcome.buyPrice;
}

function log(line: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`${ts} ${line}`);
}
