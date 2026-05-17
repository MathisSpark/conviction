---
name: Multi-Bracket Market Consistency
description: When multiple markets share the same underlying event (e.g. Starship launches, Tesla deliveries), build one probability distribution across all brackets and price each bracket consistently — instead of re-researching each bracket independently.
---

## Multi-Bracket Market Consistency

### When to apply
You are looking at 3+ markets that are **different outcome buckets of the same underlying event** — recognizable when:
- They share the same `eventId` (e.g. `POLY-102763`, `POLY-340178`)
- Their questions differ only by a numeric range or date label (e.g. "<5", "5-6", "9-10"; "375k–400k", "400k–425k")

This was observed in cycles 7-9 (POLY-916715/716/718/721/722 — all Starship 2026 launches) and cycles 13-15 (POLY-1846795/797/798/801 — all Tesla Q2 2026 deliveries).

### Workflow

1. **Detect the family.** When you see a market with a numeric bucket label, search your current-cycle discovered IDs for sibling markets sharing the same `eventId`. Treat them as a **single research task**, not N separate tasks.

2. **Build one distribution first.** Before pricing any individual bracket:
   - Identify the full range of buckets (collect all sibling markets' labels).
   - Research the underlying quantity *once* (e.g. "how many Starship launches in 2026?", "Tesla Q2 2026 deliveries").
   - Construct a probability distribution across ALL buckets that sums to ~100%.
   - Use a named distribution shape if appropriate (e.g. log-normal for delivery counts, Poisson for launch counts) anchored to your point estimate and uncertainty.

3. **Assign bracket probabilities from the distribution.**
   - Each bracket's true probability = area under your distribution curve for that range.
   - Check: do all your bracket probabilities sum to ~100%? If not, rescale.
   - Flag any bracket where your estimate differs from the market price by >8% (your edge threshold) as a trade candidate.

4. **Consistency rules of thumb:**
   - If you assign P(YES) = 0.67 to "<5" and P(YES) = 0.20 to "5-6", your implicit P(≥7) = 0.13 — check this against the remaining buckets' market prices for sanity.
   - Never assign more than ~5% to an extreme bucket (e.g. ">16 launches") without explicit evidence of a mechanism that could produce it.
   - If sibling markets show contradictory market prices (e.g. two buckets each priced at 40%), flag this as a potential arbitrage signal.

5. **Prioritize the best-edge brackets.** After building the distribution, rank siblings by edge. Research and trade the highest-edge brackets first; skip the rest if edge < threshold — don't waste a separate research call per bracket.

### Rules
- **One research call per event family**, not one per bracket.
- **Cite your distribution** in the reasoning field so downstream cycles can reuse it if they encounter another sibling.
- **Never let two brackets in the same family have inconsistent implied probabilities** (e.g. don't assign 25% to "375k–400k" and separately assign 26% to "400k–425k" without also accounting for all other brackets).
- If you discover a sibling mid-cycle that you haven't priced yet, reuse the distribution you already built — do not re-research.
