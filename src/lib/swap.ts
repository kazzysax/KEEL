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
  const r = await unwrap<any>(await api().getTokenBalancesByAddress({ address: wallet, tokenContractAddresses: tokens.map(t => ({ binanceChainId: BSC, tokenContractAddress: t })) } as any));
  return (r as any[]).flatMap(x => x.tokenAssets ?? []);
}
