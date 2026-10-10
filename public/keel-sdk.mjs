// Keel SDK: a zero-dependency client for the Keel analysis API. Works in Node 18+, Deno, Bun and browsers.
// import { Keel } from 'https://keel-io.vercel.app/keel-sdk.mjs';
export class Keel {
  constructor(base = 'https://keel-io.vercel.app') { this.base = base.replace(/\/$/, ''); }
  async #j(path, init) { const r = await fetch(this.base + path, init); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j; }
  /** Find supported assets. kind: 'stock' | 'etf' | 'crypto'. Each result lists its venues and token addresses. */
  search(query = '', { kind, limit = 25 } = {}) { return this.#j(`/api/universe?q=${encodeURIComponent(query)}${kind ? `&kind=${kind}` : ''}&limit=${limit}`); }
  /** Grade a pair or trio, for example ['BTC', 'NVDA']. Returns score, tier, checks, figures and venues. */
  analyze(legs, { series = false } = {}) { return this.#j('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ legs, series }) }); }
  /** Best-graded partners for one asset. */
  suggest(asset) { return this.#j(`/api/suggest?asset=${encodeURIComponent(asset)}`); }
}
