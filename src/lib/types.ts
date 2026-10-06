export type Pool = {
  id: string; kind: 'duo' | 'trio' | 'pair'; legs: string[]; weights: number[]; name: string;
  maxDD: number; avgYear: number; bestYear: number; worstYear: number; years: Record<string, number>;
  offset: number; corr: number; ddToGrowth: number;
  r12: { p5: number; p50: number; p95: number; min: number; max: number; pctPositive: number };
  series?: Record<string, number | string>[];
};
export type Manifest = { asOf: string; from_: string; assets: Record<string, { group: string; kind: string; label: string; historySource: string; last?: number }>; pools: Pool[] };
export type TokenOption = { issuer: 'Ondo' | 'bStocks' | 'xStocks' | 'Tether'; symbol: string; address: string | null; decimals: number };
export type LegPlan = {
  asset: string; label: string; issuer: string; symbol: string; token: string | null;
  usd: number; quoteOut: string | null; minOut: string | null; impactPct: number | null;
  status: 'ok' | 'rejected' | 'unverified'; reason?: string; simulated: boolean; alternatives?: { issuer: string; costPerShare: number }[];
  rfq?: boolean;
};
export type Plan = { poolId: string; amountUsd: number; mode: 'live' | 'demo'; legs: LegPlan[]; allOk: boolean; createdAt: string };
