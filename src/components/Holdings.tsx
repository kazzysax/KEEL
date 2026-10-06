'use client';
import { useState } from 'react';
import { runLegs, type LegResult, type ExecLeg } from '@/lib/execute';
import type { Manifest } from '@/lib/types';
type Pos = { asset: string; symbol: string; token: string; balance: string; rawBalance: string; usd: number };
export default function Holdings({ man }: { man: Manifest }) {
  const [wallet, setWallet] = useState(''); const [pos, setPos] = useState<Pos[] | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [res, setRes] = useState<LegResult[] | null>(null);
  async function load(w = wallet) { setErr(''); try { const j = await (await fetch(`/api/holdings?wallet=${w}`)).json(); if (j.error) throw new Error(j.error); setPos(j.positions); } catch (e: any) { setErr(e.message); } }
  async function connect() { try { const a = await window.ethereum?.request({ method: 'eth_requestAccounts' }); if (a?.[0]) { setWallet(a[0]); load(a[0]); } else setErr('No wallet found'); } catch { setErr('Wallet connection declined'); } }
  async function sell(list: Pos[]) {
    setBusy(true); setErr('');
    try { const legs: ExecLeg[] = list.map(p => ({ asset: p.asset, symbol: p.symbol, token: p.token, side: 'sell', amountUnits: p.rawBalance })); setRes(null); await runLegs(window.ethereum, wallet as `0x${string}`, legs, { demo: false, onUpdate: setRes }); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const have = new Set((pos ?? []).map(p => p.asset));
  const exitable = man.pools.filter(p => p.legs.every(l => have.has(l)));
  return (<div>
    <div className="sh"><h2>Your positions</h2><button className="btn" onClick={connect}>{wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)} · refresh` : 'Connect wallet'}</button></div>
    {err && <div className="err mono">{err}</div>}
    {pos === null ? <div className="note">Connect a wallet to see pool tokens you hold on BNB Chain. In demo mode no balances are read.</div> :
      pos.length === 0 ? <div className="note">No pool tokens found in this wallet.</div> :
        <table className="plan"><thead><tr className="mono"><th>Token</th><th>Balance</th><th>Value</th><th /></tr></thead><tbody>
          {pos.map(p => <tr key={p.token}><td><b>{man.assets[p.asset]?.label}</b><div className="mono" style={{ color: 'var(--mute)' }}>{p.symbol}</div></td><td>{Number(p.balance).toFixed(4)}</td><td>${p.usd.toFixed(2)}</td><td><button className="btn" disabled={busy} onClick={() => sell([p])}>Sell</button></td></tr>)}
        </tbody></table>}
    {exitable.length > 0 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>{exitable.map(p => <button key={p.id} className="btn acc" disabled={busy} onClick={() => sell(pos!.filter(x => p.legs.includes(x.asset)))}>Exit pool {p.id}</button>)}</div>}
    {res && <div className="note mono" style={{ color: 'var(--ink)' }}>{res.map(r => <div key={r.asset}>{r.asset}: {r.status}{r.error ? ' · ' + r.error : ''}{r.txHash ? <> · <a href={`https://bscscan.com/tx/${r.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>tx</a></> : null}</div>)}</div>}
  </div>);
}
