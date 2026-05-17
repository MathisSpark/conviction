/**
 * Inspect a Jupiter Predict market: print question + current YES/NO
 * prices, volume, status. Used to verify the agent's forecast against
 * the actual market before placing a trade.
 *
 * Run: bun run src/check-price.ts POLY-2159735
 */
import "./lib/env.ts";
import { getMarket } from "./lib/jupiter.ts";

const marketId = process.argv[2];
if (!marketId) {
  console.error("Usage: bun run src/check-price.ts <marketId>");
  process.exit(1);
}

const m: any = await getMarket(marketId);
console.log(`\nMarket: ${marketId}`);
console.log(`  title: ${m.title ?? "(none)"}`);
console.log(`  status: ${m.status}`);
console.log(`  closeTime: ${m.closeTime ? new Date(m.closeTime * 1000).toISOString() : "(none)"}`);
console.log(`  buyYes: $${(m.pricing?.buyYesPriceUsd ?? 0) / 1_000_000}`);
console.log(`  sellYes: $${(m.pricing?.sellYesPriceUsd ?? 0) / 1_000_000}`);
console.log(`  buyNo:  $${(m.pricing?.buyNoPriceUsd ?? 0) / 1_000_000}`);
console.log(`  sellNo: $${(m.pricing?.sellNoPriceUsd ?? 0) / 1_000_000}`);
console.log(`  marketVolume: ${m.pricing?.volume ?? 0}`);
