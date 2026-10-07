// TypeScript port of scripts/poolmath.py grade(): lets the website (and any agent over HTTP) preview a proposal's grade for free.
// The Python Grader remains the source of truth for LISTING; a parity test compares every combination against it.
import { computeMix, type History } from './mix';

export type Rules = {
  assets: Record<string, { label: string; group: string; kind: string }>; ddToGrowthMax: number; listMinScore: number; tierA: number;
  heldUp: { since: string; maxFallRatio: number }; earlyEnd: string; parts: { name: string; weight: number; poor: number; great: number; what: string }[]; legs: { min: number; max: number };
};
export type Check = { name: string; ok: boolean; detail: string };
export type Window = { from: string; to: string; ret: number; maxDD: number } | null;
export type Graded = {
  legs: string[]; pass: boolean; checks: Check[]; score?: number; tier?: 'A' | 'B' | 'C'; parts?: { name: string; weight: number; value: number; points: number; what: string }[];
  stats?: { maxDD: number; avgYear: number; bestYear: number; offset: number; ddToGrowth: number; pctPositive: number }; windows?: { early: Window; recent: Window };
};

export function structuralChecks(legs: string[], rules: Rules): Check[] {
  const A = rules.assets; const uniq = [...new Set(legs)]; const out: Check[] = []; const add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail });
  const unknown = uniq.filter(l => !(l in A));
  add('Tradable assets only', unknown.length === 0, unknown.length ? `Not in the tradable list: ${unknown.join(', ')}.` : 'All assets are tradable on BSC as Ondo tokens.');
  add('Two or three different assets', uniq.length === legs.length && legs.length >= rules.legs.min && legs.length <= rules.legs.max, uniq.length === legs.length ? `${legs.length} assets proposed.` : 'An asset appears more than once.');
  const known = uniq.filter(l => l in A);
  add('Includes a company stock', known.some(l => A[l].kind === 'stock'), 'At least one company stock is required.');
  const groups = known.map(l => A[l].group);
  add('Different sectors', new Set(groups).size === groups.length, 'No two assets from the same group (for example two tech stocks, or two bond funds).');
  const ks = new Set(known); const overlap = (ks.has('SPY') && ks.has('QQQ')) || (ks.has('QQQ') && (ks.has('AAPL') || ks.has('MSFT')));
  add('No overlapping holdings', !overlap, 'An index fund and its own biggest holdings count the same exposure twice.');
  return out;
}

function windowStats(dates: string[], pool: number[], a: string | null, b: string | null): Window {
  const idx = dates.map((d, i) => (((!a || d >= a) && (!b || d <= b)) ? i : -1)).filter(i => i >= 0);
  if (idx.length < 30) return null;
  const s = idx.map(i => pool[i] / pool[idx[0]]); let peak = -Infinity, dd = 0; for (const v of s) { peak = Math.max(peak, v); dd = Math.min(dd, v / peak - 1); }
  return { from: dates[idx[0]], to: dates[idx[idx.length - 1]], ret: s[s.length - 1] - 1, maxDD: dd };
}
const scale = (x: number, poor: number, great: number) => Math.min(1, Math.max(0, (x - poor) / (great - poor)));
// Python's round(): correctly rounded, exact ties go to the even digit (JS Math.round / toFixed send ties up).
const r1 = (x: number) => { if (Number.isInteger(x * 4) && !Number.isInteger(x * 2)) { const f = Math.floor(x * 10); return (f % 2 === 0 ? f : f + 1) / 10; } return Number(x.toFixed(1)); };
const r0 = (x: number) => { const f = Math.floor(x); return x - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(x); };

export function gradeProposal(rawLegs: unknown, h: History, rules: Rules, taken: string[][] = []): Graded {
  if (!Array.isArray(rawLegs) || !rawLegs.every(l => typeof l === 'string'))
    return { legs: [], pass: false, checks: [{ name: 'Well-formed proposal', ok: false, detail: 'Proposal must contain a list of tickers (text).' }] };
  const legs = rawLegs.slice(0, 10).map(l => l.toUpperCase().trim().slice(0, 12));
  const checks = structuralChecks(legs, rules);
  const dup = taken.some(t => t.length === legs.length && t.every(x => legs.includes(x)));
  checks.push({ name: 'Not already listed', ok: !dup, detail: dup ? 'A pool with these assets already exists.' : 'New combination.' });
  if (!checks.slice(0, 5).every(c => c.ok)) return { legs, pass: false, checks };
  const m = computeMix(h, legs, legs.map(() => 1 / legs.length));
  const ddg = m.avgYear > 0 ? Math.abs(m.maxDD) / m.avgYear : Infinity; const ddgV = Number.isFinite(ddg) ? ddg : 99;
  checks.push({ name: 'Fall is small next to growth', ok: ddg <= rules.ddToGrowthMax, detail: Number.isFinite(ddg) ? `Worst drawdown is ${ddg.toFixed(2)}x the average yearly growth (limit ${rules.ddToGrowthMax}x).` : 'Average yearly growth is not positive.' });
  const n = h.dates.length; const pool = Array.from({ length: n }, (_, t) => legs.reduce((s, l) => s + h.px[l][t] / h.px[l][0] / legs.length, 0));
  const early = windowStats(h.dates, pool, null, rules.earlyEnd); const recent = windowStats(h.dates, pool, rules.heldUp.since, null);
  const heldOk = !!recent && recent.ret > 0 && Math.abs(recent.maxDD) <= rules.heldUp.maxFallRatio * Math.abs(m.maxDD);
  checks.push({ name: 'Held up lately', ok: heldOk, detail: recent ? `Since Jan 2025: ${(recent.ret * 100).toFixed(0).replace(/^(\d)/, '+$1')}% return, worst fall ${(recent.maxDD * 100).toFixed(0)}% (must be positive, and no deeper than ${rules.heldUp.maxFallRatio}x the full-period fall).` : 'Not enough recent data.' });
  const vals = [ddgV, m.offset, m.r12.pctPositive, recent ? Math.abs(recent.maxDD) : 0.30];
  const parts = rules.parts.map((p, i) => ({ name: p.name, weight: p.weight, value: Math.round(vals[i] * 1000) / 1000, points: r1(p.weight * scale(vals[i], p.poor, p.great)), what: p.what }));
  const score = r0(parts.reduce((s, p) => s + p.points, 0)); const tier = score >= rules.tierA ? 'A' : score >= rules.listMinScore ? 'B' : 'C';
  checks.push({ name: 'Keel score', ok: score >= rules.listMinScore, detail: `${score} out of 100 (tier ${tier}); at least ${rules.listMinScore} is needed to be listed.` });
  return { legs, pass: checks.every(c => c.ok), checks, score, tier, parts, windows: { early, recent },
    stats: { maxDD: m.maxDD, avgYear: m.avgYear, bestYear: m.bestYear, offset: m.offset, ddToGrowth: ddgV, pctPositive: m.r12.pctPositive } };
}
