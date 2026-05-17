---
name: research-tech-companies
description: Research a Jupiter Predict market about a public tech company (Tesla, NVIDIA, Apple, Microsoft, SpaceX). Use when the market mentions a public-company ticker, earnings, deliveries, production, or stock price. Triages sources, computes a calibrated probability of YES.
---

# Research Tech Companies

## When to use
Trigger this skill when the market question references:
- A US-listed ticker (TSLA, NVDA, AAPL, MSFT, GOOGL, AMZN, META)
- Quarterly earnings, EPS, revenue
- Deliveries, production volumes
- IPO timing or stock-price thresholds
- Executive transitions
- Corporate events (M&A, mergers)

## Workflow
1. **Lock the resolution criteria.** Call `get_market_details` first. Identify: exact threshold, exact date, exact source (e.g. "Pyth 1-min candle Low", "official quarterly report").
2. **Gather evidence with prioritization:**
   - Earnings consensus + whisper numbers (search "<ticker> Q<n> consensus EPS")
   - Recent guidance from the company itself (search "<ticker> guidance Q<n>")
   - Channel checks / supply chain signals
   - Macro context (Fed, sector ETF, peer moves)
   - Exec signaling (X posts, interviews)
3. **Triangulate.** Need at least 2 independent sources for any claim.
4. **Output JSON ONLY** with shape `{ probabilityYes, confidence, reasoning, sources, caveats }`.

## Rules of thumb
- If market is already pricing close to your estimate (edge < 5%): set probabilityYes ≈ market price.
- "confidence" reflects evidence depth, not how strong the opinion feels.
- Resolution risk (ambiguous criteria, source dependency): lower confidence by 0.2.
- Stop after 8 tool calls. Quality > quantity.
