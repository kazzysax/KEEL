import 'server-only';
import { api, paced, unwrap, DEMO } from './binance';
import { BSC } from './tokens';

export type Prepared = {
  mode: 'RFQ' | 'SWAP' | 'DEMO'; quoteId: string; vendor?: string; signingScheme?: string;
  typedData?: unknown; approve?: { spender: string; calldata: string } | null;
  tx?: { to: string; data: string; value: string; gas?: string } | null; toAmount: string; minOut?: string | null; impactPct: number;
};
// Build one swap (either direction). Always quotes with the user's address: Ondo is RFQ and requires it.
export async function prepareSwap(a: { from: string; to: string; amountUnits: string; wallet: string }): Promise<Prepared> {
  if (DEMO) return { mode: 'DEMO', quoteId: 'demo', toAmount: '0', impactPct: 0.1 };
  const qs = (await unwrap<any>(await api().getAggregatedQuote({ binanceChainId: BSC, amount: a.amountUnits, fromTokenAddress: a.from, toTokenAddress: a.to, userWalletAddress: a.wallet }))) as any[];
  if (!Array.isArray(qs) || !qs.length) throw new Error('No quote available right now. US stock tokens only trade while the US market is open (weekdays, about 14:30 to 21:00 UTC); try again then.');
  const q = qs.find(x => x.isBest) ?? qs[0]; if (!q?.quoteId) throw new Error('No route returned a quote');
  const impactPct = Number(q.priceImpactPercent ?? 0) * 100; // reported as a fraction
  if (impactPct > 2) throw new Error(`Price impact ${impactPct.toFixed(2)}% is above the 2% limit`);
  const b = await unwrap<any>(await api().buildSwapTransaction({ binanceChainId: BSC, amount: a.amountUnits, fromTokenAddress: a.from, toTokenAddress: a.to, userWalletAddress: a.wallet, quoteId: q.quoteId, slippagePercent: '1', approveTransaction: 'true' as any }));
  const out: Prepared = { mode: b?.rfq ? 'RFQ' : 'SWAP', quoteId: q.quoteId, toAmount: q.toTokenAmount, minOut: b?.tx?.minReceiveAmount ?? null, impactPct };
  if (b?.rfq) {
    out.vendor = b.rfq.vendor; out.signingScheme = b.rfq.signingScheme; out.typedData = b.rfq.typedDataToSign;
    const raw = b.rfq.signatureData?.[0]; if (raw) { try { const j = JSON.parse(raw); out.approve = { spender: j.approveContract, calldata: j.approveTxCalldata }; } catch { /* no approve data */ } }
  } else {
    out.tx = b.tx; const raw = b?.tx?.signatureData?.[0];
    if (raw) { try { const j = JSON.parse(raw); out.approve = { spender: j.approveContract, calldata: j.approveTxCalldata }; } catch { /* ignore */ } }
  }
  return out;
}
export async function submitRfq(p: { requestId: string; userSignature: string; vendor: string; quoteId: string; signingScheme?: string }) {
  if (DEMO) return { orderId: 'demo-' + p.requestId.slice(0, 8), status: 'PENDING' };
  return unwrap<any>(await api().submitRfqOrder(p as any));
}
export async function rfqStatus(orderId: string) {
  if (DEMO) return { orderId, status: 'FILLED', txHash: null };
  return paced(`rfq:${orderId}`, async () => unwrap<any>(await api().getRfqOrderStatus({ orderId })), 2000);
}
export async function balances(wallet: string, tokens: string[]) {
  if (DEMO) return [];
  let rows: any[] = [];
  try {
    const r = await unwrap<any>(await api().getTokenBalancesByAddress({ address: wallet, tokenContractAddresses: tokens.map(t => ({ binanceChainId: BSC, tokenContractAddress: t })) } as any));
    rows = Array.isArray(r) ? r.flatMap((x: any) => x?.tokenAssets ?? (x?.tokenContractAddress ? [x] : [])) : [];
  } catch { rows = []; }
  if (rows.length) return rows;
  // Fallback: read balances straight from the chain, so selling still works if the Binance call returns nothing.
  const { createPublicClient, fallback, http, erc20Abi } = await import('viem'); const { bsc } = await import('viem/chains');
  const pub = createPublicClient({ chain: bsc, transport: fallback(['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io', 'https://1rpc.io/bnb'].map(u => http(u, { timeout: 8000 }))) });
  const out: any[] = [];
  await Promise.all(tokens.map(async t => { try { const raw = await pub.readContract({ address: t as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [wallet as `0x${string}`] }); if (raw > 0n) out.push({ tokenContractAddress: t, rawBalance: raw.toString(), balance: String(Number(raw) / 1e18), tokenPrice: 0 }); } catch { /* skip */ } }));
  return out;
}
