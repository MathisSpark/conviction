/**
 * Smoke test the 3 critical external keys: Anthropic, Tavily, Helius RPC.
 * Quick and cheap — under $0.01 of API spend total.
 *
 * Run: bun run src/smoke-keys.ts
 */
import "./lib/env.ts";
import Anthropic from "@anthropic-ai/sdk";
import { Connection } from "@solana/web3.js";

const fails: string[] = [];

console.log("=== ANTHROPIC ===");
try {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const r = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 50,
    messages: [{ role: "user", content: "Say PONG in one word." }],
  });
  const text = r.content.filter(b => b.type === "text").map((b: any) => b.text).join("").trim();
  console.log(`  ✓ ${text} (model=${r.model})`);
} catch (e: any) {
  console.log("  ✗", e.message);
  fails.push("anthropic");
}

console.log("\n=== TAVILY ===");
try {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: "Tesla Q2 2026 delivery estimates",
      max_results: 3,
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  const json: any = await r.json();
  console.log(`  ✓ ${json.results?.length ?? 0} results`);
  for (const x of (json.results ?? []).slice(0, 2)) {
    console.log(`    - ${x.title?.slice(0, 70)}`);
  }
} catch (e: any) {
  console.log("  ✗", e.message);
  fails.push("tavily");
}

console.log("\n=== HELIUS RPC ===");
try {
  const conn = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
  const slot = await conn.getSlot();
  const epoch = await conn.getEpochInfo();
  console.log(`  ✓ slot=${slot} epoch=${epoch.epoch}`);
} catch (e: any) {
  console.log("  ✗", e.message);
  fails.push("helius");
}

console.log(fails.length ? `\nFAILED: ${fails.join(", ")}` : "\nALL KEYS OK ✓");
