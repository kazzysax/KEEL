'use client';
// One shared wallet connection for the whole app. Two ways in, both end up as a standard EIP-1193 provider,
// so the swap code (src/lib/execute.ts) does not care which one is used:
//   - a browser wallet (window.ethereum: MetaMask, Binance Web3 Wallet in-app browser, etc.)
//   - WalletConnect v2 (QR code / deep link for mobile wallets, including the Binance app). Needs NEXT_PUBLIC_WC_PROJECT_ID.
import { useSyncExternalStore } from 'react';

declare global { interface Window { ethereum?: any } }
export type WalletState = { address: string; kind: '' | 'injected' | 'walletconnect' };
const EMPTY: WalletState = { address: '', kind: '' };
const PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? '';
export const walletConnectEnabled = PROJECT_ID.length > 0;

let state: WalletState = EMPTY;
let provider: any = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

export const getProvider = () => { if (!provider) throw new Error('Connect your wallet first'); return provider; };

function adopt(p: any, kind: WalletState['kind'], address: string) {
  provider = p; state = { address, kind }; emit();
  p.on?.('accountsChanged', (a: string[]) => { if (a?.[0]) { state = { address: a[0], kind }; emit(); } else void disconnect(); });
  p.on?.('disconnect', () => { provider = null; state = EMPTY; emit(); });
}

export async function connectInjected() {
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (!eth) throw new Error('No browser wallet found. Use WalletConnect, or open Keel inside your wallet app.');
  const a = await eth.request({ method: 'eth_requestAccounts' });
  if (!a?.[0]) throw new Error('Wallet connection declined');
  adopt(eth, 'injected', a[0]);
}

async function wcProvider() {
  const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
  return EthereumProvider.init({
    projectId: PROJECT_ID, chains: [56], showQrModal: true,
    metadata: { name: 'Keel', description: 'Curated pools of tokenized stocks on BNB Chain', url: window.location.origin, icons: [`${window.location.origin}/icon.svg`] },
  });
}

export async function connectWalletConnect() {
  if (!walletConnectEnabled) throw new Error('WalletConnect is not configured (NEXT_PUBLIC_WC_PROJECT_ID).');
  const p = await wcProvider();
  if (!p.session) await p.connect();
  const a = p.accounts?.[0]; if (!a) throw new Error('Wallet connection declined');
  adopt(p, 'walletconnect', a);
}

/** Reopen a WalletConnect session after a page reload, without showing the QR modal. */
export async function restore() {
  if (provider || !walletConnectEnabled || typeof window === 'undefined') return;
  try {
    if (!Object.keys(localStorage).some(k => k.startsWith('wc@2:'))) return;
    const p = await wcProvider(); if (p.session && p.accounts?.[0]) adopt(p, 'walletconnect', p.accounts[0]);
  } catch { /* no saved session */ }
}

export async function disconnect() {
  try { await provider?.disconnect?.(); } catch { /* ignore */ }
  provider = null; state = EMPTY; emit();
}

export function useWallet(): WalletState {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => EMPTY);
}
