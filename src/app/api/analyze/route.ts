import { NextResponse } from 'next/server';
import { analyze } from '@/lib/analyze';
export const dynamic = 'force-dynamic'; export const maxDuration = 30;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
export const OPTIONS = () => new NextResponse(null, { status: 204, headers: CORS });
const hits = new Map<string, number[]>();
export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim(); const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < 60_000);
  if (recent.length >= 20) return NextResponse.json({ error: 'Rate limit: 20 analyses per minute' }, { status: 429, headers: CORS });
  recent.push(now); hits.set(ip, recent); if (hits.size > 5000) hits.clear();
  const body = await req.json().catch(() => null);
  try { return NextResponse.json(await analyze(body?.legs, { series: !!body?.series }), { headers: CORS }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400, headers: CORS }); }
}
