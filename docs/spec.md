# Conviction — Build Spec (v0, hackathon MVP)

> Locks the 2h30 build (10:30 → 13:00) before the 13:00 submission cut. Edited live as we discover constraints.

## 1. North star (one line)

**Conviction is an AI agent that earns alpha on public prediction markets — and applies the same engine to startup decisions.**

## 2. Hackathon tracks targeted

- **Primary**: Harness / Skills (Anthropic Skills + delegated subagents).
- **Secondary**: Impact (startup decisions for tokenized ventures).

## 3. MVP scope (what ships at 13:00)

### 3.1 Components in scope

| Component | Status target | Notes |
|---|---|---|
| Orchestrator agent (Claude Opus) | ✓ functional | scans markets every 60s, classifies, dispatches |
| Tech / company-outcome specialist (Sonnet) | ✓ functional | web_search + X scrape + price/news |
| Jupiter Predict API wrapper | ✓ read + write | list markets, place_bet, get_positions |
| Swig wallet | ✓ funded | $100 USDC, scoped to Jupiter Predict program, max $20/trade |
| Public Markets Desk | ✓ live trades | Kelly-sized bets on pre-selected markets |
| Startup Desk endpoint | ✓ stub | accepts decision input, returns reco + linked PM trade |
| Live dashboard | ✓ minimal | positions + reasoning trace streaming |

### 3.2 Components OUT of scope for MVP

- Talent / GTM / Macro specialists (post-13:00 if lobster mode allows)
- MetaDAO native integration (Startup Desk runs on synthetic decisions for v0)
- Telegram / Discord scraping subagents (X + news only for v0)
- Skill auto-discovery / Voyager-style growing library

## 4. Pre-canned demo markets

Selected from `research/markets-survey.md` §5:

1. **TSLA Up/Down May 18** ([link](https://polymarket.com/event/tsla-up-or-down-on-may-18-2026)) — 1d resolution, $2.4K liq, resolves Monday close.
2. **Elon tweets May 16-18** ([link](https://polymarket.com/event/elon-musk-of-tweets-may-16-may-18)) — 1d resolution, $228K liq, very liquid.
3. **Tesla deliveries Q2 2026** ([link](https://polymarket.com/event/how-many-tesla-deliveries-in-q2-2026)) — ~1mo resolution, $19.5K liq, multi-outcome ladder.

The agent pre-caches research context on each before 13:00 (10-K data, recent X feed, supply chain signals).

## 5. Specialist contract (uniform interface)

Every specialist returns:

```typescript
type SpecialistOpinion = {
  market_id: string;
  probability_yes: number;     // 0.0 - 1.0
  confidence: number;           // 0.0 - 1.0
  reasoning: string;            // structured trace
  sources: { url: string; weight: number; quote: string }[];
  recommended_size_pct: number; // % of bankroll, capped at 5%
  caveats: string[];
};
```

Orchestrator collects opinions, computes Kelly size capped by Swig limits, executes via Jupiter Predict.

## 6. Demo flow (3h hands-off + finals)

### 6.1 During hands-off (13:00 → 16:00)

- Bot runs autonomously. Polls markets every 60s, places trades when conviction crosses threshold.
- Dashboard public-visible: PnL chart + reasoning trace stream.
- Lobster windows (14:00-16:00): patch only if bot is stuck.

### 6.2 Finals (19:00 if top 5)

5 min slot:
1. (30s) Problem: 92% of PM traders lose money — markets lack informed reasoning at machine scale.
2. (60s) What: Conviction = orchestrator + specialist subagents on Anthropic SDK + Skills.
3. (90s) Live: open the dashboard, show today's PnL + 1 reasoning trace from a real trade taken during the hands-off window.
4. (90s) Bigger picture: same engine plugs into MetaDAO PASS/FAIL or Spark idea coin decisions (show `forkable` slide).
5. (30s) Ask: "We want to ship this past Sunday — talk to us at the door."

## 7. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Jupiter Predict API rate limits / auth surprises | Test with read-only call by 11:00; if blocked, fall back to direct Polymarket CLOB (Python `py_clob_client_v2`) |
| Swig setup blocks > 30 min | Fall back: hot wallet with manual confirmation + agent posts "would have bet" entries |
| Bot loses all $100 in 30 min | Per-trade cap $20 + max 3 trades per market + auto-pause if drawdown > 50% |
| Reasoning trace not visible enough for judges | Pre-record fallback video of a clean trade decision |
| Internet flakes during hands-off | Local SQLite cache of last-good market state; bot keeps logging even if RPC down |

## 8. Open questions

- (after first push) Repo visibility — public for judges, or private until we're happy?
- (before 11:30) Real money split: all $100 at orchestrator, or $25 per specialist's "tracked bankroll"?
- (before 16:00) Do we open mic for judges at the Startup Desk during finals, or keep it pre-canned?
