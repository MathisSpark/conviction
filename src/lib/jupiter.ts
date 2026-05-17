/**
 * Jupiter Prediction API wrapper.
 *
 * Docs: https://developers.jup.ag/docs/guides/how-to-build-a-prediction-market-app-on-solana
 * Auth: x-api-key header (get from developers.jup.ag/portal)
 *
 * Amount convention: 1,000,000 = $1.00 (USDC micro units).
 */

import type { Market, Position } from "../types.ts";

const BASE_URL = process.env.JUPITER_PREDICT_API_URL ?? "https://api.jup.ag/prediction/v1";
const API_KEY = process.env.JUPITER_API_KEY;
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function headers() {
  if (!API_KEY) throw new Error("JUPITER_API_KEY missing — get one at developers.jup.ag/portal");
  return { "x-api-key": API_KEY, "Content-Type": "application/json" };
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE_URL}${path}`, { headers: headers() });
  if (!r.ok) throw new Error(`Jupiter GET ${path} → ${r.status}: ${await r.text()}`);
  const json = (await r.json()) as any;
  return (json.data ?? json) as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Jupiter POST ${path} → ${r.status}: ${await r.text()}`);
  const json = (await r.json()) as any;
  return (json.data ?? json) as T;
}

export async function listEvents(opts?: { category?: string; includeMarkets?: boolean }) {
  const qs = new URLSearchParams();
  if (opts?.category) qs.set("category", opts.category);
  if (opts?.includeMarkets) qs.set("includeMarkets", "true");
  return get<any[]>(`/events?${qs.toString()}`);
}

export async function searchEvents(query: string, limit = 20) {
  const qs = new URLSearchParams({ query, limit: String(limit) });
  return get<any[]>(`/events/search?${qs.toString()}`);
}

export async function getEvent(eventId: string) {
  return get<any>(`/events/${eventId}`);
}

export async function getMarket(marketId: string): Promise<Market> {
  return get<Market>(`/markets/${marketId}`);
}

/**
 * Build an order. Returns an unsigned base64 transaction that must be
 * signed and broadcast by the wallet layer (Swig or hot wallet).
 */
export async function buildOrder(opts: {
  ownerPubkey: string;
  marketId: string;
  isYes: boolean;
  isBuy: boolean;
  depositUsd: number; // human-friendly dollars
  depositMint?: string;
}): Promise<{ transaction: string; contracts: number; feeUsd: number }> {
  const depositAmount = Math.round(opts.depositUsd * 1_000_000).toString();
  return post(`/orders`, {
    ownerPubkey: opts.ownerPubkey,
    marketId: opts.marketId,
    isYes: opts.isYes,
    isBuy: opts.isBuy,
    depositAmount,
    depositMint: opts.depositMint ?? USDC_MINT,
  });
}

export async function getPositions(ownerPubkey: string): Promise<Position[]> {
  const qs = new URLSearchParams({ ownerPubkey });
  return get<Position[]>(`/positions?${qs.toString()}`);
}

export async function closePosition(positionPubkey: string) {
  const r = await fetch(`${BASE_URL}/positions/${positionPubkey}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!r.ok) throw new Error(`Jupiter DELETE position → ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function claimWinnings(positionPubkey: string, ownerPubkey: string) {
  return post(`/positions/${positionPubkey}/claim`, { ownerPubkey });
}
