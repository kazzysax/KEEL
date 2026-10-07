import 'server-only';
import fs from 'node:fs'; import path from 'node:path';
import type { Manifest, Pool } from './types';
const dir = path.join(process.cwd(), 'public', 'data');
export const manifest = (): Manifest => JSON.parse(fs.readFileSync(path.join(dir, 'pools.json'), 'utf8'));
export const pool = (id: string): Pool => {
  if (!/^[A-Z]\d{1,3}$/.test(id)) throw new Error('Unknown pool');
  const file = id.startsWith('C') ? path.join(dir, 'community', 'pools', `${id}.json`) : path.join(dir, 'pools', `${id}.json`);
  if (!fs.existsSync(file)) throw new Error('Unknown pool');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

// ---- data for grade previews (cached in memory; files change at most daily) ----
let _prev: { at: number; history: any; rules: any; taken: string[][]; ids: string[] } | null = null;
export function previewData() {
  if (_prev && Date.now() - _prev.at < 5 * 60_000) return _prev;
  const rd = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  let com: string[][] = []; let comIds: string[] = []; try { const c = rd('community/pools.json').pools; com = c.map((p: any) => p.legs); comIds = c.map((p: any) => p.id); } catch { /* no community file yet */ }
  _prev = { at: Date.now(), history: rd('history.json'), rules: rd('rules.json'), taken: [...manifest().pools.map(p => p.legs), ...com], ids: [...manifest().pools.map(p => p.id), ...comIds] };
  return _prev;
}
