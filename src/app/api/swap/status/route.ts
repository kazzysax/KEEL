import { NextResponse } from 'next/server'; import { rfqStatus } from '@/lib/swap';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('orderId') ?? ''; if (!/^[\w-]{4,80}$/.test(id)) return NextResponse.json({ error: 'Bad orderId' }, { status: 400 });
  try { return NextResponse.json(await rfqStatus(id)); } catch (e: any) { return NextResponse.json({ error: String(e.message ?? e) }, { status: 502 }); }
}
