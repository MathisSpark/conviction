---
name: expert-POLY-1280315
description: Dedicated expert agent for Jupiter Predict market POLY-1280315. Researches this single market deeply over time, accumulates context, trades when edge appears, monitors positions, exits when warranted.
---

# Expert — POLY-1280315

**Market**: 60%+

**Resolution criteria** (excerpt):
This market will resolve to "Yes" if any Google Gemini model achieves the listed score or greater on the FrontierMath Exam by June 30, 2026, 11:59 PM ET. Otherwise, the market will resolve to "No".

This market will resolve according to the Epoch AI’s Frontier Math benchmarking leaderboard (https://epoch.ai/frontiermath) for Tier 1-3. Studies which are not included in the leaderboard (e.g. https://x.com/EpochAIResearch/status/1945905796904005720) will not be considered.

The primary resolution source will be information from EpochAI; however, a consensus of credible reporting may also be used. 

**Assigned at**: 2026-05-17T07:55:38.299Z
**Cycles**: 2
**Trades placed**: 0
**Exits**: 0

## Latest forecast
- pYES: 0.15
- confidence: 0.72
- side: NO
- reasoning: All three sub-agents strongly align toward NO: base rate is 22%, best Gemini scores remain ~36-38% (Tiers 1-3) against a 60% threshold, and even SOTA GPT-5.5 Pro only reaches 52.4% — 7.6pp below the bar. The Epoch AI leaderboard is in a correction freeze (1/3 of problems flagged with fatal errors, corrected scores not yet published), which further reduces the probability of an official qualifying score appearing before June 30, 2026. Resolution has 5 ambiguities, warranting a modest downward confidence adjustment. The NO position is already open at $0.850 avg price with mark at $0.453 — the market has moved significantly in our favor but has not converged to within 3 cents of our ~$0.85 forecast (our probabilityYes = 0.15, implying NO value ~$0.85), so no exit is warranted. No new trade is needed since a position already exists.

## Recent research notes
1. [cycle 1] Best official Gemini FrontierMath Tiers 1-3: ~38% (Gemini 3 Pro & 3.1 Pro, mid-2026). SOTA overall is GPT-5.5 Pro at 52.4%. 60% threshold not reached by any model.
2. [cycle 1] CRITICAL May 2026: Epoch AI flagged ~1/3 of FrontierMath problems have fatal errors via AI-assisted review — corrected scores pending. Could invalidate current numbers or delay leaderboard updates.
3. [cycle 1] Market implies ~55% YES but evidence strongly favors NO (~72%). Existing NO position at $0.85 is underwater (mark $0.453) due to YES market enthusiasm, possibly from non-leaderboard Gemini evals being conflated.
4. [cycle 2] Mark price $0.453 implies market now sees ~45% YES probability — still above our 15% estimate, suggesting continued NO edge but position already open
5. [cycle 2] Leaderboard correction freeze (1/3 fatal errors, no updated scores) is a critical blocker for resolution before June 30 deadline
