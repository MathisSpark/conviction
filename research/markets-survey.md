# Markets Survey — Company-Outcome PMs on Polymarket + Kalshi

> Compiled 2026-05-17 for Conviction agent design. Confirms the "informed trader for company outcomes" thesis has rich market substrate today.

## TL;DR

- **Tesla alone has 108 active markets, $24.5M cumulative volume.** NVIDIA has 107. AAPL/MSFT have full earnings + price ladders too.
- **7 distinct market categories** for company outcomes (see §2). Each maps to a clean research workflow for an agent specialist.
- **Token Launch category (Polymarket, 20+ markets) is the direct fork target** for Spark / MetaDAO startup launches — same structure ("Will <token> FDV cross $X 1 day after launch?") as what idea coins need.
- **Hackathon demo target: TSLA + NVDA + 1 EV macro market.** Liquid enough for $5-20 trades, resolution windows that fit a 3h live demo.

---

## 1. Confirmation : Mathis was right

> *"j'avais en tête les résultats de l'entreprise Tesla : est-ce qu'ils vont être positifs ou négatifs ? Je sais pas s'il y a un marché actuellement comme ça"*

**Yes — multiple Tesla earnings markets exist.**

Live Polymarket example (resolved on April 22, 2026):
- [Will Tesla (TSLA) beat quarterly earnings?](https://polymarket.com/event/tsla-quarterly-earnings-nongaap-eps-04-22-2026-0pt39) — resolved YES (non-GAAP EPS $0.41 vs $0.39 threshold).

Next Tesla earnings markets will spin up ahead of Q2 earnings (late July 2026). Same structure for NVDA, AAPL, MSFT (e.g., [Will Microsoft beat quarterly earnings?](https://polymarket.com/event/msft-quarterly-earnings-gaap-eps-04-29-2026-4pt05) — GAAP EPS > $4.05).

---

## 2. Market categories (each = a research workflow for the agent)

### 2.1 Stock price ladders (multi-outcome)
- **Format**: "What will TSLA hit in May 2026?" → ladder of price brackets (↑$450, ↑$435, …, ↓$405, …).
- **Examples**:
  - [TSLA May 2026](https://polymarket.com/event/what-price-will-tsla-hit-in-may-2026) — $194K vol, $33K liq, 15d to resolve.
  - [NVDA May 2026](https://polymarket.com/event/what-price-will-nvda-hit-in-may-2026) — $404K vol, $50K liq.
  - [AAPL May 2026](https://polymarket.com/event/what-price-will-aapl-hit-in-may-2026) — $125K vol, $31.5K liq.
- **Agent research needs**: implied volatility, historical price action, analyst consensus, recent guidance, macro context (Fed, rates).

### 2.2 Daily up/down + weekly close brackets
- **Format**: "TSLA Up or Down on May 18?" / "TSLA closes above $420 on May 18?" / "TSLA closes week of May 18 at ___?"
- **Examples**:
  - [TSLA Up/Down May 18](https://polymarket.com/event/tsla-up-or-down-on-may-18-2026) — $501 vol, 1d to resolve.
  - Same daily ladder for NVDA, AAPL, MSFT.
- **Agent research needs**: pre-market signals, news catalysts (earnings, product launches), sentiment X/Reddit, options flow.
- **Why this matters for demo**: 1-day resolution = PnL visible in the 3h hands-off window if we pick wisely.

### 2.3 Earnings beats / misses
- **Format**: "Will <ticker> beat quarterly earnings? (Non-GAAP/GAAP EPS > $X)"
- **Examples** (next cycle Q2 2026, late July):
  - TSLA, NVDA, AAPL, MSFT — all have recurring markets.
- **Agent research needs**: 10-Qs, guidance, consensus EPS, whisper numbers, channel checks, seasonal patterns.

### 2.4 Production / deliveries / KPI volumes
- **Format**: "How many Tesla deliveries in Q2 2026?" → bucket ladder (350k-375k / 375k-400k / 400k-425k / 425k+).
- **Examples**:
  - [Tesla deliveries Q2 2026](https://polymarket.com/event/how-many-tesla-deliveries-in-q2-2026) — $43.5K vol, $19.5K liq, 1mo to resolve.
  - Kalshi has parallel: [Tesla production Q1 2026](https://kalshi.com/markets/kxteslaprod/tesla-production/kxteslaprod-26-q1).
- **Agent research needs**: monthly production data (CN-Wire / Bloomberg), supply chain proxies (lithium, semis), regional registration data.

### 2.5 Corporate events / M&A / IPO
- **Format**: "Tesla and SpaceX merger officially announced by June 30?" / "SpaceX IPO by ___?"
- **Examples**:
  - [Tesla + SpaceX merger by June 30](https://polymarket.com/event/tesla-and-spacex-merger-officially-announced-by-june-30) — $280K vol, $51K liq, 8mo. Currently 1%.
  - [Tesla + xAI merger by June 30](https://polymarket.com/event/tesla-and-xai-merger-officially-announced-by-june-30) — $73.7K vol. Currently 3%.
  - [SpaceX IPO by date](https://polymarket.com/event/spacex-ipo-by) — $3M vol, $218K liq. $120K traded today. Currently 98% by Dec 31.
  - [SpaceX public ticker](https://polymarket.com/event/what-will-spacexs-public-ticker-be) — $6M vol.
- **Agent research needs**: regulatory filings (S-1, 8-K), executive interviews, banker leaks (FT/Reuters), corporate signaling.

### 2.6 Leadership changes
- **Format**: "Musk out as Tesla CEO before 2027?"
- **Example**: [Musk out as Tesla CEO before 2027](https://polymarket.com/event/musk-out-as-tesla-ceo-before-2027) — $14K vol, 7%.
- **Agent research needs**: board governance signals, comp packages, activist investor positioning, executive movements.

### 2.7 Product launches & pricing
- **Format**: "Will Tesla sell a Cybercab for $30k or less in 2026?"
- **Example**: [Cybercab ≤$30k in 2026](https://polymarket.com/event/will-tesla-sell-a-cybercab-for-30k-or-less-in-2026) — 72.5% No.
- **Agent research needs**: production cost teardowns, supplier margins, competitor pricing, regulatory deadlines.

### 2.8 (Bonus) Mention / tweet markets
- **Format**: "Elon Musk # tweets May 12-19?" → bucket ladder.
- **Example**: [Elon tweets May 12-19](https://polymarket.com/event/elon-musk-of-tweets-may-12-may-19) — **$9M vol, $1M today, $986K liq.** Highest-liquidity TSLA-adjacent market.
- **Agent research needs**: historical tweet velocity, Elon travel calendar, news catalysts likely to provoke posting.
- **Why useful**: very liquid + 3-7d resolution = perfect demo PnL window if our agent gets the velocity right.

---

## 3. Sector substrate beyond Tesla

### 3.1 Cars / EV
- [Polymarket Cars category](https://polymarket.com/predictions/cars) — **109 live markets**.
- Covers BYD vs Tesla market share, Cybertruck deliveries, Waymo expansion, regulatory (EU emissions, US tariffs).

### 3.2 Tech earnings (NVDA / AAPL / MSFT)
- Same structure as TSLA: price ladders + daily up/down + earnings beats.
- [NVDA category](https://polymarket.com/predictions/nvda) — 107 markets, higher liquidity overall.
- [Largest company end of June](https://polymarket.com/event/largest-company-end-of-june-712) — multi-outcome (NVDA vs MSFT vs AAPL).

### 3.3 IPOs
- [Polymarket IPOs category](https://polymarket.com/predictions/ipos) — SpaceX, Stripe, Databricks, etc.

### 3.4 Kalshi corporate
- [Kalshi Earnings](https://kalshi.com/category/mentions/earnings) — dedicated earnings markets.
- [Kalshi Companies](https://kalshi.com/category/companies) — leadership changes, corporate events, regulatory.

---

## 4. The fork direction → Spark / MetaDAO

**Polymarket already runs the exact pattern we need for tokenized startups.**

### 4.1 Token Launch markets (Polymarket, 20+ live)
- [Token Launch category](https://polymarket.com/predictions/token-launch).
- **Structure**: "Will <project> token FDV be above $X 1 day after launch?"
- **Example**:
  - [Genius FDV above ___ 1 day after launch](https://polymarket.com/event/genius-fdv-above-one-day-after-launch).
  - [Base FDV above ___ 1 day after launch](https://polymarket.com/event/base-fdv-above-one-day-after-launch).
  - [Will any 2026 coin end year above $20B FDV?](https://polymarket.com/event/will-a-coin-launched-in-2026-end-the-year-above-20b-fdv-398).
- [Launch category](https://polymarket.com/predictions/launch) — **265 live markets**, broader.

### 4.2 Direct analog for idea coins
Same agent that reads Tesla 10-Ks + supply chain → reads tokenomics + builder background + traction + competitive landscape for an idea coin launch.

**Forkable pipeline**:
```
Idea coin / MetaDAO proposal lands
  → Conviction agent classifies (DeFi infra / consumer / ai / etc.)
  → Dispatches specialist (same skill base as Tesla researcher, tools differ)
  → Pulls: founder X history, GitHub commit cadence, on-chain proxy markets,
           similar-launch comps (Pump.fun cohort, MetaDAO history)
  → Produces probability of "FDV > $X at T+24h"
  → Trades if conviction > threshold
```

The **PM trading on Polymarket Token Launch markets validates the engine today**, then the same engine plugs into MetaDAO PASS/FAIL or Spark idea coins tomorrow without rewriting the research stack.

---

## 5. Recommended demo targets (May 17, 3h hands-off, $50-100 bankroll)

Picked for: short resolution window during live demo + sufficient liquidity to take $5-20 positions without slippage.

| # | Market | Window | Liq | Why |
|---|---|---|---|---|
| 1 | [TSLA Up/Down May 18](https://polymarket.com/event/tsla-up-or-down-on-may-18-2026) | 1 day | $2.4K | Resolves Monday close — agent can take a real position tonight, judges see the bet on stage. |
| 2 | [Elon tweets May 16-18](https://polymarket.com/event/elon-musk-of-tweets-may-16-may-18) | 1 day | $228K | Highest-liquidity TSLA-adjacent; clean velocity signal the agent can model from recent history. |
| 3 | [Tesla deliveries Q2 2026](https://polymarket.com/event/how-many-tesla-deliveries-in-q2-2026) | ~1 month | $19.5K | Multi-outcome ladder — perfect to show *informed* edge from supply chain research vs random walk. |

**Backup macro angle**: [Largest company end of June](https://polymarket.com/event/largest-company-end-of-june-712) — multi-outcome NVDA vs MSFT vs AAPL — agent can run a comparative analysis on stage.

---

## 6. What the agent needs to research (per market)

| Market type | Sources to ingest |
|---|---|
| Stock price ladder | Yahoo Finance API · TradingView TA · X sentiment · options flow (Unusual Whales) |
| Daily up/down | Pre-market futures · overnight news · Asia-session trade |
| Earnings beat | 10-Q · consensus EPS (Zacks / Refinitiv) · whisper numbers · seasonal pattern |
| Production / KPI | Monthly delivery data · supply chain data (lithium, chips) · regional registrations |
| M&A / corporate | SEC EDGAR filings · FT / Reuters banker leaks · earnings call transcripts |
| Leadership | Board minutes · activist investor 13Ds · exec departures pattern |
| Tweets/mentions | Twitter API historical · time-of-day baseline · travel calendar of subject |
| Token launch | Project docs · founder X history · GitHub · pre-LBP curves · comp launches |

---

## 7. Next actions (for the build, not the survey)

1. Wrap Jupiter Predict API → confirm we can pull these markets via Jupiter and submit orders against them.
2. Pick the 3 demo markets from §5 → pre-cache research on each so the agent has context at 13:00.
3. Build the Tech/Company-outcome specialist around the §6 research stack (web_search + X + 10-K parsing).
4. Confirm Swig wallet can constrain to Jupiter Predict program only with max $20/trade.
