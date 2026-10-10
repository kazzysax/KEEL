import 'server-only';
import { api, paced, unwrap, DEMO } from './binance';
import { REGISTRY, USDT, BSC } from './tokens';
import { manifest, pool as loadPool } from './pools';
import type { LegPlan, Plan, TokenOption } from './types';

const toUnits = (n: number, d: number) => BigInt(Math.round(n * 10 ** Math.min(d, 8))) * 10n ** BigInt(Math.max(d - 8, 0));
const fromUnits = (s: string, d: number) => Number(BigInt(s)) / 10 ** d;
const MIN_LEG_USD = 5.5;     // Ondo refuses orders of $5 and under
const MAX_IMPACT_PCT = 2;    // pre-flight: reject if price impact above 2%

async function resolve(asset: string): Promise<TokenOption[]> {
  const base = REGISTRY[asset] ?? [];
  if (DEMO || base.every(o => o.address)) return base;
  try {
    const res = await paced(`search:${asset}`, async () => unwrap<any>(await api().searchRwaToken({ keyword: asset })), 10 * 60_000);
    const hit = (res as any[]).find(r => r.ticker?.toUpperCase() === asset) ?? (res as any[])[0];
    const found = (hit?.assets ?? []).filter((a: any) => String(a.binanceChainId) === BSC);
    return base.map(o => {
      if (o.address) return o;
      const m = found.find((a: any) => String(a.tokenSymbol).toUpperCase() === o.symbol.toUpperCase());
      return m ? { ...o, address: m.tokenContractAddress } : o;
    });
  } catch { return base; }
}
async function rwaMeta() {
  return paced('rwa:list', async () => {
    const list = (await unwrap<any>(await api().getRwaTokenList({ binanceChainId: BSC }))) as any[];
    const m = new Map<string, any>(); for (const t of list) m.set(String(t.tokenContractAddress).toLowerCase(), t); return m;
  }, 60_000);
}

