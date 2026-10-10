import { NextResponse } from 'next/server';
import { suggest } from '@/lib/analyze';
export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const CORS = { 'access-control-allow-origin': '*' };
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get('asset') ?? '';
  try { return NextResponse.json({ asset: t.toUpperCase(), pairs: await suggest(t) }, { headers: CORS }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400, headers: CORS }); }
}
