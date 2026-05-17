/**
 * Single-trade smoke test on mainnet Jupiter Predict.
 *
 * Run: bun run src/place-test-trade.ts <marketId> <YES|NO> <usdAmount>
 * Example: bun run src/place-test-trade.ts POLY-2159735 YES 0.50
 *
 * If JUPITER_DRY_RUN=true, builds the order but does NOT broadcast.
 */
import "./lib/env.ts";
import { buildOrder, getMarket, getPositions } from "./lib/jupiter.ts";
import { pubkey, signAndSend } from "./lib/wallet.ts";

const marketId = process.argv[2];
const side = (process.argv[3] ?? "YES").toUpperCase();
const usd = Number(process.argv[4] ?? "0.50");

if (!marketId) {
  console.error("Usage: bun run src/place-test-trade.ts <marketId> <YES|NO> <usdAmount>");
  process.exit(1);
}

const DRY_RUN = process.env.JUPITER_DRY_RUN === "true";

const wallet = pubkey();
console.log(`Wallet: ${wallet}`);
console.log(`Mode: ${DRY_RUN ? "DRY RUN (no broadcast)" : "MAINNET REAL TRADE"}`);
console.log(`Trade: ${marketId} ${side} $${usd}\n`);

// 1. Show market
const m: any = await getMarket(marketId);
console.log("Market:");
console.log(`  title: ${m.title}`);
console.log(`  status: ${m.status}`);
console.log(`  buyYes=$${(m.pricing?.buyYesPriceUsd ?? 0) / 1e6} buyNo=$${(m.pricing?.buyNoPriceUsd ?? 0) / 1e6}\n`);

if (m.status !== "open") {
  console.error("Market is not open — aborting");
  process.exit(1);
}

// 2. Build order via Jupiter
console.log("Building order via Jupiter...");
const order = await buildOrder({
  ownerPubkey: wallet,
  marketId,
  isYes: side === "YES",
  isBuy: true,
  depositUsd: usd,
});
console.log(`  contracts: ${(order as any).contracts ?? "?"}`);
console.log(`  fee: ${(order as any).feeUsd ?? "?"}`);
console.log(`  tx (first 80 chars): ${order.transaction?.slice(0, 80)}...\n`);

if (DRY_RUN) {
  console.log("DRY RUN — not broadcasting. ✓ build_order succeeded.");
  process.exit(0);
}

// 3. Sign + send
console.log("Signing and broadcasting...");
const sig = await signAndSend(order.transaction);
console.log(`\n✓ TRADE EXECUTED`);
console.log(`Signature: ${sig}`);
console.log(`Explorer: https://solscan.io/tx/${sig}\n`);

// 4. Verify position
console.log("Checking positions...");
const positions = await getPositions(wallet);
console.log(`  ${positions.length} position(s)`);
for (const p of positions) {
  console.log(`  - ${(p as any).marketId} ${(p as any).side ?? "?"} contracts=${(p as any).contracts ?? "?"} pnl=$${(p as any).pnlUsd ?? "?"}`);
}
