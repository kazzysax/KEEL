import { NextResponse } from 'next/server';
import { gradeProposal } from '@/lib/grade';
import { previewData } from '@/lib/pools';
export const dynamic = 'force-dynamic';
// Free, public, read-only: what grade would this pool idea get? Does not list anything (listing happens only through the Grader agent).
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const hits = new Map<string, number[]>(); const LIMIT = 30, WINDOW = 60_000; // per IP per minute; per server instance, so best effort on serverless
export const OPTIONS = () => new NextResponse(null, { status: 204, headers: CORS });
export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim(); const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW); if (recent.length >= LIMIT) return NextResponse.json({ error: 'Rate limit: 30 previews per minute' }, { status: 429, headers: { ...CORS, 'retry-after': '30' } });
  recent.push(now); hits.set(ip, recent); if (hits.size > 5000) hits.clear();
  const body = await req.json().catch(() => null);
  const d = previewData(); const g = gradeProposal(body?.legs, d.history, d.rules, d.taken);
  return NextResponse.json({ preview: true, note: 'Preview only. A pool is listed only when the Keel Grader agent accepts a funded job; its result is final.', ...g }, { headers: CORS });
}
