# Conviction — PRD v0.2

> Locked on 2026-05-17 at Ralphthon @ Singapore. Updated end-of-run to reflect the final shipped architecture (multi-agent + assigned-expert mode).

> 📊 Visual companions: [`architecture.html`](architecture.html) (full mermaid diagrams) · [`deck.html`](deck.html) (4-slide pitch).

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

## 3. Architecture (final, shipped)

**Markets are assigned, not discovered.** A human (the "Spark") tells Conviction which market matters; for each, we spawn ONE dedicated expert. The expert is itself an orchestrator that, every cycle, dispatches **4 sub-specialists in parallel** and aggregates their structured outputs into a final decision.

```
HUMAN: assigns marketId(s) via ASSIGNED_MARKETS env var
   │
   ▼
src/experts.ts loops every 90s, for each assigned market:
   │
   ▼
EXPERT (one per market — see /agents/<marketId>/AGENT.md + state.json)
   │
   ▼  (each cycle dispatches in parallel)
   │
   ├──► sub-agent 1: resolution-analyst   (Haiku)       → criteria + ambiguities
   ├──► sub-agent 2: evidence-gatherer    (Sonnet+tools)→ web/X/URL signals
   ├──► sub-agent 3: base-rate-historian  (Sonnet)      → comparable past cases
   └──► sub-agent 4: pricing-math         (Sonnet)      → aggregates 1+2+3
                                                            ↓
                                          FinalDecision {forecast, action}
                                                            ↓
                                  ┌─────────────┼─────────────┐
                                  ▼             ▼             ▼
                                trade          exit           hold
                                  │             │             │
                                  ▼             ▼             ▼
                              Jupiter Predict (Solana mainnet)
                                  │
                              shared BIP39 wallet ($50, $5/trade cap)
                                  │
                              save state.json + log multi_agent_trace
```

**Beyond the 4 hardcoded sub-specialists**, the expert can also **spawn new specialists on the fly** via the Anthropic Skills pattern. Every 5 cycles, a reflect step proposes a new `SKILL.md` (a focused sub-agent's instructions); a Haiku acceptor reviews it against a 5-point checklist; if accepted, it lands in `/skills/active/` and is loaded into next cycle's sub-agent prompts.

**Parallel to the experts**, two desks consume the same engine:
- **Public Markets Desk** (the experts above) — places real trades on Jupiter Predict.
- **Startup Desk** ([src/desks/startup.ts](../src/desks/startup.ts)) — same research engine pointed at a capital-allocation question instead of a trade. Returns a recommendation with cited sources. Forkable to Spark idea coins / DAO treasury decisions.

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
- The pricing-math sub-agent returns `{ probabilityYes, confidence, side, edgePct, action }`.
- If `action == "trade"` AND no open position on this market AND `edge ≥ CONVICTION_THRESHOLD` (0.08) AND `confidence ≥ 0.4`, enter.
- Size = 1/4 Kelly × confidence, **capped at MAX_BET_USD = $5** and floored at Jupiter's $5 minimum (so practically every trade is exactly $5).

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
- **Add prompt content** to existing sub-specialists (heuristics, source priorities, market type expertise). Loaded into next cycle's sub-agent prompts.
- **Spawn new sub-specialists** when the team needs a domain it doesn't cover (e.g. a Gemini-release-watcher beyond the 4 hardcoded sub-agents).
- **Demonstrated**: 2 skills self-written during this run — `ai-benchmark-resolution-sourcing` (cycle 5) and `multi-bracket-consistency` (cycle 10).

### 6.4 What Skills CANNOT do (safety)
- Cannot modify `MAX_BET_USD`, `TOTAL_BANKROLL_USD`, drawdown stop, or any wallet permission.
- Cannot edit `lib/wallet.ts`, `lib/jupiter.ts`, or `lib/kelly.ts` (the trade execution layer).
- Cannot delete or override existing active Skills (only add).
- Every Skill change is git-committed with `[skill] <name>` prefix for audit trail.

---

## 7. Demo flow

### 7.1 13:00 SGT — Hands off begins
- Submit team + product intro card.
- experts.ts launches (originally with single-specialist; later refactored to multi-agent mid-window).

### 7.2 13:00–18:30 — Run autonomous (window extended past 16:00 for multi-agent dev)
- 3 experts each cycle through assigned markets, dispatching 4 sub-specialists in parallel.
- Self-improves via Skills loop (2 skills self-written: `ai-benchmark-resolution-sourcing` cycle 5, `multi-bracket-consistency` cycle 10).
- On-chain trades + autonomous exits as forecasts evolve.

### 7.3 18:30–19:00 — Demo prep
- Pick best trade narratives from the trail (the multi-agent exit on POLY-2268715 is the killer story).
- Pull skill the agent wrote autonomously.
- Open dashboard + state.json files in terminal as demo props.

### 7.4 19:00 — Finals (if top 5)
1. (30s) **Hook**: MVL critique — small markets fail because no informed traders. Cite Hanson + Adhi.
2. (60s) **What**: Conviction = AI market maker with dedicated experts per market, each deploying 4 parallel sub-specialists. Built on Claude Agent SDK + Anthropic Skills.
3. (90s) **Demo**: walk through [`deck.html`](deck.html) + show one expert's state.json (cumulative notes growing over cycles) + show a Skill the agent wrote autonomously + cite one autonomous on-chain exit.
4. (60s) **Bigger picture**: same engine plugs into any decision market where capital allocation needs informed prices (Spark idea coins, DAO treasuries). Forkable — see [`startup-desk-demo.md`](startup-desk-demo.md).
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

- Swig wallet (using BIP39 seed-derived hot wallet — disposable, $50).
- Telegram / Discord scraping by sub-agents (Tavily + X via twitterapi.io only).
- Auto-modification of trade execution code (Skills are additive prompts only).
- Production-grade dashboard (minimal Hono + SSE for live demo).
- Position monitor as its own process (folded into the expert cycle via `action: exit`).

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
