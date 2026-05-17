/**
 * Explore Jupiter Predict — list events in finance + adjacent categories,
 * group by tag, surface the markets where "informed aggregation" is the
 * key edge (the target pattern for Spark fork).
 *
 * Run: bun run src/explore-finance.ts
 */
import "./lib/env.ts";
import { listEvents } from "./lib/jupiter.ts";

const CATEGORIES_TO_PROBE = [
  "finance",
  "crypto",
  "tech",
  "business",
  "ipos",
  "stocks",
];

type Slim = {
  eventId: string;
  category: string;
  tags: string[];
  title: string;
  volumeUsd: number;
  volume24hr: number;
  closeTime: string;
  daysToClose: number;
  numMarkets: number;
};

function slim(e: any): Slim {
  const close = e.metadata?.closeTime ?? new Date(Date.now() + 365 * 86400000).toISOString();
  return {
    eventId: e.eventId,
    category: e.category ?? "?",
    tags: e.tags ?? [],
    title: e.metadata?.title ?? e.title ?? "(no title)",
    volumeUsd: Number(e.volumeUsd ?? 0) / 1_000_000,
    volume24hr: Number(e.volume24hr ?? 0) / 1_000_000,
    closeTime: close,
    daysToClose: (new Date(close).getTime() - Date.now()) / 86400000,
    numMarkets: (e.markets ?? []).length,
  };
}

const all: Slim[] = [];
for (const cat of CATEGORIES_TO_PROBE) {
  try {
    const events = await listEvents({ category: cat, includeMarkets: false });
    console.log(`\n[${cat}] → ${events.length} events`);
    for (const e of events) all.push(slim(e));
  } catch (e: any) {
    console.log(`[${cat}] ERROR ${e.message}`);
  }
}

const unique = Array.from(new Map(all.map(e => [e.eventId, e])).values());
console.log(`\n=== ${unique.length} unique events across categories ===\n`);

// Group by tag bucket → focus on tags that map to "informed aggregation"
const BUCKETS: Record<string, (s: Slim) => boolean> = {
  "Token launch / FDV": s =>
    s.tags.some(t => /token-launch|launch|fdv/i.test(t)) ||
    /fdv|token|launch/i.test(s.title),
  "IPO / corporate event": s =>
    s.tags.some(t => /ipo|merger|spac/i.test(t)) ||
    /ipo|merger|acquir|spac/i.test(s.title),
  "Earnings beats / KPI": s =>
    s.tags.some(t => /earnings|eps|deliveries|revenue/i.test(t)) ||
    /earnings|deliveries|production|revenue/i.test(s.title),
  "Stock price hit / ladder": s =>
    s.tags.some(t => /hit-price|updown|finance-updown|stocks|equities/i.test(t)),
  "Crypto project milestone": s =>
    s.category === "crypto" &&
    /tvl|reach|milestone|integrate|partner|deploy/i.test(s.title),
  "Macro / regulatory": s =>
    s.tags.some(t => /fed|rate|regulation|sec|cftc/i.test(t)) ||
    /Fed |rate hike|regulation|approval/i.test(s.title),
};

const buckets: Record<string, Slim[]> = {};
for (const [name, fn] of Object.entries(BUCKETS)) {
  buckets[name] = unique.filter(fn);
}

for (const [name, items] of Object.entries(buckets)) {
  if (!items.length) continue;
  console.log(`\n--- ${name} (${items.length}) ---`);
  const sorted = items.sort((a, b) => b.volumeUsd - a.volumeUsd).slice(0, 8);
  for (const s of sorted) {
    console.log(
      `  [${s.category}] vol=$${s.volumeUsd.toFixed(0).padStart(8)} · ` +
      `${s.daysToClose.toFixed(0)}d · ${s.eventId} · ${s.title.slice(0, 80)}`,
    );
  }
}

// Show what we miss: any event not in any bucket
const bucketed = new Set(Object.values(buckets).flat().map(s => s.eventId));
const orphan = unique.filter(s => !bucketed.has(s.eventId)).sort((a, b) => b.volumeUsd - a.volumeUsd);
console.log(`\n--- Not bucketed (${orphan.length}) — sample top 10 by volume ---`);
for (const s of orphan.slice(0, 10)) {
  console.log(
    `  [${s.category}] vol=$${s.volumeUsd.toFixed(0).padStart(8)} · ` +
    `tags=[${s.tags.slice(0, 5).join(",")}] · ${s.title.slice(0, 70)}`,
  );
}
