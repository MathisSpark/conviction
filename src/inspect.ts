/**
 * Inspect the actual Jupiter Predict response shape so we can fix
 * normalizeMarket correctly.
 *
 * Run: bun run src/inspect.ts
 */
import "./lib/env.ts";
import { searchEvents, getEvent } from "./lib/jupiter.ts";

const results = await searchEvents("TSLA", 3);
console.log("=== search('TSLA') first event (full JSON) ===");
console.log(JSON.stringify(results[0], null, 2));

if (results[0]?.eventId) {
  console.log("\n=== getEvent for first eventId (truncated) ===");
  const detail = await getEvent(results[0].eventId);
  console.log(JSON.stringify(detail, null, 2).slice(0, 4000));
}
