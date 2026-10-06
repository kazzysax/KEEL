import 'server-only';
import { Web3Wallet } from '@binance-web3/wallet';

export const DEMO = process.env.DEMO_MODE !== '0' || !process.env.BINANCE_WEB3_API_KEY;
let client: Web3Wallet | null = null;
export function api() {
  if (!client) {
    client = new Web3Wallet({
      configurationRestAPI: {
        apiKey: process.env.BINANCE_WEB3_API_KEY!, apiSecret: process.env.BINANCE_WEB3_API_SECRET!,
        basePath: process.env.BINANCE_WEB3_BASE || 'https://web3.binance.com/build', timeout: 15000,
      } as any,
    });
  }
  return client.restAPI;
}

// One paced queue: RWA endpoints share ~3 req/s, aggregator ~4/s (reported by other builders). Single-flight + 30s cache.
let chain: Promise<unknown> = Promise.resolve();
const cache = new Map<string, { t: number; v: unknown }>();
export function paced<T>(key: string, fn: () => Promise<T>, ttl = 30_000): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return Promise.resolve(hit.v as T);
  const p = chain.then(() => new Promise(r => setTimeout(r, 300))).then(async () => {
    const v = await fn(); cache.set(key, { t: Date.now(), v }); return v;
  });
  chain = p.catch(() => undefined);
  return p;
}
// Binance returns errors inside HTTP 200: always check `code`.
export async function unwrap<T extends { code?: number | string; msg?: string; data?: any }>(r: { data: () => Promise<T> }) {
  const body = await r.data();
  const code = String(body.code ?? '000000');
  if (code !== '0' && code !== '000000' && code !== '200') throw new Error(`Binance ${code}: ${body.msg ?? 'error'}`);
  return body.data;
}
