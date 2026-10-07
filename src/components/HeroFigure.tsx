import type { Pool } from '@/lib/types';
const COL = ['#f1481b', '#8a8982', '#2b5fd9'];
const dd = (xs: number[]) => { let peak = -Infinity, worst = 0; for (const v of xs) { peak = Math.max(peak, v); worst = Math.min(worst, v / peak - 1); } return worst; };
export function legDrawdowns(p: Pool) {
  const s = p.series ?? []; const col = (k: string) => s.map(r => r[k] as number);
  return { legs: p.legs.map(l => ({ l, dd: dd(col(l)) })), pool: dd(col('POOL')) };
}
// Server-rendered: real two-year series of one pool, legs thin, combined pool heavy.
export default function HeroFigure({ p, labels }: { p: Pool; labels: Record<string, string> }) {
  const s = p.series ?? []; const W = 620, H = 300, pl = 34, pr = 8, pt = 8, pb = 22; const keys = [...p.legs, 'POOL'];
  let lo = 1e9, hi = -1e9; for (const r of s) for (const k of keys) { lo = Math.min(lo, r[k] as number); hi = Math.max(hi, r[k] as number); }
  lo = Math.floor(lo / 20) * 20; hi = Math.ceil(hi / 20) * 20;
  const x = (i: number) => pl + (i / (s.length - 1)) * (W - pl - pr), y = (v: number) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const path = (k: string) => s.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[k] as number).toFixed(1)}`).join('');
  const d = legDrawdowns(p); const worstLeg = d.legs.reduce((a, b) => (b.dd < a.dd ? b : a)); const pct = (v: number) => (v * 100).toFixed(1) + '%';
  const ticks = Array.from({ length: (hi - lo) / 20 + 1 }, (_, i) => lo + i * 20);
  return (<figure className="fig" style={{ marginInline: 0 }}>
    <div className="cap mono"><span>Fig. 01 / Pool {p.id}, last two years</span><span>Start = 100</span></div>
    <div className="legend mono">{p.legs.map((l, i) => <span key={l}><i style={{ background: COL[i] }} />{labels[l]}</span>)}<span><i style={{ background: '#121212', height: 4 }} />Pool</span></div>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Two-year price lines for ${p.legs.map(l => labels[l]).join(', ')} and the combined pool`} style={{ display: 'block' }}>
      {ticks.map(t => <g key={t}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="rgba(18,18,18,.12)" /><text x={pl - 6} y={y(t) + 3} textAnchor="end" fontSize="9.5" fontFamily="JetBrains Mono Variable, monospace" fill="#6b6a65">{t}</text></g>)}
      <line x1={pl} x2={W - pr} y1={y(100)} y2={y(100)} stroke="#121212" strokeDasharray="3 3" opacity=".55" />
      {p.legs.map((l, i) => <path key={l} d={path(l)} fill="none" stroke={COL[i]} strokeWidth="1.25" opacity=".95" />)}
      <path d={path('POOL')} fill="none" stroke="#121212" strokeWidth="2.8" strokeLinejoin="round" />
      <text x={pl} y={H - 5} fontSize="9.5" fontFamily="JetBrains Mono Variable, monospace" fill="#6b6a65">{String(s[0]?.d).slice(0, 7)}</text>
      <text x={W - pr} y={H - 5} textAnchor="end" fontSize="9.5" fontFamily="JetBrains Mono Variable, monospace" fill="#6b6a65">{String(s[s.length - 1]?.d).slice(0, 7)}</text>
    </svg>
    <div className="figstats">
      <div className="hot"><div className="mono">Deepest fall, {labels[worstLeg.l]}</div><div className="n">{pct(worstLeg.dd)}</div></div>
      <div><div className="mono">Deepest fall, pool</div><div className="n">{pct(d.pool)}</div></div>
      <div><div className="mono">Pool over the period</div><div className="n">{((s[s.length - 1].POOL as number) - 100 >= 0 ? '+' : '') + ((s[s.length - 1].POOL as number) - 100).toFixed(0)}%</div></div>
    </div>
    <figcaption className="fignote mono">One pool picked as an example. Measured inside this two-year window; the full history since 2020 has deeper falls, shown on each pool below.</figcaption>
  </figure>);
}
