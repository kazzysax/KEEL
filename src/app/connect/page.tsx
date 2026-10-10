import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import { activity } from '@/lib/agents';
export const metadata: Metadata = { title: 'For agents', description: 'Use Keel\'s pair analysis from your agent over MCP or the SDK. Analysis only; your agent executes.' };
export const dynamic = 'force-dynamic';
const Code = ({ children }: { children: string }) => <pre className="mono" style={{ textTransform: 'none', whiteSpace: 'pre-wrap', border: '1px solid var(--line)', padding: 14, overflowX: 'auto', fontSize: 12.5 }}>{children}</pre>;
export default function Page() {
  const a = activity(); const grader = a?.agents.find(x => x.role === 'Grader');
  const price = process.env.NEXT_PUBLIC_GRADER_PRICE_U ?? '0.02';
  return (<><SiteHeader /><div className="wrap">
    <div className="crumbs mono"><Link href="/" style={{ color: 'inherit' }}>← Back to Keel</Link><span>For agents</span></div>
    <section className="block"><div className="sh"><h2>Use Keel from your agent</h2></div>
      <p style={{ maxWidth: 700 }}>Keel gives your agent the analysis: which crypto and tokenized stocks or funds (Ondo, xStocks, bStocks) pair well, how a pair has behaved since 2020, and where each asset trades with its token address. Your agent executes with its own wallet. Keel never holds funds.</p>
    </section>
    <section className="block"><div className="sh"><h3>MCP or SDK: which one</h3></div>
      <p style={{ maxWidth: 700 }}><b>MCP</b> is for agents that already speak the Model Context Protocol (Claude, Cursor, many agent frameworks). You paste one URL and the model sees Keel as tools it can call by itself. No code. <b>The SDK</b> is for code you write: your own script or agent calls plain functions and handles the results. Same analysis behind both.</p>
    </section>
    <section className="block"><div className="sh"><h3>1. MCP</h3></div>
      <p>Endpoint (add as a remote MCP server):</p>
      <Code>{`https://keel-io.vercel.app/api/mcp`}</Code>
      <p>Tools: <span className="mono">search_assets</span>, <span className="mono">analyze_pair</span>, <span className="mono">suggest_pairs</span>. Try it by hand:</p>
      <Code>{`curl -s https://keel-io.vercel.app/api/mcp -H 'content-type: application/json' \\
 -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze_pair","arguments":{"legs":["BTC","GLD"]}}}'`}</Code>
    </section>
    <section className="block"><div className="sh"><h3>2. SDK</h3></div>
      <Code>{`import { Keel } from 'https://keel-io.vercel.app/keel-sdk.mjs';
const keel = new Keel();
const hits  = await keel.search('nvidia');            // find assets, venues, token addresses
const grade = await keel.analyze(['BTC', 'NVDA']);     // score, tier, checks, figures
const ideas = await keel.suggest('TSLA');              // best partners for one asset
if (grade.pass) { /* execute with your own wallet, using grade.assets[i].venues */ }`}</Code>
      <p>Plain HTTP works too: <span className="mono">POST /api/analyze</span> with <span className="mono">{`{"legs":["BTC","NVDA"]}`}</span>, <span className="mono">GET /api/universe?q=</span>, <span className="mono">GET /api/suggest?asset=</span>. Free, no key, 20 analyses per minute.</p>
    </section>
    <section className="block"><div className="sh"><h3>3. Get a pair listed (on-chain)</h3></div>
      <p>To have a pair listed on the site with a verified grade, hire the Grader agent with an ERC-8183 job. Price: <b>{price} U</b> per proposal. Result is final.</p>
      <div className="mono" style={{ textTransform: 'none', color: 'var(--mute)' }}>Grader: {grader?.agentId ? <><span style={{ userSelect: 'all' }}>{grader.address}</span> · ERC-8004 id {grader.agentId}</> : 'not available right now'}</div>
    </section>
    <footer><span className="mono">Read this first</span>Analysis from past prices; not advice and not a prediction. Keel does not trade or hold funds.</footer>
  </div></>);
}
