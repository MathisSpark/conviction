/**
 * Smoke test: hit Jupiter Predict API to confirm auth + list TSLA-related
 * events. Run with: bun run src/smoke-test.ts
 */

import "dotenv/config";
import { listEvents, searchEvents, getMarket } from "./lib/jupiter.ts";

async function main() {
  console.log("--- Jupiter Predict smoke test ---");
  console.log("API URL:", process.env.JUPITER_PREDICT_API_URL);
  console.log("API KEY present:", !!process.env.JUPITER_API_KEY);

  console.log("\n1. listEvents (no filter)");
  try {
    const events = await listEvents({ includeMarkets: true });
    console.log(`  ✓ ${events.length} events returned`);
    if (events.length > 0) {
      const first = events[0];
      console.log(`  first: ${first.eventId ?? first.id ?? "?"} — ${first.question ?? first.name ?? "?"}`);
      console.log(`  keys: ${Object.keys(first).slice(0, 10).join(", ")}`);
    }
  } catch (e: any) {
    console.log("  ✗", e.message);
  }

  console.log("\n2. searchEvents('tesla')");
  try {
    const tesla = await searchEvents("tesla", 5);
    console.log(`  ✓ ${tesla.length} results`);
    for (const e of tesla.slice(0, 3)) {
      console.log(`    - ${e.eventId ?? e.id ?? "?"} — ${e.question ?? e.name ?? "?"}`);
    }
  } catch (e: any) {
    console.log("  ✗", e.message);
  }

  console.log("\n3. searchEvents('TSLA')");
  try {
    const tsla = await searchEvents("TSLA", 5);
    console.log(`  ✓ ${tsla.length} results`);
    for (const e of tsla.slice(0, 5)) {
      console.log(`    - ${e.eventId ?? e.id ?? "?"} — ${e.question ?? e.name ?? "?"}`);
      if (e.markets) {
        for (const m of e.markets.slice(0, 2)) {
          console.log(`        market ${m.marketId ?? m.id} — yes=${m.yesPrice ?? m.priceYes ?? "?"} no=${m.noPrice ?? m.priceNo ?? "?"}`);
        }
      }
    }
  } catch (e: any) {
    console.log("  ✗", e.message);
  }
}

main().catch(console.error);
