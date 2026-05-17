/**
 * CLI entry — `bun run src/index.ts [mode]`
 *
 * Modes:
 *   loop        — orchestrator runs forever (default, used during hands-off)
 *   once        — single cycle, then exit (smoke test)
 *   research    — research one market by ID, print opinion (debug)
 *   discover    — list candidate markets without trading
 */

import "./lib/env.ts";
import { runForever, runCycle, discoverMarkets } from "./orchestrator.ts";
import { researchMarket } from "./specialists/tech-company.ts";
import * as jupiter from "./lib/jupiter.ts";

const mode = process.argv[2] ?? "loop";

const banner = `
┌──────────────────────────────────────────────┐
│  CONVICTION · Ralphthon @SG · ${new Date().toISOString().slice(0,10)}     │
│  Mode: ${mode.padEnd(38)}│
└──────────────────────────────────────────────┘`;
console.log(banner);

switch (mode) {
  case "loop":
    await runForever();
    break;

  case "once":
    await runCycle();
    break;

  case "discover": {
    const ms = await discoverMarkets();
    console.log(`\nTop ${ms.length} candidates:`);
    for (const m of ms) {
      console.log(`  · ${m.marketId} :: ${m.question.slice(0, 80)} (liq=$${m.liquidityUsd} vol=$${m.volumeUsd})`);
    }
    break;
  }

  case "research": {
    const marketId = process.argv[3];
    if (!marketId) {
      console.error("Usage: bun run src/index.ts research <marketId>");
      process.exit(1);
    }
    const m = await jupiter.getMarket(marketId);
    const op = await researchMarket(m);
    console.log("\nOpinion:");
    console.log(JSON.stringify(op, null, 2));
    break;
  }

  default:
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
}
