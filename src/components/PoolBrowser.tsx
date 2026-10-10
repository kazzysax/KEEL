'use client';
import { useEffect, useMemo, useState } from 'react';
import { computeMix, type History } from '@/lib/mix';
import SplitControl from './SplitControl';
import type { Manifest, Pool, CommunityFile } from '@/lib/types';
import Chart from './Chart'; import OutlookCard from './OutlookCard';
const pct = (v: number, d = 1) => (v * 100).toFixed(d) + '%';
const KINDS = [['duo', 'Duos'], ['trio', 'Trios'], ['pair', 'Stock pairs']] as const;
type Tab = 'duo' | 'trio' | 'pair' | 'community';
export default function PoolBrowser({ man }: { man: Manifest }) {
  const [kind, setKind] = useState<Tab>('duo'); const [open, setOpen] = useState<string | null>(null);
  const [com, setCom] = useState<CommunityFile | null>(null);
  useEffect(() => { fetch('/data/community/pools.json').then(r => (r.ok ? r.json() : null)).then(j => setCom(j && Array.isArray(j.pools) ? j : null)).catch(() => setCom(null)); }, []);
  const cPools = [...(com?.pools ?? [])].sort((a, b) => (b.grade?.score ?? 0) - (a.grade?.score ?? 0)); const rejected = com?.rejected ?? [];
  const labels: Record<string, string> = Object.fromEntries(Object.entries(man.assets).map(([k, v]) => [k, v.label]));
  const short = (l: string) => l;
  return (<div>
    <div className="sh"><h2>The pools</h2><div className="tabs">{KINDS.map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setOpen(null); }}>{l} · {man.pools.filter(p => p.kind === k).length}</button>)}<button className={kind === 'community' ? 'on' : ''} onClick={() => { setKind('community'); setOpen(null); }}>Community · {cPools.length}</button></div></div>
    {kind === 'community' ? <>
      <div className="note" style={{ margin: '0 0 14px' }}>Community pools are proposed by outside agents. Keel grades them; it does not endorse them.</div>
      {cPools.length === 0 ? <div className="note" style={{ border: '1px solid var(--line)', padding: '28px 18px', margin: 0, textAlign: 'center' }}>No community pools have passed grading yet. Check back after the next run.</div>
        : <div>{cPools.map(p => <Row key={p.id} p={p} open={open === p.id} toggle={() => setOpen(open === p.id ? null : p.id)} labels={labels} short={short} />)}</div>}
      {rejected.length > 0 && <details className="rej"><summary className="mono">Recently rejected · {rejected.length}</summary>
        {rejected.map((r, i) => <div className="rejrow" key={i}>
          <b>{r.legs.map(l => labels[l] ?? l).join(' + ')}</b>
          <div className="mono" style={{ color: 'var(--mute)', textTransform: 'none', margin: '4px 0' }}>Proposed by {r.proposer.agent} · {r.at.slice(0, 10)}</div>
          <ul>{r.reasons.map((x, j) => <li key={j}>{x}</li>)}</ul>
        </div>)}
      </details>}
    </> : <div>{man.pools.filter(p => p.kind === kind).map(p => <Row key={p.id} p={p} open={open === p.id} toggle={() => setOpen(open === p.id ? null : p.id)} labels={labels} short={short} />)}</div>}
  </div>);
}
function Row({ p, open, toggle, labels, short }: { p: Pool; open: boolean; toggle: () => void; labels: Record<string, string>; short: (s: string) => string }) {
  const [full, setFull] = useState<Pool | null>(null);
  useEffect(() => { if (open && !full) fetch(p.community ? `/data/community/pools/${p.id}.json` : `/data/pools/${p.id}.json`).then(r => r.json()).then(setFull); }, [open]); // eslint-disable-line
  const [split, setSplit] = useState<number[]>(p.legs.map(() => 100 / p.legs.length)); const [hist, setHist] = useState<History | null>(null);
  const custom = split.some(x => Math.abs(x - 100 / p.legs.length) > 0.6);
  useEffect(() => { if (custom && !hist) fetch('/data/history.json').then(r => r.json()).then(setHist).catch(() => {}); }, [custom]); // eslint-disable-line
  const mix = useMemo(() => (custom && hist ? computeMix(hist, p.legs, split.map(x => x / 100)) : null), [custom, hist, split.join()]); // eslint-disable-line
  const m = mix ?? p; const series = mix ? mix.series : full?.series;
  const ys = Object.entries(m.years); const maxAbs = Math.max(...ys.map(([, v]) => Math.abs(v)), 0.01);
  return (<div className={'pool' + (open ? ' open' : '')}>
    <button className="prow" onClick={toggle} aria-expanded={open}>
      <span className="mono pid">{p.id}</span>
      <div><div className="pname">{p.legs.map(l => labels[l]).join(' + ')}</div><div className="legs mono">{p.legs.map(l => <span className="chip" key={l}>{short(l)}</span>)}{p.community && <span className="chip comm">Community{p.proposer ? ` · ${p.proposer.agent}` : ''}</span>}{p.grade?.score != null && <span className="chip comm">Keel score {p.grade.score} · tier {p.grade.tier}</span>}</div></div>
      <Spark v={p.spark ?? []} />
      <div className="kv"><div className="k mono">Worst drawdown</div><div className="v neg">{pct(p.maxDD)}</div></div>
      <div className="kv"><div className="k mono">Avg / year</div><div className="v">{pct(p.avgYear)}</div></div>
      <div className="kv"><div className="k mono">Offset score</div><div className="v">{p.offset}<span style={{ fontSize: 13, opacity: .6 }}> /100</span></div><div className="meter"><i style={{ width: `${p.offset}%` }} /></div></div>
      <span className="chev mono">▶</span>
    </button>
    {open && <div className="pbody">
      <div>
        <SplitControl legs={p.legs} labels={labels} pct={split} onChange={setSplit} custom={custom} />
        {custom && !mix && <div className="note">Loading price history…</div>}
        <div className="figs">
          <div><div className="mono">Worst drawdown</div><div className="v" style={{ color: 'var(--acc)' }}>{pct(m.maxDD)}</div><div className="n">Biggest fall of the combined pool from a peak, Jan 2020 to today.</div></div>
          <div><div className="mono">Best year</div><div className="v">+{pct(m.bestYear, 0)}</div><div className="n">Strongest calendar-year return of the pool.</div></div>
          <div><div className="mono">Average / year</div><div className="v">+{pct(m.avgYear)}</div><div className="n">Compounded yearly growth over the whole period.</div></div>
          <div><div className="mono">Offset score</div><div className="v">{m.offset}</div><div className="n">On days one asset fell, how often the pool still held flat or rose. 100 = always.</div></div>
        </div>
        {series ? <Chart series={series} legs={p.legs} labels={labels} /> : <div className="chartbox mono" style={{ height: 330, display: 'grid', placeItems: 'center', color: 'var(--mute)' }}>Loading chart…</div>}
        <div className="mono" style={{ margin: '22px 0 0', color: 'var(--mute)' }}>Pool return by calendar year</div>
        <div className="yrs">{ys.map(([y, v]) => <div className="yr" key={y}><span className="lab mono">{v >= 0 ? '+' : ''}{(v * 100).toFixed(0)}%</span><div className={'bar' + (v < 0 ? ' neg' : '')} style={{ height: `${(Math.abs(v) / maxAbs) * 60}%`, minHeight: 2 }} /><span className="lab mono">{y === '2026' ? '26*' : y.slice(2)}</span></div>)}</div>
        <div className="note mono" style={{ textTransform: 'none' }}>Rolling 12-month outcomes: 5th–95th percentile {pct(m.r12.p5, 0)} to +{pct(m.r12.p95, 0)} · worst {pct(m.r12.min, 0)} · best +{pct(m.r12.max, 0)} · positive in {pct(m.r12.pctPositive, 0)} of windows. Past results do not predict future ones. *2026 is year to date.</div>
        {p.community && p.grade && <GradeBlock p={p} />}
        <OutlookCard legs={p.legs} labels={labels} />
      </div>
    </div>}
  </div>);
}

