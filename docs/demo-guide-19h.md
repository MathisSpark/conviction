# Demo Guide — 19:00 SGT — Mathis cheat sheet

> Read this 5 min before going on stage. Print it. Don't read from screen.

## Setup checklist (do 15 min before)

```bash
# 1. Make sure the loop is still running OR has cleanly stopped
ls -la trail.jsonl  # last modified timestamp tells you

# 2. Verify dashboard is up
open http://localhost:3000

# 3. Get the latest summary
bun run src/summary.ts

# 4. Have these files in tabs:
#    - docs/pitch-19h.md          (slide notes)
#    - skills/active/ai-benchmark-resolution-sourcing/SKILL.md   (the agent-written skill)
#    - docs/startup-desk-demo.md  (Spark fork output)
```

## Slide-by-slide script

### Slide 1 — Hook (30s)
> "Most prediction markets fail because they lack informed traders. 92% of Polymarket wallets lose money. The other 8% are bots — but most are latency arb on Binance vs Polymarket BTC. We built a different kind of bot."

Show the Adhi tweet quote: "AI forecasters can participate as automated market makers, providing initial price discovery, so the MVL threshold drops substantially."

### Slide 2 — What (60s)
Pull up the architecture in pitch-19h.md. 1 minute.

Key beats:
- Orchestrator (Claude Opus) dispatches to specialist (Sonnet)
- 3 skills at start, grows during the run
- Solana wallet via BIP39 seed
- Jupiter Predict API (unified Polymarket + Kalshi)
- Position monitor (parallel loop)
- Telegram bridge for human-in-the-loop

### Slide 3 — Live demo (90s)
**Switch to dashboard at http://localhost:3000**

Walk through:
1. **Wallet pubkey** at top (`xZSjn...tgY`) — real money mainnet.
2. **Open positions table** — point to the trades placed:
   - "Tesla Starship Flight 12 by May 22 — bought YES at 78¢, market now at 71¢, paper loss of 9%"
   - "Gemini 3.2 by May 19 — bought NO at 8¢ — if Google doesn't ship tomorrow we get 12.5x"
   - "FrontierMath 60%+ — bought NO at 45¢, our research said only 9% probability — 46% edge"
3. **Active Skills count** — currently 4 (3 initial + 1 self-written).
4. **Reasoning trace stream** — pause for 5s, let one entry roll in. Say:
   > "Notice the reasoning depth. Every trade has cited sources, edge calculation, caveats. This isn't a black box — it's a junior analyst's report on every market."

### Slide 4 — Self-improvement (60s) 🔥
**Open `skills/active/ai-benchmark-resolution-sourcing/SKILL.md` in a terminal:**

> `cat skills/active/ai-benchmark-resolution-sourcing/SKILL.md`

Read aloud the description:
> "Systematically identify and prioritize the official resolution leaderboard for AI benchmark markets before estimating probability."

Then say:
> "The agent wrote this Skill at 13:54 SGT today. Autonomously. Why? Because it had just placed 4 trades on Gemini benchmark markets — Humanity's Last Exam at 50%, 55%, 60%; FrontierMath at 45% and 60% — and it noticed that llm-stats.com showed Gemini 3.1 Pro at 51.4% while Scale's official leaderboard showed 44.7%. Different sources, different conclusions. So it encoded the pattern: always identify the official source first, treat third-party trackers as signal but weight them correctly, separate capability risk from procedural risk. The skill is now loaded into every subsequent specialist call. The agent improved its own future research."

Pause. Let it land.

> "Safety: skills are prompt additions only. Cannot touch wallet, caps, or code. Every skill goes through a safety acceptor before promotion."

### Slide 5 — Bigger picture (90s)
**Open `docs/startup-desk-demo.md` in another terminal:**

Pull up the recommendation:
> "Same engine. Same hour. Asked: 'should a 2-person crypto startup spend $10k on TikTok or paid X ads?' The agent recommended paid X ads, cited Solana's 3M+ X audience, the recent crypto ad lift, the $5 CPM benchmark, and a tweet about $1.4B of wasted Web3 ad spend. 7 sources. 72% confidence. 90 seconds of compute. Indistinguishable from a junior MBA."

Then:
> "This is the fork. Conviction is the engine. The PM trading is the proof — we earn alpha on public markets to demonstrate the engine has edge. The fork is the product — drop the same engine into MetaDAO decisions, Spark idea coins, any DAO with a treasury. When AI market makers can price informed before humans even vote, the minimum viable liquidity threshold drops substantially. That's the Adhi thesis. Today AI is the missing constraint. Conviction is one shape of that piece."

### Slide 6 — Ask (30s)
> "We want to ship this past Sunday. Find us at the door. Repo is private right now — DM if you want access. Thanks."

🦞

---

## If a judge asks…

**"How much did you make/lose?"**
> "PnL on the day was [X] dollars on $35 exposed. But we explicitly deprioritized PnL — markets don't move on a Sunday afternoon. We optimized for [build, validation, skills written]. The trade direction was right on [N] of the trades per our research, but mark-to-market doesn't show that until resolution."

**"What's the secret to the agent's edge?"**
> "Two things. One, the specialist runs depth-first — Tavily + URL reads + parallel sources, then triangulates. Two, the conviction threshold filters out trades where the market is already priced — we only trade real mispricing. Most cycles we skip 80% of candidates. Discipline."

**"Is this on testnet or mainnet?"**
> "Mainnet. Real USDC. Real txs on chain — every trade has a Solscan link in the trail. The wallet started with $50, capped at $5 per trade so we never blow the bankroll."

**"What's the deal with Skills?"**
> "Anthropic's Skills pattern — filesystem-based capability modules. We start with 3. The agent reads its own trail every 5 cycles, asks 'what skill would have helped on my last trades?', writes a SKILL.md, a safety acceptor reviews it, then it lands in active and gets loaded next cycle. The agent grows its own capability."

**"Why Anthropic, not OpenAI?"**
> "Skills track is named after the Anthropic pattern. Claude Agent SDK has it native. Also: this engine is a research-heavy agent — Sonnet 4.6 calibration is unbeatable here. We could swap to OpenAI but the demo is built on Claude."

**"Can it lose money?"**
> "Yes, and it did — one stop_loss fired during the run, closed a position for a ~$4 loss. The drawdown stop at 40% would pause everything if we got into real trouble. We hit none of those guardrails."

**"What if the agent does something stupid?"**
> "Skills can only ADD to prompts. They can't change MAX_BET_USD, wallet permissions, or the trading code itself. Worst case, a bad skill produces worse research — capped at our $5 trade size. Mathis got 1 Telegram ping during the run for confirmation."

---

## Backup plan if dashboard goes down

```bash
# Print current state to terminal — same info as the dashboard
bun run src/summary.ts
```

Plus the trail.jsonl is the source of truth — `tail -f trail.jsonl` shows live activity even without dashboard.

## Final breath

Smile. Speak slow. The agent did the hard work. You're just the narrator.