export async function buildPlan(poolId: string, amountUsd: number, wallet?: string, weights?: number[]): Promise<Plan> {
  const p = loadPool(poolId); const man = manifest();
  if (weights && (weights.length !== p.legs.length || Math.abs(weights.reduce((a, b) => a + b, 0) - 1) > 0.001 || weights.some(w => w < 0.05))) throw new Error('Invalid split: one weight per asset, each at least 5%, totalling 100%');
  const meta = DEMO ? null : await rwaMeta();
  const legs: LegPlan[] = [];
  for (const [idx, asset] of p.legs.entries()) {
    const per = Math.floor(amountUsd * (weights?.[idx] ?? 1 / p.legs.length) * 100) / 100;
    const label = man.assets[asset].label; const options = await resolve(asset);
    const base: LegPlan = { asset, label, issuer: '', symbol: '', token: null, usd: per, quoteOut: null, minOut: null, impactPct: null, status: 'unverified', simulated: false };
    const usable = options.filter(o => o.address);
    if (!usable.length) { legs.push({ ...base, issuer: options[0]?.issuer ?? '—', symbol: options[0]?.symbol ?? asset, reason: 'No BSC token address resolved for this asset yet' }); continue; }
    if (DEMO) {
      const o = usable[0]; const px = (man.assets[asset].last ?? 100); const qty = per / px;
      legs.push({ ...base, issuer: o.issuer, symbol: o.symbol, token: o.address, quoteOut: qty.toFixed(6), minOut: (qty * 0.99).toFixed(6), impactPct: 0.1, status: per > MIN_LEG_USD  ? 'ok' : 'rejected', reason: per > MIN_LEG_USD  ? 'SIMULATED quote (demo mode, no API key)' : 'Leg is $5 or less', simulated: false }); continue;
    }
    if (!wallet) throw new Error('A wallet address is required to quote (Ondo is RFQ).');
    const cands: { o: TokenOption; q: any; cps: number }[] = [];
    for (const o of usable) {
      try {
        const qs = (await paced(`q:${o.address}:${per}:${wallet}`, async () => unwrap<any>(await api().getAggregatedQuote({ binanceChainId: BSC, amount: toUnits(per, USDT.decimals).toString(), fromTokenAddress: USDT.address, toTokenAddress: o.address!, userWalletAddress: wallet })), 15_000)) as any[];
        const best = qs.find(x => x.isBest) ?? qs[0]; if (!best?.toTokenAmount) continue;
        const ratio = Number(meta?.get(o.address!.toLowerCase())?.tokenToShareRatio ?? 1) || 1; // multiplier: shares per token
        const shares = fromUnits(best.toTokenAmount, o.decimals) * ratio;
        cands.push({ o, q: best, cps: per / shares });
      } catch { /* option unquotable: skip */ }
    }
    if (!cands.length) { legs.push({ ...base, issuer: usable[0].issuer, symbol: usable[0].symbol, token: usable[0].address, status: 'rejected', reason: 'No route returned a quote (market closed or no liquidity)' }); continue; }
    cands.sort((a, b) => a.cps - b.cps); const w = cands[0];
    const status = meta?.get(w.o.address!.toLowerCase())?.statusInfo; const impactPct = Number(w.q.priceImpactPercent ?? 0) * 100; // reported as a fraction
    let reason: string | undefined; let ok = true;
    if (w.o.issuer === 'Ondo' && per <= 5) { ok = false; reason = 'Ondo refuses orders of $5 and under'; }
    else if (status && status.openState === false) { ok = false; reason = `Market ${status.marketStatus}: ${status.reasonMsg ?? 'closed'}`; }
    else if (impactPct > MAX_IMPACT_PCT) { ok = false; reason = `Price impact ${impactPct.toFixed(2)}% above ${MAX_IMPACT_PCT}%`; }
    let simulated = false, minOut: string | null = null, rfq = false;
    if (ok) {
      try {
        const b = await unwrap<any>(await api().buildSwapTransaction({ binanceChainId: BSC, amount: toUnits(per, USDT.decimals).toString(), fromTokenAddress: USDT.address, toTokenAddress: w.o.address!, userWalletAddress: wallet, quoteId: w.q.quoteId, slippagePercent: '1' }));
        minOut = b?.tx?.minReceiveAmount ?? null; rfq = !!b?.rfq;
        if (b?.tx?.data) {
          const simRes: any = await api().simulateTransactions({ binanceChainId: BSC, evmTx: { from: wallet, to: b.tx.to, value: b.tx.value ?? '0', data: b.tx.data }, solTx: {}, tronTx: {} } as any); const simRaw: any = await simRes.data(); const sim: any = simRaw?.data ?? simRaw;
          simulated = sim?.status === 'SUCCESS' || sim?.status === 'success';
          // A clear failure blocks the leg. No result at all is inconclusive, not a failure: the dry run cannot pass before the wallet
          // has approved the token, so it must not stop a first purchase. The wallet shows its own final check before signing.
          const failed = !simulated && sim && /fail|revert|error/i.test(String(sim.status ?? '')) ;
          if (failed) { ok = false; reason = `Simulation failed: ${sim?.failReason ?? sim?.status}`; }
          else if (!simulated) reason = 'Not pre-simulated (the wallet approves the token first); your wallet shows the final check before you sign';
        }
      } catch (e: any) { ok = false; reason = String(e.message ?? e); }
    }
    legs.push({ ...base, issuer: w.o.issuer, symbol: w.o.symbol, token: w.o.address, quoteOut: w.q.toTokenAmount, minOut, impactPct, status: ok ? 'ok' : 'rejected', reason, simulated, rfq,
      alternatives: cands.map(c => ({ issuer: c.o.issuer, costPerShare: c.cps })) });
  }
  return { poolId, amountUsd, mode: DEMO ? 'demo' : 'live', legs, allOk: legs.every(l => l.status === 'ok'), createdAt: new Date().toISOString() };
}