function Spark({ v }: { v: number[] }) {
  if (v.length < 2) return <span />;
  const W = 132, H = 34, lo = Math.min(...v), hi = Math.max(...v);
  const d = v.map((n, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * W).toFixed(1)},${(2 + (1 - (n - lo) / (hi - lo || 1)) * (H - 4)).toFixed(1)}`).join('');
  return <svg className="spark" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true"><path d={d} fill="none" stroke="#121212" strokeWidth="1.5" /></svg>;
}

function GradeBlock({ p }: { p: Pool }) {
  const g = p.grade!; const pr = p.proposer; const w = g.windows;
  const win = (label: string, x: typeof w.early) => <div><div className="mono">{label}</div>{x ? <><div className="v">{x.ret >= 0 ? '+' : ''}{pct(x.ret, 0)}</div><div className="n">Pool return, {x.from} to {x.to}.</div><div className="v neg" style={{ fontSize: 22 }}>{pct(x.maxDD)}</div><div className="n">Worst drawdown in this period.</div></> : <div className="n">Not enough history.</div>}</div>;
  return (<div className="grade">
    <div className="mono" style={{ color: 'var(--mute)', marginBottom: 10 }}>Keel grade</div>
    {g.score != null && <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}><span className="v" style={{ fontSize: 44, lineHeight: 1 }}>{g.score}</span><span className="mono">/100 · tier {g.tier}{g.tier === 'A' ? ' (top)' : ''}</span></div>
      <table className="plan" style={{ marginTop: 10 }}><thead><tr className="mono"><th>Part</th><th>Value</th><th>Points</th></tr></thead><tbody>{(g.parts ?? []).map(x => <tr key={x.name}><td><b>{x.name}</b><div className="note" style={{ margin: 0 }}>{x.what}</div></td><td className="mono">{x.name === 'Offset score' ? x.value : x.name === 'Fall vs growth' ? x.value.toFixed(2) + 'x' : (x.value * 100).toFixed(0) + '%'}</td><td className="mono">{x.points} / {x.weight}</td></tr>)}</tbody></table>
      <div className="note">To be listed a proposal must pass every check above, including a Keel score of at least 50. Pools are ranked by score; tier A is 70 and up.</div>
    </div>}
    <ul className="checks">{g.checks.map(c => <li key={c.name}><span className={'mono st ' + (c.ok ? 'ok' : 'bad')}>{c.ok ? '✓' : '✗'}</span><div><b>{c.name}</b><div className="note" style={{ margin: 0 }}>{c.detail}</div></div></li>)}</ul>
    {p.rationale && <p className="rat">{p.rationale}</p>}
    {pr && <div className="mono" style={{ textTransform: 'none', margin: '10px 0' }}>Proposed by {pr.agent}{pr.agentId ? <> · ERC-8004 id {pr.agentId}</> : null}{pr.mode === 'local' && <span className="badge">Off-chain dry run</span>}</div>}
    <div className="figs two">{win('Early period 2020-2024', w.early)}{win('Recent 2025 to date', w.recent)}</div>
    <div className="note">Graded by Keel with the same rules as the curated pools. The recent period is shown so you can see how the pool held up lately; the proposer could see this data too, so it is not a forecast.</div>
  </div>);
}
