/**
 * Smoke test the Startup Desk on a realistic capital-allocation decision.
 *
 * Demonstrates the "Spark fork" narrative: the same engine that prices
 * Tesla earnings can advise a tokenized startup on whether spending $X
 * on a catalyst will be capital-efficient.
 *
 * Run: bun run src/test-startup-desk.ts
 */
import "./lib/env.ts";
import { advise } from "./desks/startup.ts";

const decision = {
  question: "Should our tokenized startup allocate $10,000 of treasury to a 30-day TikTok organic marketing push targeting Solana developers?",
  context: `Background:
- We are a 2-person crypto startup with $200k treasury (ideacoin already launched).
- Current MRR: $4k (mostly from one enterprise pilot).
- Our product: a Solana-native prediction market analytics dashboard.
- Target audience: Solana developers and prediction market traders (Polymarket, Kalshi).
- We have one part-time content creator who can dedicate ~30hr to this push.
- Past channel performance: Twitter X grew to 2k followers in 6 months organically; TikTok untested.
- Competing channels we could allocate to instead: paid X ads (~$5/CPM), Solana Discord sponsorships, conference appearances.
- Success metric: did the $10k push generate >$10k of attributable MRR or pipeline value within 90 days?`,
  options: [
    "Allocate $10k to TikTok organic push",
    "Allocate $10k to paid X ads instead",
    "Split: $5k TikTok + $5k Discord sponsorships",
    "Hold the $10k, defer marketing decision",
  ],
};

console.log("=== Startup Desk Test ===\n");
console.log(`Decision: ${decision.question}\n`);
console.log(`Options:\n${decision.options.map((o, i) => `  ${i + 1}. ${o}`).join("\n")}\n`);
console.log("Calling advise()...\n");

const reco = await advise(decision);

console.log("=== Recommendation ===");
console.log(JSON.stringify(reco, null, 2));
