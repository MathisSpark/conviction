/**
 * Shared types for Conviction.
 *
 * The SpecialistOpinion shape is the contract between specialists and the
 * orchestrator — every specialist returns one of these for the orchestrator
 * to decide whether to act.
 */

export type Side = "YES" | "NO";

export type Market = {
  marketId: string;
  eventId: string;
  question: string;
  category: string;
  outcomes: { label: string; isYes: boolean; buyPrice: number; sellPrice: number }[];
  endsAt: string; // ISO timestamp
  volumeUsd: number;
  liquidityUsd: number;
};

export type SpecialistOpinion = {
  marketId: string;
  side: Side;
  probabilityYes: number; // 0.0 - 1.0 — the specialist's estimate
  confidence: number; // 0.0 - 1.0 — how sure of the estimate
  reasoning: string;
  sources: { url: string; weight: number; quote: string }[];
  recommendedSizePct: number; // % of bankroll, capped at MAX_BET_USD upstream
  caveats: string[];
};

export type Position = {
  positionPubkey: string;
  marketId: string;
  side: Side;
  contracts: number;
  costUsd: number;
  currentValueUsd: number;
  pnlUsd: number;
  claimable: boolean;
};

export type StartupDecision = {
  question: string;
  context: string;
  options: string[];
};

export type StartupRecommendation = {
  recommendation: string;
  reasoning: string;
  confidence: number;
  sources: { url: string; weight: number; quote: string }[];
  linkedTrade?: {
    marketId: string;
    side: Side;
    sizeUsd: number;
    rationale: string;
  };
};
