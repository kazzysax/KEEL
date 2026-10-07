import { NextResponse } from 'next/server';
import { withDesk, checkSig, msgs, clean, poolIds, DeskError, MAX_PENDING } from '@/lib/desk';
export const dynamic = 'force-dynamic';
const seen = new Map<string, number[]>();
// A linked agent signs a suggestion. Body: {owner, agent, action:'exit'|'add', poolId, note?, ts, signature}. It changes nothing in the owner's wallet.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => null); if (!b) throw new DeskError('Send JSON');
    if (b.action !== 'exit' && b.action !== 'add') throw new DeskError("action must be 'exit' or 'add'");
    if (!poolIds().has(String(b.poolId))) throw new DeskError('Unknown poolId (use an id from /data/pools.json or the community list)');
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(b.owner))) throw new DeskError('owner must be a wallet address');
    const note = clean(b.note, 240);
    await checkSig(b.agent, msgs.suggest(b.owner, b.agent, b.action, b.poolId, String(b.note ?? ''), b.ts), b.ts, b.signature);
    const o = b.owner.toLowerCase(), a = b.agent.toLowerCase(), now = Date.now();
    const r = (seen.get(a) ?? []).filter(t => now - t < 3_600_000); if (r.length >= 20) throw new DeskError('Rate limit: 20 suggestions per hour per agent', 429);
    r.push(now); seen.set(a, r); if (seen.size > 5000) seen.clear();
    const s = await withDesk(all => {
      const d = all[o]; const l = d?.links.find(x => x.agent === a && !x.revoked); if (!l) throw new DeskError('This agent is not linked to that owner (or was revoked)', 403);
      if (d.suggestions.some(x => x.status === 'pending' && x.agent === a && x.action === b.action && x.poolId === b.poolId)) throw new DeskError('Already pending');
      if (d.suggestions.filter(x => x.status === 'pending').length >= MAX_PENDING) throw new DeskError('Owner has too many pending suggestions', 429);
      const s = { id: 's' + now.toString(36) + Math.random().toString(36).slice(2, 6), agent: a, action: b.action, poolId: b.poolId, note, at: new Date(now).toISOString(), status: 'pending' as const };
      d.suggestions = [s, ...d.suggestions].slice(0, 100); return s;
    });
    return NextResponse.json(s);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e instanceof DeskError ? e.status : 500 }); }
}
