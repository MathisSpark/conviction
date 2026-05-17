# Conviction

> AI agents that trade prediction markets with informed conviction — and apply the same engine to startup decisions.

Built at Ralphthon @ Singapore — May 17, 2026.

## What it does

Conviction runs an orchestrator agent (Claude Opus) that owns a constrained Solana wallet and dispatches specialist subagents to research markets, produce probability estimates, and execute trades on Jupiter Predict (Polymarket + Kalshi unified).

The same engine has two outputs:

1. **Public markets desk** — places real-money trades on Polymarket / Kalshi via Jupiter Predict. Visible PnL = trust signal for the engine.
2. **Startup decisions desk** — answers structured decisions for tokenized startups (idea coins / MetaDAO proposals). Each recommendation comes with a linked PM trade (skin in the game).

## Why

Most PMs/DMs lack informed traders. Today, ~92% of Polymarket wallets lose money — wins are mostly arbitrage bots, not informed reasoning. Conviction fills the informed-trader role with multi-source research at machine speed.

The Polymarket PnL proves the engine has alpha. The startup decision desk is the product.

## Architecture

```
                ┌────────────────────────────────────────┐
                │  CONVICTION ORCHESTRATOR (Claude Opus) │
                │  Owns Swig wallet · Logs reasoning     │
                └──┬──────────────────────────────────┬──┘
                   │                                  │
        ┌──────────▼──────────┐         ┌─────────────▼────────┐
        │  PUBLIC MARKETS     │         │  STARTUP DESK        │
        │  (live PnL demo)    │◄────────┤  (live advisory)     │
        │  Jupiter Predict    │  link   │  Decisions:          │
        │  Polymarket markets │  trade  │  • Feature to ship   │
        │  Real $50-100       │ ───────►│  • Hire A vs B       │
        └──────────┬──────────┘         │  • Marketing channel │
                   │                    │  • Capital allocation│
                   │                    └──────────┬───────────┘
                   └──────────────┬────────────────┘
                                  ▼
                       SHARED RESEARCH SUBAGENTS
                ┌──────────────────────────────────────┐
                │ • Tech / company-outcome specialist  │
                │ • Talent / hiring specialist         │
                │ • GTM / marketing specialist         │
                │ • Macro / industry specialist        │
                └──────────────────────────────────────┘
```

## Stack

- **Anthropic Agent SDK** + **Claude Skills** for orchestration + specialists.
- **Jupiter Predict API** for unified Polymarket + Kalshi access on Solana.
- **Swig** for programmable smart wallets (session-based permissions, max-bet caps, program whitelisting).
- **MetaDAO** (future) for the DM fork on startup proposals.

## Repo layout

```
conviction/
├── README.md
├── research/
│   └── markets-survey.md     # Polymarket + Kalshi company-outcome markets
├── src/                       # agent code (TBD)
└── docs/                      # spec, demo flow, slides
```

## Tracks

Built for the **Harness / Skills track** primarily (Anthropic Skills + claude-agent-sdk delegation is on-brand) and **Impact track** secondarily (startup decisions = real-world utility).

## License

MIT.
