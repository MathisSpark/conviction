/**
 * Kelly criterion + safety caps.
 *
 * Given the specialist's probability estimate and the market price,
 * compute the bet size as a fraction of bankroll. Apply caps: max bet
 * USD, fractional Kelly (1/4) for safety, and conviction floor.
 */

const FRACTIONAL_KELLY = 0.25;
const MIN_BET_USD = Number(process.env.MIN_BET_USD ?? 5); // Jupiter Predict floor

export type KellyInput = {
  probabilityEstimated: number; // specialist's probability of YES
  marketPriceYes: number; // market's current price of YES (0-1)
  bankrollUsd: number;
  maxBetUsd: number;
  confidence: number; // 0-1
  convictionThreshold?: number; // min edge to bet (default 5%)
};

export type KellySize = {
  betUsd: number;
  side: "YES" | "NO";
  edgePct: number;
  rationale: string;
};

export function kellySize(input: KellyInput): KellySize {
  const threshold = input.convictionThreshold ?? 0.05;
  const p = input.probabilityEstimated;
  const yesPrice = input.marketPriceYes;
  const noPrice = 1 - yesPrice;

  // Edge from buying YES at yesPrice: expected return = p - yesPrice
  const yesEdge = p - yesPrice;
  const noEdge = (1 - p) - noPrice;

  const side: "YES" | "NO" = yesEdge >= noEdge ? "YES" : "NO";
  const edge = Math.max(yesEdge, noEdge);
  const price = side === "YES" ? yesPrice : noPrice;

  if (edge < threshold) {
    return { betUsd: 0, side, edgePct: edge, rationale: `Edge ${(edge * 100).toFixed(1)}% below threshold ${(threshold * 100).toFixed(0)}%` };
  }

  // Kelly fraction for binary outcome: f* = (b*p - q) / b where b = (1-price)/price
  const pSide = side === "YES" ? p : 1 - p;
  const b = (1 - price) / price;
  const q = 1 - pSide;
  const fullKelly = (b * pSide - q) / b;
  const fractional = Math.max(0, fullKelly * FRACTIONAL_KELLY * input.confidence);
  const rawBet = fractional * input.bankrollUsd;
  const cappedBet = Math.min(rawBet, input.maxBetUsd);

  // Jupiter Predict floor: orders below MIN_BET_USD are rejected.
  // If Kelly says "bet something" but smaller than the floor, round UP to
  // the floor (slightly over-Kelly, but capped at MAX_BET_USD anyway).
  const finalBet = cappedBet > 0 && cappedBet < MIN_BET_USD
    ? Math.min(MIN_BET_USD, input.maxBetUsd)
    : cappedBet;

  return {
    betUsd: Math.max(0, finalBet),
    side,
    edgePct: edge,
    rationale: `Edge ${(edge * 100).toFixed(1)}% · Kelly ${(fullKelly * 100).toFixed(1)}% · 1/4 Kelly × conf ${(input.confidence * 100).toFixed(0)}% → raw $${cappedBet.toFixed(2)} → final $${finalBet.toFixed(2)} (Jupiter min $${MIN_BET_USD})`,
  };
}
