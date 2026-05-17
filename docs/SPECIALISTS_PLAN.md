# Specialists Plan — what to build during the 3h hands-off

> The orchestrator delegates to specialists. Each specialist is a Claude Sonnet sub-agent with a focused system prompt + a curated tool set. During the hands-off window (13:00-16:00 SGT 2026-05-17), the agent itself builds and tests these specialists.

---

## Two market modes (same engine, different framing)

| Mode | Question type | Example |
|---|---|---|
| **Prediction market** | "Did they make the right decision?" → forecast the OUTCOME of a past/current decision | Tesla deliveries Q2 — will the production/marketing/inventory decisions taken 6mo ago result in 400k+ deliveries? |
| **Decision market** (Spark fork) | "Will this be the right decision?" → forecast the OUTCOME of a candidate decision | "If Spark allocates $10k marketing to catalyst X, will it produce > $30k revenue in 3 months?" |

**Same specialists work on both.** The question framing differs; the research workflow is identical (gather evidence, weigh, output probability).

---

## Specialist roster — build these inside `/agents/`

Each specialist = directory `/agents/<name>/` with `AGENT.md` (system prompt) + `tools.json` (tool whitelist).

### Tier 1 — must exist by end of hands-off

| # | Name | Role | Input | Output |
|---|---|---|---|---|
| 1 | **`pricing-mathematician`** | Computes the "fair" probability given inputs from other specialists; identifies mispricing vs market | List of `SpecialistOpinion`s + market price | `{ fairProbability, edgeBps, kellySize, rationale }` |
| 2 | **`financial-reports-analyst`** | Reads 10-K / 10-Q / earnings transcripts / analyst notes | Ticker + market question | `{ keyMetrics, vsConsensus, signals[] }` |
| 3 | **`competitive-analyst`** | Maps competitors, market share, moats, recent strategic moves | Company + sector | `{ marketShare, competitors[], moats[], threats[] }` |
| 4 | **`executive-signal-reader`** | Reads CEO/exec X posts, interviews, earnings calls for confidence/doubt/leaks | List of execs | `{ recentSignals[], confidence, contradictions[] }` |
| 5 | **`base-rate-historian`** | Computes historical base rates ("how often did Tesla hit guidance in past 8 quarters?") | Pattern + horizon | `{ baseRate, n, ci, comparable_cases[] }` |

### Tier 2 — opportunistic if Tier 1 done

| # | Name | Role |
|---|---|---|
| 6 | `supply-chain-tracker` | Operational KPI markets — lithium, semis, regional registrations |
| 7 | `product-release-watcher` | R&D timing markets — GitHub commits, beta leaks, dev forums |
| 8 | `crowd-sentiment` | X / Reddit / dev forums aggregate sentiment, weighted by historical accuracy |
| 9 | `resolution-criteria-parser` | Decomposes ambiguous resolution criteria, flags edge cases |
| 10 | `regulatory-watcher` | SEC/FDA/CFTC filings, hearing calendars |

### Meta-agents (already exist or trivial)

| Name | Role | Status |
|---|---|---|
| `orchestrator` | Dispatches to specialists, aggregates, decides | ✓ exists |
| `skill-acceptor` | Reviews proposed new skills/agents before promotion | ✓ exists |
| `specialist-creator` | Builds new specialists when orchestrator detects gap | ← to build during hands-off |
| `position-monitor` | Surveys open positions, decides exit | ← to build during hands-off |
| `telegram-bridge` | Asks Mathis when stuck, gets human guidance | ← to build during hands-off |

---

## How specialists compose (orchestration flow)

```
Market discovered (e.g. "Tesla Q2 deliveries ≥ 400k?")
  │
  ▼
[orchestrator]
  │ classifies market type (operational/KPI/etc.)
  │ dispatches to relevant specialists in parallel:
  │
  ├─→ [financial-reports-analyst] reads Tesla Q1 10-Q, guidance
  ├─→ [supply-chain-tracker] reads CN-Wire shipments, lithium prices
  ├─→ [executive-signal-reader] reads Elon X posts last 30d
  ├─→ [base-rate-historian] computes Tesla hit-guidance rate
  └─→ [competitive-analyst] looks at BYD/Rivian/Lucid moves
  │
  ▼
[pricing-mathematician]
  │ aggregates all SpecialistOpinions → fair probability
  │ compares to market price → computes edge in bps
  │ proposes Kelly-sized trade
  │
  ▼
[orchestrator]
  │ if edge ≥ threshold AND budget OK: execute via [Public Markets Desk]
  │ else: log + skip + propose reason
```

---

## Auto-improvement during hands-off (what the agent does to itself)

Every 5 cycles, the orchestrator runs `reflectAndPropose`. It can:
1. **Write a new Skill** → augments existing specialist prompts (current behavior).
2. **Spawn a new Specialist** → writes `/agents/<new-name>/AGENT.md` + `tools.json`, then orchestrator loads + uses it next cycle.
3. **Adjust dispatch policy** → which specialists fire for which market types.

A `specialist-creator` agent (to be written first thing in the hands-off) handles step 2: takes a "what's missing" description and outputs a complete AGENT.md.

---

## What 16:00 SGT looks like (target)

- `/agents/` contains **≥ 5 specialists** (Tier 1 minimum).
- Orchestrator has fired at least 3 of them on real markets.
- Trail shows the multi-agent dispatch in action.
- Telegram bot has sent ≥ 1 question to Mathis and received a reply.
- Wallet has placed ≥ 2 trades (one already done) and ideally tried 1 cash-out / claim flow.
- All accomplished without Mathis touching the keyboard.
