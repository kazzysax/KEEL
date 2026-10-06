'use client';
import { useEffect, useState } from 'react';
import type { Manifest, Pool } from '@/lib/types';
import Chart from './Chart'; import BuyPanel from './BuyPanel'; import OutlookCard from './OutlookCard';
const pct = (v: number, d = 1) => (v * 100).toFixed(d) + '%';
const KINDS = [['duo', 'Duos'], ['trio', 'Trios'], ['pair', 'Stock pairs']] as const;
export default function PoolBrowser({ man }: { man: Manifest }) {
  const [kind, setKind] = useState<'duo' | 'trio' | 'pair'>('duo'); const [open, setOpen] = useState<string | null>(null);
  const labels: Record<string, string> = Object.fromEntries(Object.entries(man.assets).map(([k, v]) => [k, v.label]));
  const short = (l: string) => l;
  return (<div>
    <div className="sh"><h2>The pools</h2><div className="tabs">{KINDS.map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setOpen(null); }}>{l} · {man.pools.filter(p => p.kind === k).length}</button>)}</div></div>
    <div>{man.pools.filter(p => p.kind === kind).map(p => <Row key={p.id} p={p} open={open === p.id} toggle={() => setOpen(open === p.id ? null : p.id)} labels={labels} short={short} />)}</div>
  </div>);
}
function Row({ p, open, toggle, labels, short }: { p: Pool; open: boolean; toggle: () => void; labels: Record<string, string>; short: (s: string) => string }) {
  const [full, setFull] = useState<Pool | null>(null);
  useEffect(() => { if (open && !full) fetch(`/data/pools/${p.id}.json`).then(r => r.json()).then(setFull); }, [open]); // eslint-disable-line
  const ys = Object.entries(p.years); const maxAbs = Math.max(...ys.map(([, v]) => Math.abs(v)), 0.01);
  return (<div className={'pool' + (open ? ' open' : '')}>
    <button className="prow" onClick={toggle} aria-expanded={open}>
      <span className="mono pid">{p.id}</span>
      <div><div className="pname">{p.legs.map(l => labels[l]).join(' + ')}</div><div className="legs mono">{p.legs.map(l => <span className="chip" key={l}>{short(l)}</span>)}</div></div>
      <div className="kv"><div className="k mono">Worst drawdown</div><div className="v neg">{pct(p.maxDD)}</div></div>
      <div className="kv"><div className="k mono">Avg / year</div><div className="v">{pct(p.avgYear)}</div></div>
      <div className="kv"><div className="k mono">Offset score</div><div className="v">{p.offset}<span style={{ fontSize: 14, color: 'var(--mute)' }}>/100</span></div></div>
      <span className="chev mono">▶</span>
    </button>
    {open && <div className="pbody">
      <div>
        <div className="figs">
          <div><div className="mono">Worst drawdown</div><div className="v" style={{ color: 'var(--acc)' }}>{pct(p.maxDD)}</div><div className="n">Biggest fall of the combined pool from a peak, Jan 2020 to today.</div></div>
          <div><div className="mono">Best year</div><div className="v">+{pct(p.bestYear, 0)}</div><div className="n">Strongest calendar-year return of the pool.</div></div>
          <div><div className="mono">Average / year</div><div className="v">+{pct(p.avgYear)}</div><div className="n">Compounded yearly growth over the whole period.</div></div>
          <div><div className="mono">Offset score</div><div className="v">{p.offset}</div><div className="n">On days one asset fell, how often the pool still held flat or rose. 100 = always.</div></div>
        </div>
        {full?.series ? <Chart series={full.series} legs={p.legs} labels={labels} /> : <div className="chartbox mono" style={{ height: 330, display: 'grid', placeItems: 'center', color: 'var(--mute)' }}>Loading chart…</div>}
        <div className="mono" style={{ margin: '22px 0 0', color: 'var(--mute)' }}>Pool return by calendar year</div>
        <div className="yrs">{ys.map(([y, v]) => <div className="yr" key={y}><span className="lab mono">{v >= 0 ? '+' : ''}{(v * 100).toFixed(0)}%</span><div className={'bar' + (v < 0 ? ' neg' : '')} style={{ height: `${(Math.abs(v) / maxAbs) * 60}%`, minHeight: 2 }} /><span className="lab mono">{y === '2026' ? '26*' : y.slice(2)}</span></div>)}</div>
        <div className="note mono" style={{ textTransform: 'none' }}>Rolling 12-month outcomes: 5th–95th percentile {pct(p.r12.p5, 0)} to +{pct(p.r12.p95, 0)} · worst {pct(p.r12.min, 0)} · best +{pct(p.r12.max, 0)} · positive in {pct(p.r12.pctPositive, 0)} of windows. Past results do not predict future ones. *2026 is year to date.</div>
        <OutlookCard legs={p.legs} labels={labels} />
      </div>
      <BuyPanel pool={p} labels={labels} />
    </div>}
  </div>);
}
