'use client';
import { useEffect, useState } from 'react';
import { connectInjected, connectWalletConnect, disconnect, restore, useWallet, walletConnectEnabled } from '@/lib/wallet';

export default function ConnectButton({ style }: { style?: React.CSSProperties }) {
  const { address, kind } = useWallet(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { void restore(); }, []);
  async function go(fn: () => Promise<void>) { setBusy(true); setErr(''); try { await fn(); setOpen(false); } catch (e: any) { setErr(String(e?.message ?? e).slice(0, 140)); } finally { setBusy(false); } }
  if (address) return (<div style={style}>
    <button className="btn" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => void disconnect()} title="Disconnect">
      <span>{address.slice(0, 6)}…{address.slice(-4)} · {kind === 'walletconnect' ? 'WalletConnect' : 'Browser'}</span><span>Disconnect</span></button></div>);
  return (<div style={style}>
    <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={busy} onClick={() => setOpen(o => !o)}>{busy ? 'Connecting…' : 'Connect wallet'}</button>
    {open && <div style={{ border: '1px solid var(--ink)', borderTop: 0, display: 'grid' }}>
      <button className="btn" style={{ border: 0, borderBottom: '1px solid var(--line)', justifyContent: 'flex-start' }} disabled={busy} onClick={() => go(connectInjected)}>Browser wallet</button>
      <button className="btn" style={{ border: 0, justifyContent: 'flex-start' }} disabled={busy || !walletConnectEnabled} onClick={() => go(connectWalletConnect)}>WalletConnect · mobile wallets{walletConnectEnabled ? '' : ' (not set up)'}</button>
    </div>}
    {err && <div className="err mono">{err}</div>}
  </div>);
}
