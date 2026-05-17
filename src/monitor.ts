/**
 * Position monitor — runs in parallel with the orchestrator loop.
 *
 * Every N seconds:
 *  1. Fetch all open positions via Jupiter.
 *  2. For each, compare current mark price to entry price.
 *     - If converged toward our (forecast at entry) by ≥ X% → take profit (close).
 *     - If diverged ≥ STOP_LOSS_PCT → cut loss.
 *  3. For positions where the market has resolved → claim winnings.
 *
 * Forecast at entry is read from trail.jsonl (the most recent
 * desk_result for that marketId where status=executed).
 *
 * Run: bun run src/monitor.ts
 */
import "./lib/env.ts";
import { existsSync, readFileSync } from "fs";
import { getPositions, closePosition, claimWinnings } from "./lib/jupiter.ts";
import { pubkey, signAndSend } from "./lib/wallet.ts";
import { sendToMathis } from "./lib/telegram.ts";
import { appendFileSync } from "fs";

const TRAIL = process.env.TRAIL_FILE ?? "./trail.jsonl";
const MONITOR_LOG = process.env.MONITOR_LOG ?? "./monitor.jsonl";
const INTERVAL_MS = Number(process.env.MONITOR_INTERVAL_MS ?? 120_000); // 2 min
const HANDSOFF_END = process.env.HANDSOFF_END;

const TAKE_PROFIT_BUFFER = Number(process.env.EXIT_BUFFER_PCT ?? 0.02); // exit when mark ≤ buffer from forecast
const STOP_LOSS_PCT = Number(process.env.STOP_LOSS_PCT ?? 0.50);        // exit if loss > 50% on the position

function log(entry: Record<string, any>) {
  const line = JSON.stringify({ ts: Date.now(), ...entry });
  console.log(line);
  try { appendFileSync(MONITOR_LOG, line + "\n"); } catch {}
}

function withinHandsoff(): boolean {
  if (!HANDSOFF_END) return true;
  return Date.now() < new Date(HANDSOFF_END).getTime();
}

/**
 * Build a map of marketId → entry forecast (probabilityYes) by scanning
 * the orchestrator's trail for the most recent successful trade on that
 * market.
 */
function loadForecasts(): Map<string, { side: string; probYes: number; entryPrice: number }> {
  const out = new Map();
  if (!existsSync(TRAIL)) return out;
  const lines = readFileSync(TRAIL, "utf-8").trim().split("\n");
  for (const l of lines) {
    let e: any;
    try { e = JSON.parse(l); } catch { continue; }
    if (e.type !== "desk_result" || e.status !== "executed") continue;
    const r = e.result;
    if (!r?.market || !r?.opinion || !r?.sizing) continue;
    out.set(r.market.marketId, {
      side: r.sizing.side,
      probYes: r.opinion.probabilityYes,
      entryPrice: r.sizing.side === "YES"
        ? r.market.outcomes?.find((o: any) => o.isYes)?.buyPrice
        : r.market.outcomes?.find((o: any) => !o.isYes)?.buyPrice,
    });
  }
  return out;
}

async function tick() {
  const forecasts = loadForecasts();
  let positions: any[] = [];
  try {
    positions = await getPositions(pubkey()) as any[];
  } catch (e: any) {
    log({ type: "monitor_error", error: e.message });
    return;
  }
  log({ type: "monitor_tick", openCount: positions.length });

  for (const p of positions) {
    const id = p.marketId;
    const fc = forecasts.get(id);
    const isYes = !!p.isYes;
    const markPrice = Number(p.markPriceUsd ?? 0) / 1_000_000;
    const avgPrice = Number(p.avgPriceUsd ?? 0) / 1_000_000;
    const pnlPct = Number(p.pnlUsdAfterFeesPercent ?? p.pnlUsdPercent ?? 0);
    const claimable = !!p.claimable || !!p.canClaim;
    const status = p.eventMetadata?.isActive === false ? "resolved" : "open";

    log({
      type: "position_check",
      marketId: id,
      side: isYes ? "YES" : "NO",
      markPrice,
      avgPrice,
      pnlPct,
      claimable,
      status,
      forecast: fc?.probYes ?? null,
    });

    // 1. Claim if resolvable
    if (claimable && !p.claimed) {
      try {
        const r = await claimWinnings(p.pubkey ?? p.positionPubkey, pubkey());
        const sig = await signAndSend((r as any).transaction);
        log({ type: "claim_executed", marketId: id, sig });
        await sendToMathis(`💰 Claimed: ${id} payout via ${sig.slice(0, 12)}...`);
      } catch (e: any) {
        log({ type: "claim_error", marketId: id, error: e.message });
      }
      continue;
    }

    // 2. Stop loss
    if (pnlPct <= -STOP_LOSS_PCT * 100) {
      try {
        const r = await closePosition(p.pubkey ?? p.positionPubkey);
        const sig = await signAndSend((r as any).transaction);
        log({ type: "stop_loss", marketId: id, pnlPct, sig });
        await sendToMathis(`🛑 Stop loss ${id} @ ${pnlPct.toFixed(1)}% — closed via ${sig.slice(0, 12)}...`);
      } catch (e: any) {
        log({ type: "stop_loss_error", marketId: id, error: e.message });
      }
      continue;
    }

    // 3. Take profit on convergence to our forecast
    if (fc) {
      // For YES side: we win if market price rises toward fc.probYes.
      // For NO side: we win if market price falls toward 1 - fc.probYes.
      const targetMark = isYes ? fc.probYes : (1 - fc.probYes);
      const gapAtEntry = Math.abs(targetMark - avgPrice);
      const gapNow = Math.abs(targetMark - markPrice);
      const convergedBy = gapAtEntry > 0 ? (gapAtEntry - gapNow) / gapAtEntry : 0;

      if (gapNow <= TAKE_PROFIT_BUFFER || convergedBy >= 0.6) {
        try {
          const r = await closePosition(p.pubkey ?? p.positionPubkey);
          const sig = await signAndSend((r as any).transaction);
          log({ type: "take_profit", marketId: id, gapNow, convergedBy, pnlPct, sig });
          await sendToMathis(`💵 Take profit ${id} (${(convergedBy * 100).toFixed(0)}% converged, ${pnlPct.toFixed(1)}% pnl) — closed via ${sig.slice(0, 12)}...`);
        } catch (e: any) {
          log({ type: "take_profit_error", marketId: id, error: e.message });
        }
      }
    }
  }
}

console.log(`Position monitor starting. Interval ${INTERVAL_MS / 1000}s. Handsoff end: ${HANDSOFF_END ?? "infinite"}`);

while (withinHandsoff()) {
  try { await tick(); } catch (e: any) { log({ type: "tick_error", error: e.message }); }
  await new Promise(r => setTimeout(r, INTERVAL_MS));
}

log({ type: "monitor_stop", reason: "handsoff_end" });
