import { NextResponse } from 'next/server';
import { withDesk, checkSig, msgs, clean, DeskError, MAX_AGENTS } from '@/lib/desk';
export const dynamic = 'force-dynamic';
// Owner signs in their wallet to link (or revoke) an agent address. Body: {owner, agent, label?, revoke?, ts, signature}
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => null); if (!b) throw new DeskError('Send JSON');
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(b.agent))) throw new DeskError('agent must be a wallet address');
    await checkSig(b.owner, b.revoke ? msgs.revoke(b.owner, b.agent, b.ts) : msgs.link(b.owner, b.agent, b.ts), b.ts, b.signature);
    const o = b.owner.toLowerCase(), a = b.agent.toLowerCase();
    if (o === a) throw new DeskError('The agent must have its own key, separate from your wallet');
    const out = await withDesk(all => {
      const d = all[o] ??= { links: [], suggestions: [] }; const ex = d.links.find(l => l.agent === a);
      if (b.revoke) { if (ex) ex.revoked = true; d.suggestions = d.suggestions.map(s => s.agent === a && s.status === 'pending' ? { ...s, status: 'dismissed' } : s); return d; }
      if (!ex && d.links.filter(l => !l.revoked).length >= MAX_AGENTS) throw new DeskError(`At most ${MAX_AGENTS} linked agents`);
      if (ex) { ex.revoked = false; ex.label = clean(b.label, 40) || ex.label; } else d.links.push({ agent: a, label: clean(b.label, 40) || 'My agent', at: new Date().toISOString() });
      return d;
    });
    return NextResponse.json(out);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e instanceof DeskError ? e.status : 500 }); }
}
