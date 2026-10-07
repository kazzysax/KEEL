export type Pool = {
  id: string; kind: 'duo' | 'trio' | 'pair'; legs: string[]; weights: number[]; name: string;
  maxDD: number; avgYear: number; bestYear: number; worstYear: number; years: Record<string, number>;
  offset: number; corr: number; ddToGrowth: number; spark?: number[];
  r12: { p5: number; p50: number; p95: number; min: number; max: number; pctPositive: number };
  series?: Record<string, number | string>[];
  // community pools only
  community?: boolean; rationale?: string; proposer?: Proposer; listedAt?: string; listedPrices?: Record<string, number>; priceAsOf?: string; grade?: Grade;
};
export type Proposer = { agent: string; agentId: string | null; mode: 'local' | 'on-chain'; jobId: string | null };
export type GradeWindow = { from: string; to: string; ret: number; maxDD: number };
export type Grade = { pass: boolean; checks: { name: string; ok: boolean; detail: string }[]; windows: { early: GradeWindow | null; recent: GradeWindow | null } };
export type Rejected = { legs: string[]; reasons: string[]; proposer: Proposer; at: string; rationale: string };
export type CommunityFile = { asOf: string; pools: Pool[]; rejected: Rejected[] };
export type Manifest = { asOf: string; from_: string; assets: Record<string, { group: string; kind: string; label: string; historySource: string; last?: number }>; pools: Pool[] };
export type TokenOption = { issuer: 'Ondo' | 'bStocks' | 'xStocks' | 'Tether'; symbol: string; address: string | null; decimals: number };
export type LegPlan = {
  asset: string; label: string; issuer: string; symbol: string; token: string | null;
  usd: number; quoteOut: string | null; minOut: string | null; impactPct: number | null;
  status: 'ok' | 'rejected' | 'unverified'; reason?: string; simulated: boolean; alternatives?: { issuer: string; costPerShare: number }[];
  rfq?: boolean;
};
export type Plan = { poolId: string; amountUsd: number; mode: 'live' | 'demo'; legs: LegPlan[]; allOk: boolean; createdAt: string };
