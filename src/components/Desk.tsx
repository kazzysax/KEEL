'use client';
import { useCallback, useEffect, useState } from 'react';
import { getProvider, useWallet } from '@/lib/wallet';
import ConnectButton from './ConnectButton';
type Link = { agent: string; label: string; at: string; revoked?: boolean };
type Sug = { id: string; agent: string; action: 'exit' | 'add'; poolId: string; note: string; at: string; status: string };
const msgs = {
  link: (o: string, a: string, t: number) => `Keel desk: link agent ${a.toLowerCase()} to ${o.toLowerCase()} at ${t}`,
  revoke: (o: string, a: string, t: number) => `Keel desk: revoke agent ${a.toLowerCase()} from ${o.toLowerCase()} at ${t}`,
  resolve: (o: string, id: string, s: string, t: number) => `Keel desk: ${s} ${id} for ${o.toLowerCase()} at ${t}`,
};
export default function Desk() {
  const { address } = useWallet(); const [d, setD] = useState<{ links: Link[]; suggestions: Sug[] } | null>(null);
  const [agent, setAgent] = useState(''); const [label, setLabel] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { if (!address) return setD(null); const r = await fetch(`/api/desk?owner=${address}`); setD(await r.json()); }, [address]);
  useEffect(() => { void load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  async function call(url: string, message: string, ts: number, body: object) {
    setBusy(true); setErr('');
    try {
      const signature = await getProvider().request({ method: 'personal_sign', params: [message, address] });
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ owner: address, ts, signature, ...body }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Failed'); await load();
    } catch (e: any) { setErr(String(e?.message ?? e).slice(0, 200)); } finally { setBusy(false); }
  }
  const link = () => { const ts = Date.now(); return call('/api/desk/link', msgs.link(address, agent, ts), ts, { agent, label }).then(() => { setAgent(''); setLabel(''); }); };
  const revoke = (a: string) => { const ts = Date.now(); return call('/api/desk/link', msgs.revoke(address, a, ts), ts, { agent: a, revoke: true }); };
  const resolve = (s: Sug, status: 'approved' | 'dismissed') => { const ts = Date.now(); return call('/api/desk/resolve', msgs.resolve(address, s.id, status, ts), ts, { id: s.id, status }).then(() => { if (status === 'approved') location.href = s.action === 'exit' ? '/#positions' : '/#pools'; }); };
  if (!address) return <div className="note">Connect the wallet that holds your pools. Your agent is linked to that address.<div style={{ maxWidth: 320, marginTop: 12 }}><ConnectButton /></div></div>;
  const live = d?.links.filter(l => !l.revoked) ?? []; const pending = d?.suggestions.filter(s => s.status === 'pending') ?? []; const past = d?.suggestions.filter(s => s.status !== 'pending') ?? [];
  const name = (a: string) => d?.links.find(l => l.agent === a)?.label ?? a.slice(0, 8);
  return (<div style={{ display: 'grid', gap: 22 }}>
    <section><div className="sh"><h3>Your agents</h3></div>
      {live.length === 0 ? <div className="note">No agent linked yet.</div> : live.map(l => <div key={l.agent} className="ev" style={{ gridTemplateColumns: '1fr auto' }}>
        <span><b>{l.label}</b> <span className="mono" style={{ color: 'var(--mute)' }}>{l.agent}</span></span><button className="btn" disabled={busy} onClick={() => revoke(l.agent)}>Revoke</button></div>)}
      <div style={{ display: 'grid', gap: 8, marginTop: 12, maxWidth: 520 }}>
        <input className="mono" placeholder="Agent wallet address (0x…)" value={agent} onChange={e => setAgent(e.target.value.trim())} style={{ padding: 10, border: '1px solid var(--ink)', background: 'transparent' }} />
        <input placeholder="Name (optional)" value={label} maxLength={40} onChange={e => setLabel(e.target.value)} style={{ padding: 10, border: '1px solid var(--ink)', background: 'transparent' }} />
        <button className="btn acc" disabled={busy || !/^0x[0-9a-fA-F]{40}$/.test(agent)} onClick={link}>Link agent (you sign a free message)</button>
      </div>
      <p className="mono" style={{ color: 'var(--mute)', textTransform: 'none', marginTop: 8 }}>The agent can only leave suggestions. It never holds your keys and cannot trade. Revoking takes effect immediately.</p>
    </section>
    <section><div className="sh"><h3>Suggestions waiting for you</h3></div>
      {pending.length === 0 ? <div className="note">Nothing waiting.</div> : pending.map(s => <div key={s.id} className="ev" style={{ gridTemplateColumns: '1fr auto' }}>
        <span><b>{s.action === 'exit' ? 'Exit' : 'Add'} pool {s.poolId}</b> <span className="mono" style={{ color: 'var(--mute)' }}>by {name(s.agent)} · {s.at.slice(0, 16).replace('T', ' ')} UTC</span><br />{s.note || <i>No reason given</i>}</span>
        <span style={{ display: 'flex', gap: 8 }}><button className="btn acc" disabled={busy} onClick={() => resolve(s, 'approved')}>Approve</button><button className="btn" disabled={busy} onClick={() => resolve(s, 'dismissed')}>Dismiss</button></span></div>)}
      <p className="mono" style={{ color: 'var(--mute)', textTransform: 'none', marginTop: 8 }}>Approve takes you to {`the app`} to do it yourself with your own wallet: nothing is sold or bought until you confirm there.</p>
    </section>
    {past.length > 0 && <section><div className="sh"><h3>History</h3></div>{past.slice(0, 15).map(s => <div key={s.id} className="ev" style={{ gridTemplateColumns: '1fr auto' }}><span>{s.action} {s.poolId} · {name(s.agent)}</span><span className="mono">{s.status}</span></div>)}</section>}
    {err && <div className="err mono">{err}</div>}
  </div>);
}
