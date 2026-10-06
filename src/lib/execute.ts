// Client-side orchestration: runs legs one after another from the user's own wallet. Stops at the first failure.
import { createPublicClient, createWalletClient, custom, encodeFunctionData, erc20Abi, parseAbi, hexToString, type Hex } from 'viem';
import { bsc } from 'viem/chains';
import { USDT } from './tokens';

export type LegResult = { asset: string; symbol: string; side: 'buy' | 'sell'; status: 'filled' | 'failed' | 'skipped'; orderId?: string; txHash?: string; error?: string; toAmount?: string };
export type ExecLeg = { asset: string; symbol: string; token: string; amountUnits: string; side: 'buy' | 'sell' };
type Hooks = { onUpdate: (r: LegResult[]) => void; demo: boolean };

export function parseTypedData(raw: unknown): any {
  if (typeof raw === 'object' && raw) return raw;
  const s = String(raw); const json = s.startsWith('0x') ? hexToString(s as Hex) : s; return JSON.parse(json);
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function post(url: string, body: unknown) { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Request failed'); return j; }

export async function ensureBsc(eth: any) {
  try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] }); }
  catch (e: any) { if (e?.code === 4902) await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x38', chainName: 'BNB Smart Chain', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://bsc-dataseed.binance.org'], blockExplorerUrls: ['https://bscscan.com'] }] }); else throw e; }
}

export async function runLegs(eth: any, wallet: `0x${string}`, legs: ExecLeg[], hooks: Hooks): Promise<LegResult[]> {
  const results: LegResult[] = legs.map(l => ({ asset: l.asset, symbol: l.symbol, side: l.side, status: 'skipped' }));
  const push = () => hooks.onUpdate([...results]);
  if (!hooks.demo) await ensureBsc(eth);
  const pub = hooks.demo ? null : createPublicClient({ chain: bsc, transport: custom(eth) });
  const wc = hooks.demo ? null : createWalletClient({ account: wallet, chain: bsc, transport: custom(eth) });
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i]; const from = l.side === 'buy' ? USDT.address : l.token; const to = l.side === 'buy' ? l.token : USDT.address;
    try {
      const p = await post('/api/swap/prepare', { from, to, amountUnits: l.amountUnits, wallet });
      if (p.mode === 'DEMO') { await sleep(600); results[i] = { ...results[i], status: 'filled', orderId: 'demo', toAmount: 'simulated' }; push(); continue; }
      if (p.approve) { // exact-amount approval, only if the current allowance is too low
        const have = await pub!.readContract({ address: from as `0x${string}`, abi: erc20Abi, functionName: 'allowance', args: [wallet, p.approve.spender] });
        if (have < BigInt(l.amountUnits)) {
          const h = await wc!.sendTransaction({ to: from as `0x${string}`, data: encodeFunctionData({ abi: parseAbi(['function approve(address,uint256) returns (bool)']), functionName: 'approve', args: [p.approve.spender, BigInt(l.amountUnits)] }) });
          await pub!.waitForTransactionReceipt({ hash: h });
        }
      }
      if (p.mode === 'RFQ') {
        const td = parseTypedData(p.typedData);
        const signature = await eth.request({ method: 'eth_signTypedData_v4', params: [wallet, JSON.stringify(td)] });
        const requestId = crypto.randomUUID();
        const sub = await post('/api/swap/submit', { requestId, userSignature: signature, vendor: p.vendor, quoteId: p.quoteId, signingScheme: p.signingScheme });
        let st: any = { status: sub.status }; const t0 = Date.now();
        while (!['FILLED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(String(st.status).toUpperCase()) && Date.now() - t0 < 120_000) { await sleep(3000); st = await (await fetch(`/api/swap/status?orderId=${encodeURIComponent(sub.orderId)}`)).json(); }
        if (String(st.status).toUpperCase() !== 'FILLED') throw new Error(`Order ${sub.orderId} ended as ${st.status ?? 'timeout'}`);
        results[i] = { ...results[i], status: 'filled', orderId: sub.orderId, txHash: st.txHash ?? undefined, toAmount: st.toAmount ?? p.toAmount };
      } else {
        const h = await wc!.sendTransaction({ to: p.tx.to, data: p.tx.data, value: BigInt(p.tx.value ?? '0') });
        const rc = await pub!.waitForTransactionReceipt({ hash: h }); if (rc.status !== 'success') throw new Error('Swap transaction reverted');
        results[i] = { ...results[i], status: 'filled', txHash: h, toAmount: p.toAmount };
      }
      push();
    } catch (e: any) {
      results[i] = { ...results[i], status: 'failed', error: String(e?.shortMessage ?? e?.message ?? e).slice(0, 220) }; push(); break; // never auto-continue after a failure
    }
  }
  return results;
}
