import { NextResponse } from 'next/server'; import { z } from 'zod'; import { prepareSwap } from '@/lib/swap';
export const dynamic = 'force-dynamic';
const A = /^0x[a-fA-F0-9]{40}$/;
const Body = z.object({ from: z.string().regex(A), to: z.string().regex(A), amountUnits: z.string().regex(/^\d{1,40}$/), wallet: z.string().regex(A) });
export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null)); if (!b.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try { return NextResponse.json(await prepareSwap(b.data)); } catch (e: any) { return NextResponse.json({ error: String(e.message ?? e) }, { status: 502 }); }
}
