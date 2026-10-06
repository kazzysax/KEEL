import { NextResponse } from 'next/server'; import { balances } from '@/lib/swap'; import { REGISTRY } from '@/lib/tokens';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const w = new URL(req.url).searchParams.get('wallet') ?? ''; if (!/^0x[a-fA-F0-9]{40}$/.test(w)) return NextResponse.json({ error: 'Bad wallet' }, { status: 400 });
  const map = new Map<string, { asset: string; symbol: string; decimals: number }>();
  for (const [asset, opts] of Object.entries(REGISTRY)) for (const o of opts) if (o.address) map.set(o.address.toLowerCase(), { asset, symbol: o.symbol, decimals: o.decimals });
  try {
    const rows = await balances(w, [...map.keys()]);
    const out = rows.map((r: any) => ({ ...map.get(String(r.tokenContractAddress).toLowerCase())!, token: r.tokenContractAddress, balance: r.balance, rawBalance: r.rawBalance, usd: Number(r.balance) * Number(r.tokenPrice ?? 0) })).filter((r: any) => r.asset && Number(r.balance) > 0);
    return NextResponse.json({ wallet: w, positions: out });
  } catch (e: any) { return NextResponse.json({ error: String(e.message ?? e) }, { status: 502 }); }
}
