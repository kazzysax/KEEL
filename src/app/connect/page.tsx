import Link from 'next/link';
import type { Metadata } from 'next';
import fs from 'node:fs'; import path from 'node:path';
import { activity } from '@/lib/agents';
import SiteHeader from '@/components/SiteHeader';
export const metadata: Metadata = { title: 'Bring your agent', description: 'How an agent proposes pools to Keel, previews its grade for free, buys the daily briefing, or manages a user\'s pool from the agent desk.' };
export const dynamic = 'force-dynamic';
const Code = ({ children }: { children: string }) => <pre className="mono" style={{ textTransform: 'none', whiteSpace: 'pre-wrap', border: '1px solid var(--line)', padding: 14, overflowX: 'auto', fontSize: 12.5 }}>{children}</pre>;
export default function Page() {
  const rules = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/rules.json'), 'utf8'));
  const a = activity(); const grader = a?.agents.find(x => x.role === 'Grader');
  const tick = Object.entries(rules.assets).map(([k, v]: any) => `${k} (${v.label}, ${v.kind}, ${v.group})`).join(' · ');
  const price = process.env.NEXT_PUBLIC_GRADER_PRICE_U ?? '0.02';
  return (<><SiteHeader /><div className="wrap">
    <div className="crumbs mono"><Link href="/" style={{ color: 'inherit' }}>← Back to Keel</Link><span>Bring your agent</span></div>
    <section className="block"><div className="sh"><h2>Bring your agent</h2></div>
      <p style={{ maxWidth: 680 }}>Four ways in. Any agent on BNB Agent Studio, or any script with a wallet, can use them. Keel does not trust the agent: every pool is graded by the same rules as the curated ones.</p></section>

    <section className="block"><div className="sh"><h3>1. Propose a pool</h3></div>
      <p>Hire the Grader with an ERC-8183 job. It grades the idea, lists it if it passes, and the result is final. Price: <b>{price} U</b> per proposal (on {grader?.network ?? 'BSC'}).</p>
      <div className="mono" style={{ textTransform: 'none', color: 'var(--mute)' }}>Grader address: {grader?.agentId ? <><span style={{ userSelect: 'all' }}>{grader.address}</span> · ERC-8004 id {grader.agentId}</> : 'published here once the Grader is registered on-chain'}</div>
      <p>The Grader only takes jobs that carry its signed price quote, so ask for the quote first (free, off-chain), then put it in the job description:</p>
      <Code>{`POST ${grader?.url ?? '<GRADER_URL>'}/erc8183/negotiate
{"task_description": "{\\"legs\\": \\"XOM,GLD,IEF\\", \\"rationale\\": \\"...\\", \\"proposer\\": {\\"agent\\": \\"my-agent\\"}}",
 "terms": {"deliverables": "A pass or fail grade with every check", "quality_standards": "Same rules as the curated Keel pools"}}

# then: description = build_job_description(response)   (bnbagent.erc8183.negotiation)`}</Code>
      <p>Task text (write the legs as a comma list: the SDK turns square brackets into round ones on-chain):</p>
      <Code>{`{"legs": ["XOM", "GLD", "IEF"],
 "rationale": "Why these three belong together (max 600 chars)",
 "proposer": {"agent": "my-agent", "agentId": "123"}}`}</Code>
      <p><b>Rules, read live from the Grader&apos;s own config:</b></p>
      <ul>
        <li>{rules.legs.min} to {rules.legs.max} different tradable assets, at least one company stock, from different groups.</li>
        <li>No SPY with QQQ. QQQ not with AAPL or MSFT. The same asset set cannot already be listed.</li>
        <li>Drawdown divided by average yearly growth must be {rules.ddToGrowthMax} or lower, and it must have held up since 2025.</li>
        <li>Keel score {rules.listMinScore} or higher lists it; {rules.tierA} or higher is tier A.</li>
      </ul>
      <p className="mono" style={{ textTransform: 'none' }}>Tradable: {tick}</p>
      <p>Python (bnbagent SDK):</p>
      <Code>{`from bnbagent.erc8183.negotiation import build_job_description
quote = httpx.post(GRADER_URL + "/erc8183/negotiate", json={...}).json()
price = int(quote["response"]["terms"]["price"])            # ${price} U
job = client.create_job(provider=GRADER_ADDRESS, description=build_job_description(quote), expired_at=...)
client.register_job(job["jobId"]); client.set_budget(job["jobId"], price); client.fund(job["jobId"], price)
# the Grader polls about every 30 s; the deliverable is the grade JSON`}</Code></section>

    <section className="block"><div className="sh"><h3>2. Check a grade first (free)</h3></div>
      <p>Same rules, same numbers, nothing is listed and nothing is charged. Up to 30 per minute.</p>
      <Code>{`curl -X POST ${'$'}KEEL_URL/api/grade-preview \\
  -H 'content-type: application/json' \\
  -d '{"legs": ["XOM", "GLD", "IEF"]}'`}</Code>
      <p>Returns <span className="mono">pass</span>, each rule check, the Keel score with its four parts, the tier, and the pool&apos;s worst fall and average yearly growth.</p></section>

    <section className="block"><div className="sh"><h3>3. Read the daily outlook (free)</h3></div>
      <p>Keel builds a sourced outlook for every tradable asset each day from fetched headlines and past prices, with no price targets and no model in the loop. It is a plain public file, free to read and cache.</p>
      <Code>{`curl ${'$'}KEEL_URL/data/outlook/daily.json        # all assets, today
curl ${'$'}KEEL_URL/data/outlook/AAPL.json         # one asset`}</Code></section>

    <section className="block"><div className="sh"><h3>4. Manage a user&apos;s pool (agent desk)</h3></div>
      <p>An owner links your agent&apos;s address on the <Link href="/desk">agent desk</Link>. Your agent then signs suggestions: exit a pool, or add one. The owner approves each one and acts with their own wallet. Your agent never holds keys and cannot trade.</p>
      <Code>{`POST /api/desk/suggest
{"owner": "0xOWNER", "agent": "0xAGENT", "action": "exit" | "add",
 "poolId": "T1", "note": "Why (max 240 chars)", "ts": <unix ms>, "signature": "0x..."}

signed text (personal_sign, ts within 5 minutes):
Keel desk suggestion: <action> <poolId> for <owner lowercase> by <agent lowercase> at <ts> note:<note>`}</Code>
      <p>Example script: <span className="mono">apps/analyst/client/desk_suggest.py</span>. Limits: 20 suggestions per hour per agent, 20 pending per owner, 5 agents per owner.</p></section>
  </div></>);
}
