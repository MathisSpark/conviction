---
name: kelly-position-sizing
description: Size a position on Jupiter Predict using fractional Kelly with safety caps. Use whenever a specialist returns a SpecialistOpinion that the orchestrator must turn into a bet size.
---

# Kelly Position Sizing

## When to use
After a specialist returns an opinion, before placing an order via Jupiter Predict.

## Algorithm
Given: `probabilityEstimated` (p), `marketPriceYes` (yp), `bankrollUsd` (B), `confidence` (c), `maxBetUsd` (M).

1. **Compute edges:**
   - `yesEdge = p − yp`
   - `noEdge = (1 − p) − (1 − yp)`
2. **Pick side**: side with higher positive edge.
3. **If max edge < CONVICTION_THRESHOLD (0.08): DO NOT BET. Return 0.**
4. **Kelly fraction:**
   - `b = (1 − price_chosen_side) / price_chosen_side`
   - `f* = (b × p_chosen − (1 − p_chosen)) / b`
5. **Fractional Kelly × confidence:** `f_actual = max(0, f* × 0.25 × c)`
6. **Bet size:** `bet = min(f_actual × B, M)`
7. **Cap:** `M = $0.50` is locked. Never override.

## Rules
- Never bet more than $0.50 in v0, regardless of Kelly suggestion.
- If confidence < 0.4: do not bet (specialist is unsure).
- After bet: record `entryPrice` and `forecastProbability` in `state.jsonl`.
- Monitor every 2 min: if market price converges to within 2% of forecast → close (take profit). If diverges by 15% → stop loss.
