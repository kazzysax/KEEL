'use client';
import { useState } from 'react';
import type { Plan, Pool } from '@/lib/types';
import { runLegs, type LegResult, type ExecLeg } from '@/lib/execute';
const usd = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
declare global { interface Window { ethereum?: any } }
export default function BuyPanel({ pool, labels }: { pool: Pool; labels: Record<string, string> }) {
  const [mode, setMode] = useState<'wallet' | 'agent'>('wallet');
  const [amount, setAmount] = useState('100');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [receipt, setReceipt] = useState<string[] | null>(null);
  const [wallet, setWallet] = useState<string>('');
  const [results, setResults] = useState<LegResult[] | null>(null);
  const amt = Number(amount) || 0; const n = pool.legs.length; const each = Math.floor((amt / n) * 100) / 100;
  async function connect() { try { const a = await window.ethereum?.request({ method: 'eth_requestAccounts' }); if (a?.[0]) setWallet(a[0]); else setErr('No wallet found'); } catch { setErr('Wallet connection declined'); } }
  async function build() {
    setErr(''); setReceipt(null); setPlan(null); setBusy(true);
    try {
      const r = await fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ poolId: pool.id, amountUsd: amt, wallet: wallet || undefined }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error); setPlan(j);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!plan) return; setBusy(true); setErr('');
    try {
      if (plan.mode === 'demo') { await new Promise(r => setTimeout(r, 700)); setReceipt(plan.legs.map(l => `${l.symbol}: SIMULATED fill of ${l.quoteOut} for ${usd(l.usd)}`)); return; }
      if (mode === 'agent') {
        const r = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ poolId: pool.id, amountUsd: amt, confirm: true }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Agent failed'); setReceipt((j.log ?? []).map((l: any) => `${l.asset}: ${l.status}`)); return;
      }
      if (!wallet) throw new Error('Connect your wallet first');
      const legs: ExecLeg[] = plan.legs.map(l => ({ asset: l.asset, symbol: l.symbol, token: l.token!, side: 'buy', amountUnits: (BigInt(Math.round(l.usd * 100)) * 10n ** 16n).toString() }));
      setResults(legs.map(l => ({ asset: l.asset, symbol: l.symbol, side: 'buy', status: 'skipped' })));
      await runLegs(window.ethereum, wallet as `0x${string}`, legs, { demo: false, onUpdate: setResults });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (<div className="buy">
    <h3>Buy this pool</h3>
    <div className="seg"><button className={mode === 'wallet' ? 'on' : ''} onClick={() => { setMode('wallet'); setPlan(null); }}>My wallet</button><button className={mode === 'agent' ? 'on' : ''} onClick={() => { setMode('agent'); setPlan(null); }}>Agent · Agentic Wallet</button></div>
    <div className="mono" style={{ marginBottom: 6, color: 'var(--mute)' }}>Amount (USDT)</div>
    <div className="amt"><span className="mono">USDT</span><input inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value.replace(/[^0-9.]/g, '')); setPlan(null); }} /></div>
    <div className="split mono">{pool.legs.map(l => <div key={l}><span>{labels[l]}</span><b>{usd(each)} · {(100 / n).toFixed(n === 3 ? 1 : 0)}%</b></div>)}</div>
    {mode === 'wallet' && <button className="btn" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={connect}>{wallet ? `Connected ${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'Connect wallet'}</button>}
    <button className="btn acc" disabled={busy || amt < 10} style={{ width: '100%', justifyContent: 'space-between' }} onClick={build}>{busy && !plan ? 'Checking every leg…' : 'Check quotes & plan'}</button>
    {err && <div className="err mono">{err}</div>}
    {plan && <>
      <table className="plan"><thead><tr className="mono"><th>Leg</th><th>Via</th><th>Spend</th><th>Check</th></tr></thead><tbody>
        {plan.legs.map(l => <tr key={l.asset}><td><b>{labels[l.asset]}</b><div className="mono" style={{ color: 'var(--mute)' }}>{l.token ? l.token.slice(0, 8) + '…' + l.token.slice(-4) : 'no address'}</div></td>
          <td className="mono">{l.issuer}<br />{l.symbol}</td><td>{usd(l.usd)}</td>
          <td><span className={'st mono ' + (l.status === 'ok' ? 'ok' : 'bad')}>{l.status === 'ok' ? 'PASS' : l.status.toUpperCase()}</span>{l.reason && <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 3 }}>{l.reason}</div>}</td></tr>)}
      </tbody></table>
      <button className="btn acc" disabled={!plan.allOk || busy} style={{ width: '100%', justifyContent: 'space-between' }} onClick={confirm}>{plan.allOk ? (plan.mode === 'demo' ? 'Confirm (simulated)' : 'Confirm once · buy all legs') : 'Blocked: a leg failed pre-flight'}</button>
      <div className="note">All-or-nothing check: every leg is quoted, built and simulated before any money moves. {plan.mode === 'demo' && 'DEMO MODE: quotes are synthetic until an API key is set.'}</div>
    </>}
    {results && <Progress results={results} labels={labels} busy={busy} wallet={wallet} onRetry={async () => {
      if (!plan) return; setBusy(true);
      const pend = plan.legs.map((l, i) => ({ l, i })).filter(({ i }) => results[i].status !== 'filled');
      const legs: ExecLeg[] = pend.map(({ l }) => ({ asset: l.asset, symbol: l.symbol, token: l.token!, side: 'buy', amountUnits: (BigInt(Math.round(l.usd * 100)) * 10n ** 16n).toString() }));
      const base = [...results];
      try { await runLegs(window.ethereum, wallet as `0x${string}`, legs, { demo: false, onUpdate: r => { const m = [...base]; pend.forEach(({ i }, k) => { m[i] = r[k]; }); setResults(m); } }); } finally { setBusy(false); }
    }} onUnwind={async () => {
      setBusy(true); try {
        const h = await (await fetch(`/api/holdings?wallet=${wallet}`)).json();
        const legs: ExecLeg[] = (h.positions ?? []).filter((x: any) => results.some(r => r.status === 'filled' && r.asset === x.asset)).map((x: any) => ({ asset: x.asset, symbol: x.symbol, token: x.token, side: 'sell', amountUnits: x.rawBalance }));
        await runLegs(window.ethereum, wallet as `0x${string}`, legs, { demo: false, onUpdate: () => {} }); setErr('Filled legs sold back to USDT.');
      } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    }} />}
    {receipt && <div className="note mono" style={{ color: 'var(--ink)' }}>{receipt.map((r, i) => <div key={i}>✓ {r}</div>)}</div>}
    {mode === 'agent' && !plan && <div className="note">The agent buys inside the spending limit you set in the Binance App. It cannot raise the limit.</div>}
  </div>);
}

function Progress({ results, labels, busy, wallet, onRetry, onUnwind }: { results: LegResult[]; labels: Record<string, string>; busy: boolean; wallet: string; onRetry: () => void; onUnwind: () => void }) {
  const filled = results.filter(r => r.status === 'filled').length; const failed = results.some(r => r.status === 'failed');
  return (<div style={{ marginTop: 14 }}>
    <div className="mono" style={{ marginBottom: 6 }}>{failed ? `Partial: ${filled} of ${results.length} legs filled` : filled === results.length ? 'All legs filled' : `Executing… ${filled} of ${results.length}`}</div>
    {results.map(r => <div key={r.asset} className="mono" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', padding: '5px 0' }}>
      <span>{labels[r.asset]}</span><span style={{ color: r.status === 'failed' ? 'var(--acc)' : r.status === 'filled' ? 'var(--ok)' : 'var(--mute)' }}>{r.status}{r.txHash ? <> · <a href={`https://bscscan.com/tx/${r.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>tx</a></> : null}</span></div>)}
    {results.filter(r => r.error).map(r => <div key={r.asset} className="err">{labels[r.asset]}: {r.error}</div>)}
    {failed && !busy && <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
      <button className="btn acc" onClick={onRetry}>Retry remaining legs</button>
      {filled > 0 && <button className="btn" onClick={onUnwind}>Sell filled legs back to USDT</button>}
      <div className="note">Nothing continues automatically after a failure. Legs already filled stay in your wallet until you choose.</div></div>}
  </div>);
}
