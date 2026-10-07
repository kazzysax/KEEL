'use client';
// One shared wallet connection for the whole app: the browser wallet (window.ethereum: MetaMask, Binance Web3 Wallet,
// Trust, OKX, Rabby, or any wallet app's built-in browser). It is a standard EIP-1193 provider, so the swap code
// (src/lib/execute.ts) just uses getProvider(). On a phone, open Keel inside the wallet app's browser.
import { useSyncExternalStore } from 'react';

declare global { interface Window { ethereum?: any } }
export type WalletState = { address: string };
const EMPTY: WalletState = { address: '' };

let state: WalletState = EMPTY;
let provider: any = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

export const getProvider = () => { if (!provider) throw new Error('Connect your wallet first'); return provider; };

async function ensureBsc(eth: any) {
  try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] }); }
  catch (e: any) {
    if (e?.code !== 4902) throw new Error('Switch your wallet to BNB Smart Chain to continue.');
    await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x38', chainName: 'BNB Smart Chain', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://bsc-dataseed.binance.org'], blockExplorerUrls: ['https://bscscan.com'] }] });
  }
}

export async function connectInjected() {
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (!eth) throw new Error('No wallet found. Install a browser wallet, or open Keel inside your wallet app’s built-in browser.');
  const a = await eth.request({ method: 'eth_requestAccounts' });
  if (!a?.[0]) throw new Error('Wallet connection declined');
  await ensureBsc(eth);
  provider = eth; state = { address: a[0] }; emit();
  eth.on?.('accountsChanged', (x: string[]) => { if (x?.[0]) { state = { address: x[0] }; emit(); } else disconnect(); });
}

/** Reconnect quietly on reload if the site is already authorised (no pop-up). */
export async function restore() {
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (provider || !eth) return;
  try { const a = await eth.request({ method: 'eth_accounts' }); if (a?.[0]) { provider = eth; state = { address: a[0] }; emit(); eth.on?.('accountsChanged', (x: string[]) => { if (x?.[0]) { state = { address: x[0] }; emit(); } else disconnect(); }); } } catch { /* not authorised yet */ }
}

export function disconnect() { provider = null; state = EMPTY; emit(); }

export function useWallet(): WalletState {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => EMPTY);
}
