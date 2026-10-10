import { NextResponse } from 'next/server'; import { z } from 'zod'; import { submitRfq } from '@/lib/swap';
export const dynamic = 'force-dynamic';
const Body = z.object({ requestId: z.string().uuid(), userSignature: z.string().regex(/^0x[0-9a-fA-F]+$/), vendor: z.string().max(40), quoteId: z.string().max(200), signingScheme: z.string().max(40).optional() });
export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null)); if (!b.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try { return NextResponse.json(await submitRfq(b.data)); } catch (e: any) { return NextResponse.json({ error: String(e.message ?? e) }, { status: 502 }); }
}
