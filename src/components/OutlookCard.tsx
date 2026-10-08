'use client';
import { useEffect, useState } from 'react';
type R = { kind: string; text: string; sourceUrl: string | null; publishedAt: string | null };
type O = { ticker: string; name: string; outlook: 'Positive' | 'Neutral' | 'Cautious'; reasons: R[]; historical12m: { p5: number; p50: number; p95: number; min: number; max: number }; asOf: string; priceAsOf: string; disclaimer: string };
const pct = (v: number) => (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%';
const col = { Positive: 'var(--ok)', Neutral: 'var(--mute)', Cautious: 'var(--acc)' } as const;
export default function OutlookCard({ legs, labels }: { legs: string[]; labels: Record<string, string> }) {
  const [data, setData] = useState<Record<string, O | null>>({});
  const [agent, setAgent] = useState<{ agentId?: string; registry?: string; explorer?: string } | null>(null);
  useEffect(() => {
    legs.forEach(l => fetch(`/data/outlook/${l}.json`).then(r => (r.ok ? r.json() : null)).then(o => setData(d => ({ ...d, [l]: o }))).catch(() => setData(d => ({ ...d, [l]: null }))));
    fetch('/data/outlook/agent.json').then(r => (r.ok ? r.json() : null)).then(setAgent).catch(() => {});
  }, [legs.join()]); // eslint-disable-line
  return (<div style={{ marginTop: 24 }}>
    <div className="mono" style={{ color: 'var(--mute)', marginBottom: 10 }}>Agent outlook · sourced, no price targets</div>
    <div style={{ border: '1px solid var(--line)' }}>
      {legs.map(l => { const o = data[l]; return (<div key={l} style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <b style={{ fontStretch: '75%', fontSize: 18, textTransform: 'uppercase' }}>{labels[l]}</b>
          {o ? <span className="mono" style={{ color: col[o.outlook], fontWeight: 700 }}>● {o.outlook}</span> : <span className="mono" style={{ color: 'var(--mute)' }}>{o === null ? 'unavailable' : '…'}</span>}
        </div>
        {o && <>
          <ul style={{ margin: '8px 0 6px', paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
            {o.reasons.map((r, i) => <li key={i}>{r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{r.text}</a> : r.text}{r.kind === 'news' && r.publishedAt ? <span className="mono" style={{ color: 'var(--mute)' }}> · {String(r.publishedAt).slice(0, 10)}</span> : null}</li>)}
          </ul>
          <div className="mono" style={{ color: 'var(--mute)', textTransform: 'none' }}>Any past 12 months: typical {pct(o.historical12m.p5)} to {pct(o.historical12m.p95)} · worst {pct(o.historical12m.min)} · best {pct(o.historical12m.max)} · prices to {o.priceAsOf}</div>
        </>}
      </div>); })}
      <div className="note" style={{ margin: 0, padding: '10px 16px' }}>Automated summary of linked sources and past prices. Not investment advice.{agent?.agentId ? <> Produced by the Keel Analyst agent, ERC-8004 id <a href={agent.explorer} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{agent.agentId}</a>.</> : <> Analyst agent identity not yet registered on-chain.</>}</div>
    </div>
  </div>);
}
