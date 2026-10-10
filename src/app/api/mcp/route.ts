import { NextResponse } from 'next/server';
import { analyze, search, suggest, universe } from '@/lib/analyze';
export const dynamic = 'force-dynamic'; export const maxDuration = 45;
// Model Context Protocol server over HTTP (stateless JSON-RPC). Any MCP client can connect to https://<site>/api/mcp
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, GET, OPTIONS', 'access-control-allow-headers': 'content-type, mcp-session-id, accept' };
export const OPTIONS = () => new NextResponse(null, { status: 204, headers: CORS });
export const GET = () => NextResponse.json({ name: 'keel', note: 'MCP endpoint. POST JSON-RPC here.' }, { headers: CORS });

const TOOLS = [
  { name: 'search_assets', description: 'Find supported assets by ticker or name. Crypto plus tokenized stocks and ETFs (Ondo, xStocks, bStocks). Returns the venue and token address for execution.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, kind: { type: 'string', enum: ['stock', 'etf', 'crypto'] }, limit: { type: 'number' } } } },
  { name: 'analyze_pair', description: 'Grade a pair or trio of assets (2 or 3 tickers, equal weight). Returns the Keel score, tier, pass/fail checks, drawdown, yearly growth and offset, plus the token venues for execution. Analysis only.',
    inputSchema: { type: 'object', properties: { legs: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 }, series: { type: 'boolean' } }, required: ['legs'] } },
  { name: 'suggest_pairs', description: 'Given one asset, return the best-graded partners from about 45 liquid crypto, stocks, funds, gold and bonds.',
    inputSchema: { type: 'object', properties: { asset: { type: 'string' }, count: { type: 'number' } }, required: ['asset'] } },
];
const text = (v: unknown, isError = false) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }], isError });

async function call(name: string, a: any) {
  try {
    if (name === 'search_assets') return text({ total: universe().length, assets: search(a?.query ?? '', a?.kind, Math.min(100, a?.limit ?? 25)) });
    if (name === 'analyze_pair') return text(await analyze(a?.legs, { series: !!a?.series }));
    if (name === 'suggest_pairs') return text({ asset: String(a?.asset).toUpperCase(), pairs: await suggest(String(a?.asset), Math.min(15, a?.count ?? 8)) });
    return text(`Unknown tool ${name}`, true);
  } catch (e: any) { return text(e.message, true); }
}

export async function POST(req: Request) {
  const msg = await req.json().catch(() => null);
  const one = async (m: any) => {
    if (!m || typeof m !== 'object') return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } };
    const { id, method, params } = m;
    if (id === undefined) return null; // notification
    if (method === 'initialize') return { jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion ?? '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'keel', version: '1.0.0' } } };
    if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
    if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    if (method === 'tools/call') return { jsonrpc: '2.0', id, result: await call(params?.name, params?.arguments) };
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  };
  const out = Array.isArray(msg) ? (await Promise.all(msg.map(one))).filter(Boolean) : await one(msg);
  if (out === null || (Array.isArray(out) && !out.length)) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(out, { headers: CORS });
}
