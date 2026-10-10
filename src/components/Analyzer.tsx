'use client';
import { useEffect, useState } from 'react';
import Chart from './Chart';
type A = { ticker: string; name: string; kind: string; venues: Record<string, { symbol: string; chain: string; address?: string }> };
const pct = (v: number, d = 1) => (v * 100).toFixed(d) + '%';
export default function Analyzer() {
  const [q, setQ] = useState(''); const [found, setFound] = useState<A[]>([]); const [sel, setSel] = useState<A[]>([]);
  const [res, setRes] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setTimeout(() => fetch(`/api/universe?q=${encodeURIComponent(q)}&limit=12`).then(r => r.json()).then(j => setFound(j.assets ?? [])).catch(() => {}), 150); return () => clearTimeout(t); }, [q]);
  const add = (a: A) => { if (sel.length < 3 && !sel.find(x => x.ticker === a.ticker)) setSel([...sel, a]); };
  const run = async (legs = sel.map(s => s.ticker)) => {
    setErr(''); setBusy(true); setRes(null);
    try { const r = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ legs, series: true }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setRes(j); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const labels = res ? Object.fromEntries(res.assets.map((a: any) => [a.ticker, a.name])) : {};
  return (<div>
    <div className="mono" style={{ margin: '18px 0 6px', color: 'var(--mute)' }}>Your pair ({sel.length} of 3)</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 36 }}>{sel.map(a => <button key={a.ticker} className="btn" onClick={() => setSel(sel.filter(x => x.ticker !== a.ticker))}>{a.ticker} · {a.name} ✕</button>)}{!sel.length && <span style={{ color: 'var(--mute)' }}>Search below and tap assets to add them.</span>}</div>
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search BTC, NVDA, Apple, gold…" style={{ width: '100%', maxWidth: 420, margin: '14px 0', padding: 12, border: '1px solid var(--line)', background: 'transparent', color: 'inherit' }} />
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{found.map(a => <button key={a.ticker} className="btn link" onClick={() => add(a)}>{a.ticker} <span style={{ color: 'var(--mute)' }}>{a.kind}</span></button>)}</div>
    <div style={{ margin: '20px 0' }}><button className="btn acc" disabled={sel.length < 2 || busy} onClick={() => run()}>{busy ? 'Grading…' : 'Grade this pair'}</button></div>
    {err && <div className="note">{err}</div>}
    {res && <div>
      <div className="figs">
        <div><div className="mono">Keel score</div><div className="v" style={{ color: 'var(--acc)' }}>{res.score ?? '-'}{res.tier ? ` · ${res.tier}` : ''}</div><div className="n">{res.pass ? 'Passes every check.' : 'Fails at least one check.'}</div></div>
        {res.figures && <>
          <div><div className="mono">Worst drawdown</div><div className="v">{pct(res.figures.maxDD)}</div><div className="n">Biggest fall of the combined pair from a peak.</div></div>
          <div><div className="mono">Average / year</div><div className="v">{pct(res.figures.avgYear)}</div><div className="n">Compounded yearly growth over {res.days} shared trading days.</div></div>
          <div><div className="mono">Offset score</div><div className="v">{res.figures.offset}</div><div className="n">On days one asset fell, how often the pair held flat or rose.</div></div></>}
      </div>
      {res.series && <Chart series={res.series} legs={res.legs} labels={labels} />}
      <div className="mono" style={{ margin: '22px 0 8px', color: 'var(--mute)' }}>Checks</div>
      <div className="evs">{res.checks.map((c: any) => <div className="ev" key={c.name}><span className="mono" style={{ color: c.ok ? 'var(--acc)' : 'inherit' }}>{c.ok ? 'PASS' : 'FAIL'}</span><span className="mono">{c.name}</span><span /><span>{c.detail}</span></div>)}</div>
      <div className="mono" style={{ margin: '22px 0 8px', color: 'var(--mute)' }}>Where each asset trades</div>
      <div className="evs">{res.assets.map((a: any) => <div className="ev" key={a.ticker}><span className="mono">{a.ticker}</span><span>{a.name}</span><span className="mono">{pct(0, 0) && ''}{a.lastPrice.toFixed(2)}</span><span>{Object.entries(a.venues).map(([v, x]: any) => `${v}: ${x.symbol} (${x.chain})${x.address ? ' ' + x.address : ''}`).join(' · ')}</span></div>)}</div>
      <p className="note" style={{ marginTop: 16 }}>{res.note}</p>
    </div>}
  </div>);
}
