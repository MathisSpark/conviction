# Conviction

> An AI market maker that reduces the Minimum Viable Liquidity floor on prediction markets — by synthesizing information at machine speed.

Built at **Ralphthon @ Singapore — 2026-05-17**. Mainnet, real money, $50 disposable bankroll.

📊 **Full architecture diagrams**: open [`docs/architecture.html`](docs/architecture.html) in a browser.

---

## The thesis (Adhi MVL)

> *"AI forecasters can participate as automated market makers, synthesizing available information and providing initial price discovery, so the minimum viable threshold drops substantially."* — [@aelix0x](https://x.com/aelix0x/status/2053928032318988366)

Most prediction markets fail because they lack informed traders. 92% of Polymarket wallets lose money; the winners are mostly latency-arb bots, not informed reasoning. Conviction fills the informed-trader role with multi-source research at machine speed — and when AI MMs can price markets informed, the bar for a market to exist economically drops dramatically.

## How it works (the mechanism)

**Markets are assigned, not discovered.** A human (the "Spark") tells Conviction which market matters. For each assigned market, we spawn ONE dedicated expert agent that:

1. Has its own `./agents/<marketId>/AGENT.md` (system prompt with full market criteria)
2. Has its own `./agents/<marketId>/state.json` (cycle count, forecasts, trades, accumulated notes)
3. Runs every 90s **on that single market only — never switches**
4. Each cycle: **dispatches to 4 sub-specialists in parallel** (see below), aggregates their structured outputs, decides `trade` / `exit` / `hold`, writes new notes, saves state
5. Trades through the same Solana wallet as the other experts (capped at $5/trade, $50 total bankroll)
6. Self-improves through Skills (see below)

### Multi-agent dispatch — what happens inside one cycle

The expert is **not one Claude call**. Each cycle, it orchestrates 4 separate Claude sub-agents — each a focused call with its own system prompt — and aggregates their structured outputs into the final decision. See [`src/sub-agents.ts`](src/sub-agents.ts) for the code.

| Sub-agent | Model | Tools | Output |
|---|---|---|---|
| `resolution-analyst` | Haiku | none | Exact criteria · resolution source · deadline · ambiguities · edge cases |
| `evidence-gatherer` | Sonnet | Tavily search, read_url, X scrape | 4-8 signals with quotes and weights · net direction · fresh findings · confidence |
| `base-rate-historian` | Sonnet | none (training knowledge only) | Comparable past cases · base rate 0-1 · reasoning |
| `pricing-math` (aggregator) | Sonnet | none | Final probabilityYes · confidence · side · edgePct · action (trade/exit/hold) · citations |

`resolution-analyst` runs first (locks criteria). Then `evidence-gatherer` + `base-rate-historian` run **in parallel**. Then `pricing-math` aggregates all 3 outputs into the final decision. Each sub-agent's trace is logged separately to `expert-trail.jsonl` (search for `multi_agent_trace` events).

The point: **a dedicated expert on one market for 3 hours accumulates ~30 cumulative notes and refines its forecast cycle by cycle — backed by 4 specialists per cycle, each doing one focused job.** That's how human informed-trading teams operate. We just made it parallel and 24/7.

**Real example from the run**: On POLY-2268715 (Gemini 3.2 release), the `pricing-math` aggregator caught that the `base-rate-historian`'s prior (0.12) was outdated due to Sonnet's training cutoff (Gemini 3.x didn't exist when training data was assembled), overrode it with `evidence-gatherer`'s live confirmation that Gemini 3.1 had already shipped, and revised the forecast from NO 0.78 → YES 0.82. Two cycles later, the expert decided its existing NO position was directionally wrong and exited on-chain autonomously ([tx `RtxBTnUk…`](https://solscan.io/tx/RtxBTnUkXYZZ5vyKXvtQN89nJGywbssY5C9avCN2dBDvB47c2tcnnCxAggtb4vcCuhYTF3LGRgZphzfymLuNTEE)). That's **multi-agent meta-reasoning** — agents catching agents.

## Self-improvement (Anthropic Skills pattern)

Beyond the 4 hardcoded sub-specialists, **the expert can also spawn entirely new specialists on the fly** when it senses a domain gap. The mechanism: every 5 cycles, the orchestrator reads its own trail, asks itself *"what heuristic or sub-agent, if I had it, would have helped my last trades?"*, drafts a `SKILL.md`, runs it through a safety acceptor (Haiku), then promotes it to `/skills/active/` where every subsequent specialist call picks it up.

**Skills written by the agent during this run** (no human edits):

| Cycle | Skill | What it does |
|---|---|---|
| 5 | [`ai-benchmark-resolution-sourcing`](skills/active/ai-benchmark-resolution-sourcing/SKILL.md) | Identifies the official resolution leaderboard for AI benchmark markets; warns about third-party tracker discrepancies (Scale vs llm-stats vs Artificial Analysis). |
| 10 | [`multi-bracket-consistency`](skills/active/multi-bracket-consistency/SKILL.md) | For markets that are different brackets of the same underlying event (Starship launches, Tesla deliveries, FrontierMath thresholds): build ONE probability distribution across all brackets and price each from it. |

## Spark fork (same engine, different output)

The same research engine, pointed at a different output: a **capital allocation recommendation** for a startup decision instead of a trade. Drop it into any decision market on Spark idea coins or DAO treasuries — *"if we allocate $10k to channel A, is it capital-efficient?"* The agent answers with cited sources in 90 seconds.

See [`docs/startup-desk-demo.md`](docs/startup-desk-demo.md) for a live example output.

## Stack

- **Claude Agent SDK** — Sonnet 4.6 for evidence-gatherer / base-rate-historian / pricing-math sub-agents, Haiku 4.5 for resolution-analyst and skill acceptor
- **Multi-agent dispatch** — 4 sub-agents per market per cycle, dispatched in parallel where possible ([`src/sub-agents.ts`](src/sub-agents.ts))
- **Anthropic Skills** — filesystem-based capability modules, agent self-writes new ones, can spawn new specialists dynamically
- **Jupiter Prediction API** — Solana-native interface that brings Polymarket markets on-chain ([`dev.jup.ag`](https://dev.jup.ag/docs/guides/how-to-build-a-prediction-market-app-on-solana))
- **Solana mainnet** — BIP39 seed-derived wallet, $5 cap per trade, 40% drawdown stop
- **Helius RPC** — chain reads + tx broadcast
- **Tavily** — web search for the evidence-gatherer sub-agent
- **twitterapi.io** — X scrape (optional)
- **Hono** — minimal dashboard with SSE for live trail

## Repo layout

```
conviction/
├── README.md                          ← you are here
├── docs/
│   ├── architecture.html              ← visual schemas (open in browser)
│   ├── PRD.md                         ← product spec, goals, scope
│   ├── SPECIALISTS_PLAN.md            ← roadmap for additional specialists
│   ├── pitch-19h.md                   ← pitch slides for finals
│   ├── demo-guide-19h.md              ← live demo cheat sheet
│   ├── startup-desk-demo.md           ← Spark fork live test output
│   └── spec.md                        ← MVP build spec
├── research/
│   └── markets-survey.md              ← Polymarket/Kalshi company-outcome markets
├── src/
│   ├── experts.ts                     ← ★ main runtime — dedicated agent per market
│   ├── orchestrator.ts                ← legacy discovery-mode (deprecated)
│   ├── monitor.ts                     ← position monitor (exit + claim)
│   ├── summary.ts                     ← end-of-run recap
│   ├── lib/
│   │   ├── claude.ts                  ← Anthropic Messages API + tool loop
│   │   ├── jupiter.ts                 ← Jupiter Predict API wrapper
│   │   ├── wallet.ts                  ← BIP39 derivation + signAndSend
│   │   ├── kelly.ts                   ← fractional Kelly + safety caps
│   │   ├── skills.ts                  ← Skills loader + writer/promoter
│   │   ├── self-improve.ts            ← reflect + propose + accept
│   │   ├── research-tools.ts          ← Tavily / read_url / X scrape
│   │   └── env.ts                     ← .env loader (override fix)
│   ├── desks/
│   │   ├── public-markets.ts          ← Kelly-sized trade execution
│   │   └── startup.ts                 ← Spark-fork advisory output
│   └── specialists/
│       └── tech-company.ts            ← single-specialist (legacy orchestrator)
├── skills/
│   ├── active/                        ← 5 SKILL.md files (3 initial + 2 agent-written)
│   └── proposals/                     ← drafted by reflect, awaiting acceptor
├── agents/                            ← per-market expert state (.json + .md)
│   ├── POLY-1280315/                  ← FrontierMath 60% expert
│   ├── POLY-1280314/                  ← FrontierMath 50% expert
│   └── POLY-2268715/                  ← Gemini 3.2 May 19 expert
├── package.json                       ← Bun project
└── .env.example                       ← config template
```

## Run it yourself

```bash
bun install
cp .env.example .env
# fill in: ANTHROPIC_API_KEY, JUPITER_API_KEY, TAVILY_API_KEY,
#         SOLANA_SEED_PHRASE, SOLANA_RPC_URL,
#         ASSIGNED_MARKETS=POLY-X,POLY-Y,POLY-Z

bun run src/experts.ts        # main runtime — dedicated agents per assigned market
bun run src/monitor.ts        # parallel: position monitor + exit + claim
bun run src/dashboard/server.ts  # http://localhost:3000 (positions + skills + trail SSE)
bun run src/summary.ts        # end-of-run recap
```

## Tracks

Built primarily for the **Harness / Skills track** at Ralphthon — Anthropic Skills + claude-agent-sdk delegation is on-brand for the track.

Also targets **Impact track** — the Spark fork shows the same engine can advise any organization with a treasury making capital allocation decisions.

## License

MIT.

---

*Repo: [github.com/MathisSpark/conviction](https://github.com/MathisSpark/conviction) · Built with Claude Opus 4.7 + Sonnet 4.6 + Haiku 4.5.*
