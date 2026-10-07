// Recompute a pool's figures for a custom split, in the browser, from daily closes (public/data/history.json).
// Same definitions as scripts/poolmath.py: buy and hold from the first day with the given starting weights, no rebalancing.
export type History = { dates: string[]; px: Record<string, number[]> };
export type Mix = {
  maxDD: number; avgYear: number; bestYear: number; worstYear: number; years: Record<string, number>; offset: number;
  r12: { p5: number; p50: number; p95: number; min: number; max: number; pctPositive: number };
  series: Record<string, number | string>[];
};
const q = (sorted: number[], p: number) => { const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }; // linear, like pandas
const roundHalfEven = (x: number) => { const f = Math.floor(x), d = x - f; return d < 0.5 ? f : d > 0.5 ? f + 1 : f % 2 === 0 ? f : f + 1; };

export function computeMix(h: History, legs: string[], w: number[]): Mix {
  const n = h.dates.length;
  const rel = legs.map(l => h.px[l].map(v => v / h.px[l][0]));
  const pool = Array.from({ length: n }, (_, t) => legs.reduce((s, _l, i) => s + w[i] * rel[i][t], 0));
  let peak = -Infinity, maxDD = 0; for (const v of pool) { peak = Math.max(peak, v); maxDD = Math.min(maxDD, v / peak - 1); }
  const years: Record<string, number> = {}; const ys = [...new Set(h.dates.map(d => d.slice(0, 4)))];
  for (const y of ys) {
    const idx = h.dates.map((d, i) => (d.startsWith(y) ? i : -1)).filter(i => i >= 0); const first = idx[0], last = idx[idx.length - 1];
    years[y] = pool[last] / (first > 0 ? pool[first - 1] : pool[first]) - 1;
  }
  const yr = Object.values(years); const days = (Date.parse(h.dates[n - 1]) - Date.parse(h.dates[0])) / 86400000;
  const avgYear = Math.pow(pool[n - 1], 365.25 / days) - 1;
  let down = 0, held = 0;
  for (let t = 1; t < n; t++) {
    if (legs.some((l, i) => h.px[l][t] / h.px[l][t - 1] < 1)) { down++; if (pool[t] / pool[t - 1] - 1 >= 0) held++; }
  }
  const r: number[] = []; for (let t = 252; t < n; t++) r.push(pool[t] / pool[t - 252] - 1);
  const s = [...r].sort((a, b) => a - b);
  const lastDate = new Date(h.dates[n - 1] + 'T00:00:00Z'); const cut = new Date(lastDate); cut.setUTCFullYear(cut.getUTCFullYear() - 2); const cutS = cut.toISOString().slice(0, 10);
  const start = h.dates.findIndex(d => d >= cutS);
  const series = h.dates.slice(start).map((d, k) => {
    const t = start + k; const row: Record<string, number | string> = { d }; let p = 0;
    legs.forEach((l, i) => { const v = (h.px[l][t] / h.px[l][start]) * 100; row[l] = Math.round(v * 100) / 100; p += w[i] * v; });
    row.POOL = Math.round(p * 100) / 100; return row;
  });
  return { maxDD, avgYear, bestYear: Math.max(...yr), worstYear: Math.min(...yr), years: Object.fromEntries(Object.entries(years).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4])),
    offset: down ? roundHalfEven((held / down) * 100) : 0,
    r12: { p5: q(s, .05), p50: q(s, .5), p95: q(s, .95), min: s[0], max: s[s.length - 1], pctPositive: r.filter(x => x > 0).length / r.length }, series };
}
