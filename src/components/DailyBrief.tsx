'use client';
import { useEffect, useState } from 'react';
type R = { kind: string; text: string; sourceUrl: string | null };
type O = { ticker: string; name: string; outlook: 'Positive' | 'Neutral' | 'Cautious'; reasons: R[] };
type D = { date: string; agent: string; priceAsOf: string; pricesRefreshed: boolean; counts: Record<'Positive' | 'Neutral' | 'Cautious', number>; outlooks: O[] };
const col = { Positive: 'var(--ok)', Neutral: 'var(--mute)', Cautious: 'var(--acc)' } as const;
export default function DailyBrief() {
  const [d, setD] = useState<D | null>(null);
  useEffect(() => { fetch('/data/outlook/daily.json').then(r => (r.ok ? r.json() : null)).then(j => setD(j && Array.isArray(j.outlooks) ? j : null)).catch(() => setD(null)); }, []);
  if (!d) return null;
  return (<section className="block brief" id="outlook">
    <div className="sh"><h2>Today’s outlook</h2><span className="mono" style={{ color: 'var(--mute)' }}>{d.date} · by {d.agent ?? 'keel-analyst'}, published automatically each day</span></div>
    <div className="bcounts mono">{(['Positive', 'Neutral', 'Cautious'] as const).map(k => <span key={k} style={{ color: col[k] }}><b>{d.counts?.[k] ?? d.outlooks.filter(o => o.outlook === k).length}</b>{k}</span>)}</div>
    <div className="bgrid">{d.outlooks.map(o => <details className="bcell" key={o.ticker}>
      <summary><b style={{ fontStretch: '75%', fontSize: 17, textTransform: 'uppercase' }}>{o.name}</b><span className="mono" style={{ color: col[o.outlook], fontWeight: 700, whiteSpace: 'nowrap' }}>● {o.outlook}</span></summary>
      <ul>{o.reasons.map((r, i) => <li key={i}>{r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{r.text}</a> : r.text}</li>)}</ul>
    </details>)}</div>
    <div className="mono" style={{ color: 'var(--mute)', marginTop: 14, textTransform: 'none' }}>Prices to {d.priceAsOf}{d.pricesRefreshed === false && ' · Price refresh unavailable, showing last closes'}</div>
    <div className="note">Outlooks summarise sources and past prices. No price targets. Not investment advice.</div>
  </section>);
}
