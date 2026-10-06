import 'server-only';
import fs from 'node:fs'; import path from 'node:path';
import type { Manifest, Pool } from './types';
const dir = path.join(process.cwd(), 'public', 'data');
export const manifest = (): Manifest => JSON.parse(fs.readFileSync(path.join(dir, 'pools.json'), 'utf8'));
export const pool = (id: string): Pool => JSON.parse(fs.readFileSync(path.join(dir, 'pools', `${id}.json`), 'utf8'));
