---
name: AI Benchmark Resolution Sourcing
description: Systematically identify and prioritize the official resolution leaderboard for AI benchmark markets before estimating probability; use when a market resolves on a specific leaderboard score.
---

## AI Benchmark Resolution Sourcing

Use this skill whenever a market resolves based on an AI model's score on a specific benchmark leaderboard (e.g., EpochAI FrontierMath, Scale AI Humanity's Last Exam, MATH, GPQA, etc.).

### Core Problem
Third-party trackers (llm-stats.com, pricepertoken.com, benchlm.ai, artificialanalysis.ai) frequently report different scores than the **official resolution source**. Acting on the wrong number can produce badly calibrated probability estimates.

### Workflow

1. **Identify the resolution source exactly.** Read the market resolution criteria carefully. Note:
   - Which leaderboard URL is authoritative (e.g., `labs.scale.com/leaderboard/humanitys_last_exam`, `epoch.ai/frontiermath`).
   - Whether the criteria requires a specific leaderboard listing vs. any public announcement.
   - Whether off-leaderboard evaluations (blog posts, substack, press releases) count.

2. **Fetch the official leaderboard first.** Before consulting third-party trackers, attempt to fetch the canonical resolution URL directly. Record:
   - The exact model name(s) listed (variant names matter: "Gemini 3.1 Pro" ≠ "Gemini 3.1 Pro Preview").
   - The score and date of last update.
   - Whether the target model appears at all.

3. **Cross-check third-party trackers — but weight them correctly.** Third-party scores are useful for recency and trend, but:
   - They may use different evaluation configs (with/without tools, extended thinking, temperature settings).
   - They may lag or lead the official leaderboard by days to weeks.
   - Score discrepancies >3pp between sources should be flagged as a key uncertainty in your reasoning.

4. **Assess procedural risk separately from capability risk.** Even if a model achieves the threshold score in some evaluation, ask:
   - Has the lab submitted results to the official leaderboard?
   - Does the official leaderboard update automatically or require manual submission?
   - If results are announced via blog/X/press release but not listed on the leaderboard, does the market resolve YES? (Usually NO — check the criteria.)

5. **Estimate probability with explicit source hierarchy:**
   - P(model achieves threshold score in some config) — capability estimate
   - × P(that config is submitted to and accepted by the official leaderboard by deadline) — procedural discount
   - = P(market resolves YES)

   Apply a 5–15% procedural discount when the official leaderboard has historically lagged announcements or required manual submission.

### Rules of Thumb
- If the official leaderboard and a reputable third-party disagree by >5pp, assume the official leaderboard score is lower until confirmed otherwise.
- "Announced by lab" ≠ "listed on leaderboard" — treat these as different events.
- Model naming is resolution-critical: verify the exact string (e.g., "Gemini 3.1 Pro" vs "Gemini 3.1 Pro Preview" vs "Gemini 3.1 Pro Deep Think") against what the resolution criteria specifies.
- When the resolution deadline is <8 weeks away and the model is not yet on the official leaderboard, apply an additional 5–10% discount for submission lag.
- Wide bid-ask spreads on benchmark markets often signal that other traders are also uncertain about the official vs. tracker score discrepancy — do not treat the market mid-price as well-informed in these cases.
