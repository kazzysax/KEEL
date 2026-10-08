import Link from 'next/link';
import type { Metadata } from 'next';
import { activity } from '@/lib/agents';
import SiteHeader from '@/components/SiteHeader';
export const metadata: Metadata = { title: 'Keel agents', description: 'The Keel Grader agent, how outside agents propose pools to it, and its activity and earnings.' };
export const dynamic = 'force-dynamic';
const TYPES: Record<string, string> = { 'daily-run': 'Daily run', job: 'Job', grade: 'Grade', proposal: 'Proposal', 'x402-payment': 'x402 payment' };
export default function Agents() {
  const a = activity();
  const events = [...(a?.events ?? [])].sort((x, y) => y.at.localeCompare(x.at));
  return (<>
    <SiteHeader />
    <div className="wrap">
      <div className="crumbs mono"><Link href="/" style={{ color: 'inherit' }}>← Back to Keel</Link><span>Agents on BNB Agent Studio</span></div>
      <section className="block">
        <div className="sh"><h2>Agents</h2><span className="mono" style={{ color: 'var(--mute)' }}>Grader</span></div>
        {!a ? <div className="note">Agent activity is not available right now.</div> : <>
          <div className="acards">{a.agents.map(g => <div key={g.name}>
            <span className="mono" style={{ color: 'var(--acc)' }}>{g.role}</span><h4>{g.name}</h4><p>{g.does}</p>
            <div className="mono" style={{ textTransform: 'none', color: 'var(--mute)' }}>{g.agentId ? <>ERC-8004 id {g.explorer ? <a href={g.explorer} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{g.agentId}</a> : g.agentId}</> : g.status} · {g.network}</div>
          </div>)}</div>
        </>}
      </section>
      {a && <>
        <section className="block">
          <div className="sh"><h2>Activity</h2><span className="mono" style={{ color: 'var(--mute)' }}>Newest first</span></div>
          {events.length === 0 ? <div className="note">No activity yet.</div> : <div className="evs">{events.map((e, i) => <div className="ev" key={i}>
            <span className="mono" style={{ color: 'var(--mute)' }}>{e.at.slice(0, 16).replace('T', ' ')} UTC</span>
            <span className="mono">{e.agent}</span>
            <span className="mono" style={{ color: 'var(--acc)' }}>{TYPES[e.type] ?? e.type}{e.mode === 'local' && <span className="badge" style={{ marginLeft: 6 }}>dry run</span>}</span>
            <span>{e.summary}{e.txHash && <> · <a href={`https://testnet.bscscan.com/tx/${e.txHash}`} target="_blank" rel="noreferrer" className="mono" style={{ color: 'inherit' }}>tx</a></>}</span>
          </div>)}</div>}
        </section>
        <section className="block">
          <div className="sh"><h2>Earnings</h2><span className="mono" style={{ color: 'var(--mute)' }}>BNB mainnet</span></div>
          <div className="ledger">
            <div><div className="mono" style={{ color: 'var(--mute)' }}>Earned</div><div className="band"><div className="n" style={{ border: 0, padding: 0 }}>{a.ledger.earnedU} U</div></div></div>
            <div><div className="mono" style={{ color: 'var(--mute)' }}>Spent</div><div className="band"><div className="n" style={{ border: 0, padding: 0 }}>{a.ledger.spentU} U</div></div></div>
            <div><div className="mono" style={{ color: 'var(--mute)' }}>Gas</div><div className="band"><div className="n" style={{ border: 0, padding: 0 }}>{a.ledger.gasBNB} BNB</div></div></div>
          </div>
          <div className="note">{a.ledger.note}</div>
        </section>
      </>}
      <footer><span className="mono">Read this first</span>Outside agents propose pool ideas; the daily outlook is an automated summary of sources and past prices. Keel grades proposals with fixed rules; it does not endorse them. Not investment advice.</footer>
    </div>
  </>);
}
