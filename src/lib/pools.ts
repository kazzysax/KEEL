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
