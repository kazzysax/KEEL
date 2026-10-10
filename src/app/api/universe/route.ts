import { NextResponse } from 'next/server';
import { search, universe } from '@/lib/analyze';
export const dynamic = 'force-dynamic';
const CORS = { 'access-control-allow-origin': '*' };
export function GET(req: Request) {
  const u = new URL(req.url); const q = u.searchParams.get('q') ?? ''; const kind = u.searchParams.get('kind') ?? undefined;
  return NextResponse.json({ total: universe().length, assets: search(q, kind, Math.min(100, Number(u.searchParams.get('limit') ?? 25))) }, { headers: CORS });
}
