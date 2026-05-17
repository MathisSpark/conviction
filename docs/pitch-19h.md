# Pitch — Ralphthon @ Singapore — 19:00 SGT

> 5 minutes. Demo first, slides second. Build live demo first; if dashboard down, fall back to recorded screencap of the trail.

---

## Slide 1 — Hook (30s)

**"Most prediction markets fail because they lack informed traders."**

> Adhi (@aelix0x): *"AI forecasters can participate as automated market makers, synthesizing available information and providing initial price discovery, so the minimum viable liquidity threshold drops substantially."*

92% of Polymarket wallets lose money. The other 8% are bots. Most bots = latency arb on Binance vs Polymarket BTC. **We built a different kind of bot.**

---

## Slide 2 — What (60s)

**Conviction** is an AI market maker built on Claude Agent SDK + Skills.

```
ORCHESTRATOR (Opus)
  ├─ scans Jupiter Predict markets
  ├─ dispatches to specialist subagents (Sonnet)
  ├─ aggregates opinions, computes Kelly, executes via Solana wallet
  └─ self-improves: writes new Skills/specialists during the run

3 ACTIVE SKILLS at start:
  • research-tech-companies     — TSLA/NVDA/AAPL/MSFT
  • research-product-releases   — Gemini, Cybercab, Starship
  • kelly-position-sizing       — fractional Kelly + safety caps

POSITION MONITOR (parallel)
  └─ exits on convergence to our forecast · claims winnings

TELEGRAM BRIDGE
  └─ pings Mathis when stuck, ingests his guidance
```

---

## Slide 3 — Live demo (90s)

Switch to dashboard: http://localhost:3000

1. **Open positions table** — show real money mainnet trades.
2. **Active Skills count** — start with 3, end with N (depends on hands-off result).
3. **Reasoning trace stream** — one specific trade, full reasoning:
   - "Market priced Gemini score on FrontierMath at 92% YES"
   - "Our research: only 38% (Gemini 3 Pro = 38%, no Gemini hit 45% on EpochAI)"
   - "Edge 54%, bought NO at $0.54 — $5 stake → $9.25 if right"

---

## Slide 4 — Self-improvement (60s)

**The agent wrote this Skill at HH:MM today, autonomously:**

> [show the most interesting Skill the reflect step produced during hands-off, with the trail entry that triggered it]

Pattern: every 5 cycles, orchestrator reads the trail, asks itself "what heuristic would have improved my last trades?". If a clear answer surfaces, it writes a SKILL.md, a safety-acceptor reviews it, then it lands in `/skills/active/` and gets loaded next cycle.

Safety: Skills are PROMPT additions only. Cannot touch wallet, caps, or code.

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

## Backup numbers (if asked)

- Time-to-first-trade: ~2 min from cold start (specialist research is the bottleneck).
- Per-cycle cost: ~$0.05-0.15 of Anthropic API calls.
- 3h hands-off result: [fill in at 16:00 SGT]
  - N trades placed
  - $X exposed / $50 bankroll
  - PnL: $Y
  - Skills self-written: N
  - Position monitor exits: N
  - Claims executed: N

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
