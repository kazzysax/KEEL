'use client';
import { useMemo, useState } from 'react';
const COLORS = ['#f1481b', '#6b6a65', '#2b5fd9'];
export default function Chart({ series, legs, labels }: { series: Record<string, number | string>[]; legs: string[]; labels: Record<string, string> }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760, H = 300, pl = 44, pr = 10, pt = 10, pb = 24;
  const keys = [...legs, 'POOL'];
  const { lo, hi } = useMemo(() => { let lo = 1e9, hi = -1e9; for (const r of series) for (const k of keys) { const v = r[k] as number; lo = Math.min(lo, v); hi = Math.max(hi, v); } return { lo: Math.floor(lo / 40) * 40, hi: Math.ceil(hi / 40) * 40 }; }, [series]); // eslint-disable-line
  const x = (i: number) => pl + (i / (series.length - 1)) * (W - pl - pr), y = (v: number) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const path = (k: string) => series.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[k] as number).toFixed(1)}`).join('');
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const months = series.map((r, i) => ({ i, d: String(r.d) })).filter((m, j, a) => j === 0 || m.d.slice(0, 7) !== a[j - 1].d.slice(0, 7)).filter(m => ['01', '07'].includes(m.d.slice(5, 7)));
  const h = hover != null ? series[hover] : null;
  return (<div className="chartbox">
    <div className="legend mono">{legs.map((l, i) => <span key={l}><i style={{ background: COLORS[i] }} />{labels[l]}</span>)}<span><i style={{ background: '#121212', height: 4 }} />Combined pool</span></div>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} onMouseLeave={() => setHover(null)}
      onMouseMove={e => { const b = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - b.left) / b.width) * W; setHover(Math.max(0, Math.min(series.length - 1, Math.round(((px - pl) / (W - pl - pr)) * (series.length - 1))))); }}>
      {ticks.map(t => <g key={t}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="rgba(18,18,18,.12)" /><text x={pl - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fontFamily="JetBrains Mono" fill="#6b6a65">{Math.round(t)}</text></g>)}
      <line x1={pl} x2={W - pr} y1={y(100)} y2={y(100)} stroke="#121212" strokeDasharray="3 3" opacity=".5" />
      {months.map(m => <text key={m.i} x={x(m.i)} y={H - 6} fontSize="10" fontFamily="JetBrains Mono" fill="#6b6a65">{m.d.slice(0, 7)}</text>)}
      {legs.map((l, i) => <path key={l} d={path(l)} fill="none" stroke={COLORS[i]} strokeWidth="1.4" opacity=".9" />)}
      <path d={path('POOL')} fill="none" stroke="#121212" strokeWidth="2.6" />
      {h && hover != null && <g><line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke="#121212" opacity=".4" />
        {keys.map((k, i) => <circle key={k} cx={x(hover)} cy={y(h[k] as number)} r="3.5" fill={k === 'POOL' ? '#121212' : COLORS[i]} />)}</g>}
    </svg>
    <div className="mono" style={{ minHeight: 18, color: '#121212', display: 'flex', gap: 14, flexWrap: 'wrap', padding: '4px 0 6px' }}>
      {h ? <><span>{String(h.d)}</span>{legs.map(l => <span key={l}>{l} {(h[l] as number).toFixed(0)}</span>)}<span style={{ color: '#f1481b' }}>POOL {(h.POOL as number).toFixed(0)}</span></> : <span style={{ color: '#6b6a65' }}>Rebased to 100 two years ago · hover for values</span>}
    </div>
  </div>);
}
