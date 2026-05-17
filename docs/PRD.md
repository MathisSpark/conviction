# Conviction — PRD v0.1

> Locked on 2026-05-17 at Ralphthon @ Singapore. Updated by the agent itself during the hands-off self-improvement window.

---

## 1. Mission (1 sentence)

> **Conviction is an AI market maker that reduces the Minimum Viable Liquidity floor on prediction markets — by synthesizing information at machine speed to provide informed price discovery so markets can exist where they couldn't before.**

Academic anchor: [Adhi (@aelix0x) on AI forecasters as automated MMs](https://x.com/aelix0x/status/2053928032318988366). Same thesis as Hanson's LMSR with information aggregation, applied to a setting where the informed-trader cost is the binding constraint.

---

## 2. Goals (REFRAMED — what 16:00 SGT looks like)

> **The 3h hands-off window is NOT a trading PnL competition. It's a BUILD window.** The agent grows the multi-agent system. Trades happen, but as validation that the pipeline works (place → monitor → cash-out), not as the primary success metric. Markets won't move much on a Sunday afternoon anyway.

| # | Goal | Measure | Target |
|---|---|---|---|
| G1 | **Multi-agent system built**: agent self-writes new specialists during hands-off | # of specialists in `/agents/` written/improved by the agent (per SPECIALISTS_PLAN.md Tier 1) | ≥ 3 |
| G2 | **End-to-end trading loop validated**: at least one full cycle of place + monitor + cash-out/claim | execution count of each phase in trail.jsonl | ≥ 1 of each |
| G3 | **Autonomous operation**: zero human edits to source code from 13:00 to 16:00 SGT | git log shows no commits by Mathis in window; agent self-commits with `[skill]` or `[agent]` prefix only | 0 human commits |

**Stretch**:
- G4: ≥ 2 trades placed on distinct markets (1 already done = baseline).
- G5: ≥ 1 Telegram question sent to Mathis and acted on his reply.
- G6: ≥ 1 successful position claim (cash-out flow validated).

---

## 3. Architecture

```
                  ┌───────────────────────────────────────────┐
                  │  ORCHESTRATOR (Claude Opus 4.7)           │
                  │  - Owns Solana wallet (seed-derived)      │
                  │  - Runs 2 loops in parallel:              │
                  │    A. Discovery+Trade   B. Position Monitor│
                  │  - Reads /skills/active/ each cycle       │
                  │  - Writes /skills/proposals/ each cycle   │
                  └──┬────────────────────────────────────┬───┘
                     │                                    │
        ┌────────────▼──────────┐         ┌───────────────▼────────┐
        │  PUBLIC MARKETS DESK  │         │  STARTUP DESK          │
        │  - Kelly-sized entry  │         │  - Capital allocation  │
        │  - Convergence exit   │         │    advisory (Spark-fork│
        │  - Stop loss          │         │    preview)            │
        │  - Jupiter Predict    │         │  - Optional linked PM  │
        │    (real money $50)   │         │    trade               │
        └──────────┬────────────┘         └────────────┬───────────┘
                   │                                   │
                   └───────────────┬───────────────────┘
                                   ▼
              ┌────────────────────────────────────────┐
              │  RESEARCH SUBAGENTS (Claude Sonnet 4.6)│
              │  - Tech / company-outcome              │
              │  - (skills add more dynamically)       │
              │                                        │
              │  Tools: Tavily search · X scrape ·     │
              │         read_url · get_market_details  │
              └────────────────────────────────────────┘
```

---

## 4. Markets in scope

Filter: **informed-aggregation markets** (not TA/latency-arb). Per `research/markets-survey.md` and Mathis's strategic call (operational KPI + R&D release).

| Market | Pattern | Vol | Window |
|---|---|---|---|
| Tesla deliveries Q2 2026 | Operational KPI | $43K | ~30d |
| NVDA / TSLA / MSFT quarterly earnings beat | Operational KPI | $300K+ | ~60d |
| Gemini 3.5 / 3.2 released by ___ | R&D / Product release | $1.4M / $537K | weeks |
| Cybercab ≤ $30k in 2026 | R&D / Product release | TBD | 8mo |
| SpaceX Starship Flight Test 12 | R&D / Product release | $2M | ~1mo |

**Out of scope (explicitly)**: BTC / oil / gold price ladders, daily stock up/down, tweet count markets — too TA / latency-arb to demonstrate informed-aggregation edge.

**Bonus short-term** (for live PnL visibility, not Spark-aligned): may include 1 TSLA Up/Down if dashboard demo requires a fast-moving price.

---

## 5. Trading dynamics

### 5.1 Entry rule
- Specialist returns `{ probabilityYes, confidence }`.
- Compute edge = max(p − yesPrice, (1−p) − noPrice).
- If `edge ≥ CONVICTION_THRESHOLD` (0.08) AND `confidence ≥ 0.4`, enter.
- Size = 1/4 Kelly × confidence, capped at `MAX_BET_USD` = **$0.50 (locked, no auto-bump)**.

### 5.2 Exit rule (critical: don't wait for resolution)
- **Take profit**: market price converges to within `EXIT_BUFFER_PCT` (0.02) of our forecast → close position.
- **Stop loss**: market diverges further from our forecast by 15% → close position.
- **Re-evaluate**: every 2 minutes, specialist refreshes forecast with new info. If forecast moves > 10% → recompute edge → adjust.
- **Resolution**: claim winnings when market resolves (passive).

### 5.3 Bankroll rules
- Total bankroll: $50 USDC on wallet `xZSjnVoiCDBC6Q5d6NfDi3ufKwoauWJW1j5WQ5Y3tgY`.
- Max position per market: **$5** (Jupiter Predict floor — discovered 2026-05-17, can't go lower).
- Hard stop: pause all trading if account drawdown > 40% ($20 lost) → auto-pause after ~4 consecutive full losses.
- Expected total exposure across 5 trades: $25 (50% of bankroll).
- Worst-case ($25 total loss): $25 remaining. Reasonable.

---

## 6. Self-improvement loop (the 3h hands-off magic)

**Pattern**: filesystem-based Skills (per [Claude Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)).

### 6.1 Layout
```
/skills/
├── active/
│   ├── tech-company-research/SKILL.md
│   ├── jupiter-discovery/SKILL.md
│   └── kelly-sizing/SKILL.md
└── proposals/
    └── <agent-generated>/SKILL.md
```

Each `SKILL.md` has YAML frontmatter `{ name, description }` + a body of instructions/heuristics. Loaded into the agent's context at the start of each cycle.

### 6.2 Cycle (every 60s during 13:00–16:00 SGT)

1. **Trade**: discover → research → entry → monitor positions → exit.
2. **Reflect** (every 5 cycles): Orchestrator reads the last N entries of `trail.jsonl`, asks itself:
   > "What heuristic, query, or specialist instruction, if I had it, would have improved the last trades? Propose a Skill."
3. **Propose**: writes a `SKILL.md` to `/skills/proposals/<slug>/`.
4. **Accept**: a `skill-acceptor` sub-call (Haiku) reviews the proposal against a checklist (does it have a name? a clear when-to-use description? does it not contradict an active Skill?). If passes → moves to `/skills/active/`.
5. **Reload**: next cycle starts by reading `/skills/active/` again.

### 6.3 What Skills CAN do
- **Add prompt content** to orchestrator or specialists (heuristics, source priorities, market type expertise).
- **Spawn new specialists**: a Skill can declare a new specialist (e.g. `gemini-release-watcher`) with its own system prompt + tool list. Orchestrator loads it at next cycle.
- **Add discovery queries**: extend `DEMO_QUERIES` to cover a new market category.

### 6.4 What Skills CANNOT do (safety)
- Cannot modify `MAX_BET_USD`, `TOTAL_BANKROLL_USD`, drawdown stop, or any wallet permission.
- Cannot edit `lib/wallet.ts`, `lib/jupiter.ts`, or `lib/kelly.ts` (the trade execution layer).
- Cannot delete or override existing active Skills (only add).
- Every Skill change is git-committed with `[skill] <name>` prefix for audit trail.

---

## 7. Demo flow

### 7.1 13:00 SGT — Hands off
- Submit team + product intro card.
- Orchestrator starts. Dashboard exposed publicly (Vercel or ngrok tunnel).

### 7.2 13:00–16:00 — Run autonomous
- Bot trades on its own.
- Bot self-improves via Skills loop.
- Dashboard shows: live PnL, open positions, reasoning trace stream, Skills added/improved.

### 7.3 16:00–17:00 — Demo prep (lobster windows)
- Pick the best 1–2 trade narratives from the trail.
- Pick the best 1–2 Skills the agent added.
- Rehearse 5 min pitch.

### 7.4 19:00 — Finals (if top 5)
1. (30s) **Hook**: MVL critique — most PMs/DMs lack informed traders. Cite Adhi.
2. (60s) **What**: Conviction = AI market maker that synthesizes info, takes informed positions, exits on convergence — built on Claude Agent SDK + Skills.
3. (90s) **Demo**: open dashboard, show 1 real trade with reasoning trace, show 1 Skill the agent wrote during the 3h.
4. (60s) **Bigger picture**: the same engine plugs into any decision market where capital allocation needs informed prices (idea coins, DAOs, governance). Forkable.
5. (30s) **Ask**: come find us, we're shipping past Sunday.

---

## 8. Spark fork (private — NOT in pitch, in roadmap)

The same engine, retargeted:
- Decision markets on Spark (idea coins) where the org has access to treasury data.
- Pattern A — **Operational**: "If we ship $X marketing for catalyst, is it capital-efficient?" → agent forecasts ROI window.
- Pattern B — **R&D**: "If we spend $100 of credits on feature Y, is it capital-efficient?" → agent forecasts feature impact.
- Pattern C — **Hiring**: "If we hire CEO Z, do we win?" → agent forecasts company outcome.
- 72h resolution windows match Spark decision market duration.
- Agent operates as AI MM on each new Spark decision market → MVL drops → markets become viable on small idea coins.

---

## 9. Out of scope (today)

- Swig wallet (using seed-derived hot wallet — disposable, $50).
- Multi-specialist routing (single tech/company specialist; Skills will add more if useful).
- Telegram / Discord scraping (Tavily + X via twitterapi.io only).
- Auto-modification of agent code (Skills are additive prompts only).
- Production-grade dashboard (minimal Hono + SSE for live demo).

---

## 10. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Jupiter Predict order fails (auth, slippage, min-bet) | Test with $0.50 first; if blocked, paper trade with same logic + log "would have bet" |
| Anthropic API budget runs out during 3h | Haiku for reflection step + reasonable maxTurns caps (8 per specialist call) |
| Specialist hallucinates probabilities | Confidence floor 0.4 to bet, every opinion logged with sources |
| Wallet drained by bug | Hard cap $5/trade, drawdown stop at 40%, total $50 max exposure |
| Internet flakes during 3h | Local SQLite cache of last-good market state, retries with backoff |
| Self-improvement Skill is bad / destructive | Skill-acceptor checklist + Skills can only add to prompts, not modify code |
| Demo dashboard goes down at 19:00 | Pre-recorded fallback video of best trade/skill from the run |

---

## 11. Cutlines (in priority order if we're behind)

1. **Must ship**: orchestrator loop + 1 specialist + entry/exit + Jupiter trade + minimal dashboard. (G1 + G2)
2. **Should ship**: Skills self-improvement loop. (G3)
3. **Nice to ship**: Startup Desk demo + Spark-fork slide. (G5)
4. **Drop first if behind**: Startup Desk; live dashboard fancy UI (replace with terminal log + screenshot).
