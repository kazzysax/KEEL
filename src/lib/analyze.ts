import 'server-only';
// Analysis for any pair or trio: crypto and tokenized stocks/ETFs (Ondo, xStocks, bStocks).
// Same grade, same figures and same format as the curated pools; prices come live from Yahoo's public chart API.
import fs from 'node:fs'; import path from 'node:path';
import { gradeProposal, type Rules } from './grade';
import { computeMix, type History } from './mix';
import { previewData } from './pools';

export type Venue = { symbol: string; chain: string; address?: string };
export type Asset = { ticker: string; name: string; kind: 'stock' | 'etf' | 'crypto'; yahoo: string; venues: Record<string, Venue> };
let _u: Asset[] | null = null;
export const universe = (): Asset[] => _u ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'universe.json'), 'utf8')).assets;
export const assetOf = (t: string) => universe().find(a => a.ticker === t.toUpperCase().trim());
export function search(q: string, kind?: string, limit = 25) {
  const s = q.toUpperCase().trim();
  return universe().filter(a => (!kind || a.kind === kind) && (!s || a.ticker.startsWith(s) || a.name.toUpperCase().includes(s))).slice(0, limit);
}

const cache = new Map<string, { at: number; rows: Map<string, number> }>();
async function closes(a: Asset): Promise<Map<string, number>> {
  const hit = cache.get(a.ticker); if (hit && Date.now() - hit.at < 3600_000) return hit.rows;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(a.yahoo)}?period1=1577923200&period2=${Math.floor(Date.now() / 1000)}&interval=1d&events=div,splits`;
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, cache: 'no-store' });
  if (!r.ok) throw new Error(`No price history for ${a.ticker} right now`);
  const res = (await r.json()).chart?.result?.[0]; if (!res) throw new Error(`No price history for ${a.ticker}`);
  const q = res.indicators.quote[0].close as (number | null)[]; const adj = (res.indicators.adjclose?.[0]?.adjclose ?? q) as (number | null)[];
  const rows = new Map<string, number>();
  res.timestamp.forEach((t: number, i: number) => { const v = adj[i] ?? q[i]; if (v != null && v > 0) rows.set(new Date(t * 1000).toISOString().slice(0, 10), v); });
  cache.set(a.ticker, { at: Date.now(), rows }); return rows;
}

export type Analysis = ReturnType<typeof gradeProposal> & {
  assets: { ticker: string; name: string; kind: string; venues: Record<string, Venue>; lastPrice: number }[];
  weights: number[]; figures?: Omit<ReturnType<typeof computeMix>, 'series'>; series?: ReturnType<typeof computeMix>['series']; asOf?: string; days?: number;
  note: string;
};

export async function analyze(rawLegs: unknown, opts: { series?: boolean } = {}): Promise<Analysis> {
  const note = 'Analysis only. Equal weight, buy and hold, from past daily prices; not a prediction. Execution is up to the calling agent.';
  if (!Array.isArray(rawLegs) || rawLegs.some(l => typeof l !== 'string')) throw new Error('legs must be a list of tickers, for example ["BTC","NVDA"]');
  const legs = [...new Set(rawLegs.map(l => String(l).toUpperCase().trim()))];
  if (legs.length !== rawLegs.length) throw new Error('Each asset can appear once');
  if (legs.length < 2 || legs.length > 3) throw new Error('Use two or three assets');
  const assets = legs.map(l => assetOf(l)); const miss = legs.filter((_, i) => !assets[i]);
  if (miss.length) throw new Error(`Not supported: ${miss.join(', ')}. Search the universe first.`);
  const A = assets as Asset[];
  const rows = await Promise.all(A.map(closes));
  // common days: every leg must have a price (crypto trades daily, stocks do not, so stock days rule)
  const dates = [...rows[0].keys()].filter(d => rows.every(m => m.has(d))).sort();
  if (dates.length < 504) throw new Error(`Not enough shared price history (${dates.length} days, need about 2 years). A newer listing cannot be graded yet.`);
  const h: History = { dates, px: Object.fromEntries(A.map((a, i) => [a.ticker, dates.map(d => rows[i].get(d)!)])) };
  const base = previewData().rules as Rules;
  const rules: Rules = { ...base, assets: Object.fromEntries(A.map(a => [a.ticker, { label: a.name, group: a.kind === 'crypto' ? `crypto-${a.ticker}` : a.ticker, kind: a.kind === 'crypto' ? 'crypto' : 'stock' }])) };
  // Spot and tokenized-stock overlap guard: an index fund and its own big holdings double count.
  const g = gradeProposal(legs, h, rules, []);
  const checks = g.checks.map(c => c.name === 'Includes a company stock' ? { ...c, name: 'Includes a tokenized stock or fund', ok: A.some(a => a.kind !== 'crypto'), detail: 'At least one leg must be a tokenized stock or ETF (Ondo, xStocks or bStocks).' } : c.name === 'Tradable assets only' ? { ...c, detail: 'All assets are in the Keel universe (crypto, Ondo, xStocks, bStocks).' } : c);
  const m = computeMix(h, legs, legs.map(() => 1 / legs.length));
  const { series, ...figures } = m;
  const pass = checks.every(c => c.ok);
  return { ...g, checks, pass, assets: A.map(a => ({ ticker: a.ticker, name: a.name, kind: a.kind, venues: a.venues, lastPrice: h.px[a.ticker][dates.length - 1] })),
    weights: legs.map(() => 1 / legs.length), figures, ...(opts.series ? { series } : {}), asOf: dates[dates.length - 1], days: dates.length, note };
}

/** Rank partners for one asset: tries a short list of diversifiers and returns the best grades. */
const PARTNERS = ['BTC', 'ETH', 'SOL', 'GLD', 'IAU', 'TLT', 'IEF', 'SHY', 'SPY', 'QQQ', 'KO', 'JNJ', 'WMT', 'XOM', 'COST', 'LLY', 'NVDA', 'MSFT'];
export async function suggest(anchor: string, count = 5) {
  const a = assetOf(anchor); if (!a) throw new Error(`Not supported: ${anchor}`);
  const cands = PARTNERS.filter(p => p !== a.ticker && assetOf(p)).slice(0, 14);
  const out: { legs: string[]; score?: number; tier?: string; pass: boolean; why: string }[] = [];
  await Promise.all(cands.map(async p => {
    try { const r = await analyze([a.ticker, p]); out.push({ legs: r.legs, score: r.score, tier: r.tier, pass: r.pass, why: r.checks.filter(c => !c.ok).map(c => c.name).join('; ') || 'passes every check' }); } catch { /* skip */ }
  }));
  return out.sort((x, y) => (y.score ?? -1) - (x.score ?? -1)).slice(0, count);
}
