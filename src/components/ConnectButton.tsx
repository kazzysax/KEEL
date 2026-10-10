'use client';
import { useEffect, useState } from 'react';
import { connectInjected, disconnect, restore, useWallet } from '@/lib/wallet';

export default function ConnectButton({ style }: { style?: React.CSSProperties }) {
  const { address } = useWallet(); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { void restore(); }, []);
  async function go() { setBusy(true); setErr(''); try { await connectInjected(); } catch (e: any) { setErr(String(e?.message ?? e).slice(0, 160)); } finally { setBusy(false); } }
  if (address) return (<div style={style}>
    <button className="btn" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => disconnect()} title="Disconnect">
      <span>{address.slice(0, 6)}…{address.slice(-4)}</span><span>Disconnect</span></button></div>);
  return (<div style={style}>
    <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={busy} onClick={go}>{busy ? 'Connecting…' : 'Connect wallet'}</button>
    {err && <div className="err mono">{err}</div>}
  </div>);
}
