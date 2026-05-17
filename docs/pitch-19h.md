# Pitch — Ralphthon @ Singapore — 19:00 SGT

> 5 minutes. Demo first, slides second. Build live demo first; if dashboard down, fall back to recorded screencap of the trail.

---

## Slide 1 — Hook (30s)

**"Most prediction markets fail because they lack informed traders."**

> Adhi (@aelix0x): *"AI forecasters can participate as automated market makers, synthesizing available information and providing initial price discovery, so the minimum viable liquidity threshold drops substantially."*

92% of Polymarket wallets lose money. The other 8% are bots. Most bots = latency arb on Binance vs Polymarket BTC. **We built a different kind of bot.**

---

## Slide 2 — What (60s)

**Conviction** = a fleet of dedicated AI experts on Solana prediction markets.

The key insight: **markets are assigned, not discovered.** A human (the "Spark") tells the system which market matters, and the system spawns a dedicated expert agent for it. That expert lives on that market for the duration. It grows cumulative context, refines its forecast cycle by cycle, and trades when edge crystallizes.

```
HUMAN: assigns marketId
   │
   ▼
EXPERT AGENT (Claude Sonnet — one per market)
  ├─ own /agents/<marketId>/AGENT.md (system prompt with full market criteria)
  ├─ own state.json (persistent across cycles)
  ├─ accumulates research notes over time (in-context memory)
  ├─ decides each cycle: research deeper / trade / exit / hold
  ├─ uses tools: Tavily search · read_url · X scrape · market data
  └─ subject to Skills (filesystem-based capability modules, see slide 4)

SHARED INFRASTRUCTURE
  • Same Solana wallet (BIP39 seed-derived, $50 disposable bankroll, $5 cap/trade)
  • Same Jupiter Predict API for execution
  • Same Telegram bridge for human-in-the-loop
  • Same Skills (Anthropic Skills pattern, agent self-writes new ones)
```

Today: 3 assigned markets, 3 experts running. Same architecture scales to N.

---

## Slide 3 — Live demo (90s)

Switch to terminal: `ls -la agents/` — 3 expert directories.

Pick one (e.g. POLY-1280315 — FrontierMath 60%+) and:

1. **`cat agents/POLY-1280315/AGENT.md`** — show: the assigned market, the resolution criteria, the cycle count, the trades placed.
2. **`cat agents/POLY-1280315/state.json | jq '.contextNotes[-3:]'`** — show the agent's CUMULATIVE NOTES, things it learned across cycles it spent on this market. *"This is how the agent gets smarter over time on the same market."*
3. **`cat agents/POLY-1280315/state.json | jq '.lastForecast'`** — show the latest forecast with reasoning + history of how it evolved.
4. Switch to dashboard http://localhost:3000 → show the trade tx + PnL.

Key message: *"This is one of 3 dedicated experts. The orchestrator pattern that 'surveys markets' was the wrong abstraction — markets aren't a deal flow you surf, they're a research subject you settle on. The Spark fork is: drop the same expert on a Spark idea coin decision, and it spends 3 hours becoming the world's best informed agent on whether that decision will be capital-efficient."*

---

## Slide 4 — Self-improvement (60s) 🔥

**The agent wrote this Skill at 13:54 SGT today, autonomously, after watching its own trades:**

> **AI Benchmark Resolution Sourcing**
>
> *"Use this skill whenever a market resolves based on an AI model's score on a specific benchmark leaderboard (e.g., EpochAI FrontierMath, Scale AI Humanity's Last Exam). Third-party trackers (llm-stats, pricepertoken, benchlm, artificialanalysis) frequently report different scores than the official resolution source. Acting on the wrong number can produce badly calibrated probability estimates."*

5-step workflow it wrote :
1. Identify the resolution source exactly (URL, criteria)
2. Fetch the official leaderboard FIRST
3. Cross-check 3rd party trackers but weight correctly
4. Assess procedural risk separately from capability risk
5. Estimate P(capability) × P(submission accepted by deadline) — explicit hierarchy

**Trigger event**: The agent had just placed trades on 4 Gemini benchmark markets (HLE 50/55/60%, FrontierMath 45/60%) and noticed that llm-stats showed Gemini 3.1 Pro at 51.4% while Scale's official leaderboard showed 44.7%. Different sources, different conclusions. It encoded this pattern as a reusable skill so future trades on benchmark markets would handle the source-ambiguity correctly.

Pattern: every 5 cycles, orchestrator reads the trail, asks itself "what heuristic would have improved my last trades?". If a clear answer surfaces, it writes a SKILL.md, a safety-acceptor (Haiku) reviews it against a 5-point checklist, then it lands in `/skills/active/` and gets loaded next cycle.

Safety guarantees: Skills are PROMPT additions only. Cannot touch wallet, caps, or code.

---

## Slide 5 — Bigger picture (90s)

**Conviction is the engine. The trading is the proof. The fork is the product.**

Same engine plugs into any decision market where capital allocation needs informed pricing:
- DAOs voting on treasury allocation
- Idea coins choosing builders
- Startups deciding catalyst budgets
- Companies pricing internal initiatives

Per Hanson/futarchy + Adhi MVL: when AI MMs can provide informed initial pricing, decision markets become economically viable on much smaller orgs. Today AI is the missing constraint. Conviction is one shape of that missing piece.

---

## Slide 6 — Ask (30s)

We want to ship this past Sunday. Find us at the door. Repo: https://github.com/MathisSpark/conviction (private — DM for access).

🦞

---

## Backup numbers (live as of cycle 6, mid-hands-off)

- 7 trades placed on Solana mainnet via Jupiter Predict (~$35 exposed)
- Edges found: 27% (Super Heavy explodes), 54% (FrontierMath 45%), 10% (Gemini 3.2 May 19 — 12.5x upside), 46% (FrontierMath 60%)
- 1 successful stop_loss executed end-to-end (tx 5pdSUAP...) — proves cash-out pipeline
- 1 skill self-written by the agent during the run (G3 = 1/2 minimum)
- 4 active skills total (3 initial + 1 self-written)
- Time-to-first-trade: ~2 min from cold start
- Per-cycle cost: ~$0.05-0.15 of Anthropic API spend

## Tech stack
- Claude Agent SDK (Opus 4.7 orchestrator, Sonnet 4.6 specialists, Haiku 4.5 skill-acceptor)
- Anthropic Skills pattern (filesystem-based)
- Jupiter Predict API (Polymarket + Kalshi on Solana)
- Solana mainnet (BIP39 derivable wallet)
- Helius RPC
- Tavily for web search
- Hono dashboard

## Forkable today

```bash
git clone <repo>
bun install
cp .env.example .env  # add ANTHROPIC_API_KEY, TAVILY, JUPITER, SEED_PHRASE
bun run src/index.ts loop
```

That's the whole onboarding for someone running their own Conviction MM.
