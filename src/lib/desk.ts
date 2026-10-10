import 'server-only';
import fs from 'node:fs'; import path from 'node:path';
import { verifyMessage, isAddress, getAddress } from 'viem';
import { previewData } from './pools';
// Agent desk: an owner links an agent address; the agent can only leave signed SUGGESTIONS. It never holds keys or moves funds.
export type Link = { agent: string; label: string; at: string; revoked?: boolean };
export type Suggestion = { id: string; agent: string; action: 'exit' | 'add'; poolId: string; note: string; at: string; status: 'pending' | 'approved' | 'dismissed' };
export type Desk = { links: Link[]; suggestions: Suggestion[] };
export const MAX_PENDING = 20, MAX_AGENTS = 5, WINDOW_MS = 5 * 60_000;
const UP = process.env.UPSTASH_REDIS_REST_URL, TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const FILE = path.join(process.env.KEEL_DESK_DIR ?? path.join(process.cwd(), '.agent-data'), 'desk.json');
const cmd = async (a: (string | number)[]) => (await (await fetch(UP!, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(a) })).json()).result;
const readAll = async (): Promise<Record<string, Desk>> => UP ? JSON.parse((await cmd(['GET', 'keel:desk'])) ?? '{}') : (() => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } })();
const writeAll = async (d: Record<string, Desk>) => { if (UP) await cmd(['SET', 'keel:desk', JSON.stringify(d)]); else { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d)); } };
let chain: Promise<unknown> = Promise.resolve(); // serialise writes within one instance
export const withDesk = <T,>(fn: (all: Record<string, Desk>) => T | Promise<T>): Promise<T> => { const r = chain.then(async () => { const all = await readAll(); const out = await fn(all); await writeAll(all); return out; }); chain = r.catch(() => {}); return r; };
export const readDesk = async (owner: string): Promise<Desk> => (await readAll())[owner.toLowerCase()] ?? { links: [], suggestions: [] };

export class DeskError extends Error { constructor(msg: string, public status = 400) { super(msg); } }
export const msgs = {
  link: (owner: string, agent: string, ts: number) => `Keel desk: link agent ${agent.toLowerCase()} to ${owner.toLowerCase()} at ${ts}`,
  revoke: (owner: string, agent: string, ts: number) => `Keel desk: revoke agent ${agent.toLowerCase()} from ${owner.toLowerCase()} at ${ts}`,
  suggest: (owner: string, agent: string, action: string, poolId: string, note: string, ts: number) => `Keel desk suggestion: ${action} ${poolId} for ${owner.toLowerCase()} by ${agent.toLowerCase()} at ${ts} note:${note}`,
  resolve: (owner: string, id: string, status: string, ts: number) => `Keel desk: ${status} ${id} for ${owner.toLowerCase()} at ${ts}`,
};
export async function checkSig(address: unknown, message: string, ts: unknown, signature: unknown) {
  if (typeof address !== 'string' || !isAddress(address)) throw new DeskError('Bad address');
  if (typeof ts !== 'number' || Math.abs(Date.now() - ts) > WINDOW_MS) throw new DeskError('Signature expired: sign again (must be within 5 minutes)');
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signature)) throw new DeskError('Bad signature');
  let ok = false; try { ok = await verifyMessage({ address: getAddress(address), message, signature: signature as `0x${string}` }); } catch { /* bad sig */ }
  if (!ok) throw new DeskError('Signature does not match the address', 401);
}
export const poolIds = () => new Set<string>(previewData().ids);
export const clean = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, n);
