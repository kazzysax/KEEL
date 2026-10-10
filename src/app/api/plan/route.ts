import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildPlan } from '@/lib/plan';
export const dynamic = 'force-dynamic';
const Body = z.object({ poolId: z.string().regex(/^[A-Z]\d{1,3}$/), amountUsd: z.number().min(10).max(5000), wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(), weights: z.array(z.number().min(0.05).max(0.95)).min(2).max(3).optional() });
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request: amount must be $10 to $5,000 and each asset in a custom split at least 5%' }, { status: 400 });
  try { return NextResponse.json(await buildPlan(parsed.data.poolId, parsed.data.amountUsd, parsed.data.wallet, parsed.data.weights)); }
  catch (e: any) { return NextResponse.json({ error: String(e.message ?? e) }, { status: 502 }); }
}
