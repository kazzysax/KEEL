import { NextResponse } from 'next/server';
import { readDesk } from '@/lib/desk';
export const dynamic = 'force-dynamic';
// Public read by wallet address (like any on-chain address, suggestions are not private).
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get('owner') ?? '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return NextResponse.json({ error: 'owner must be a wallet address' }, { status: 400 });
  return NextResponse.json(await readDesk(owner));
}
