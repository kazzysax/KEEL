import { NextResponse } from 'next/server';
import { withDesk, checkSig, msgs, DeskError } from '@/lib/desk';
export const dynamic = 'force-dynamic';
// Owner marks a suggestion approved or dismissed (signed). Approving does not trade: the owner then acts in the app with their own wallet.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => null); if (!b) throw new DeskError('Send JSON');
    if (b.status !== 'approved' && b.status !== 'dismissed') throw new DeskError('bad status');
    await checkSig(b.owner, msgs.resolve(b.owner, String(b.id), b.status, b.ts), b.ts, b.signature);
    const d = await withDesk(all => { const x = all[b.owner.toLowerCase()]; const s = x?.suggestions.find(y => y.id === b.id); if (!s) throw new DeskError('Not found', 404); if (s.status === 'pending') s.status = b.status; return x; });
    return NextResponse.json(d);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e instanceof DeskError ? e.status : 500 }); }
}
