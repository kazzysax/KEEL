import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { buildPlan } from '@/lib/plan';
import { USDT, BSC } from '@/lib/tokens';
export const dynamic = 'force-dynamic';
const run = promisify(execFile);
const Body = z.object({ poolId: z.string().regex(/^[DTS]\d$/), amountUsd: z.number().min(10).max(500), confirm: z.literal(true) });
const baw = async (args: string[]) => (await run('baw', args, { timeout: 90_000 })).stdout;
// Mode B: operator-run agent buys every leg through the Binance Agentic Wallet. Spending limits live in the Binance App (the agent cannot change them).
export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  if (process.env.BAW_ENABLED !== '1') return NextResponse.json({ mode: 'demo', note: 'Agent runner not enabled on this deployment (BAW_ENABLED=1 and a signed-in baw session required).' });
  const wallet = process.env.AGENT_WALLET_ADDRESS; if (!wallet) return NextResponse.json({ error: 'AGENT_WALLET_ADDRESS missing' }, { status: 500 });
  const plan = await buildPlan(b.data.poolId, b.data.amountUsd, wallet);
  if (!plan.allOk) return NextResponse.json({ error: 'Pre-flight failed: no money moved', plan }, { status: 422 });
  const settings = await baw(['wallet', 'settings', '--json']).catch(() => '');
  const log: any[] = [];
  for (const leg of plan.legs) {
    const common = ['--fromTokenQty', String(leg.usd), '--fromToken', USDT.address, '--toToken', leg.token!, '--binanceChainId', BSC, '--slippage', '1'];
    try {
      await baw(['market-order', 'quote', ...common]); const out = await baw(['market-order', 'swap', ...common, '--mev']);
      const orderId = (out.match(/orderId["':\s]+([\w-]{6,})/i) ?? [])[1];
      // an orderId is not a completed swap: poll `market-order list` until FINISHED or FAILED
      let final = 'PENDING', txHash: string | undefined;
      for (let i = 0; i < 20 && final !== 'FINISHED' && final !== 'FAILED'; i++) {
        await new Promise(r => setTimeout(r, 4000));
        const list = await baw(['market-order', 'list', '--json']).catch(() => '');
        const row = orderId && list.includes(orderId) ? list.slice(Math.max(0, list.indexOf(orderId) - 400), list.indexOf(orderId) + 600) : '';
        if (/FINISHED/.test(row)) final = 'FINISHED'; else if (/FAILED/.test(row)) final = 'FAILED';
        txHash = (row.match(/0x[a-fA-F0-9]{64}/) ?? [])[0] ?? txHash;
      }
      if (final !== 'FINISHED') throw new Error(`Order ${orderId ?? '?'} ended as ${final}`);
      log.push({ asset: leg.asset, status: 'finished', orderId, txHash });
    } catch (e: any) { log.push({ asset: leg.asset, status: 'failed', error: String(e.message ?? e) }); break; } // stop on first failure: partial state is shown to the user
  }
  return NextResponse.json({ mode: 'live', plan, settings, log, partial: log.some(l => l.status === 'failed') && log.some(l => l.status === 'finished') });
}
