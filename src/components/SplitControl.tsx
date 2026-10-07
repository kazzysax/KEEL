'use client';
// "Your split": choose how much goes into each asset. Every leg keeps at least 5%.
const MIN = 5;
export function rebalance(cur: number[], i: number, v: number): number[] {
  const n = cur.length; v = Math.min(Math.max(Math.round(v), MIN), 100 - MIN * (n - 1));
  const others = cur.map((x, j) => (j === i ? 0 : x)); const sum = others.reduce((a, b) => a + b, 0) || 1; const rest = 100 - v;
  let next = cur.map((x, j) => (j === i ? v : (x / sum) * rest));
  for (let k = 0; k < 3; k++) { // lift anything under the minimum, take it back proportionally from the others
    const low = next.map((x, j) => (j !== i && x < MIN ? j : -1)).filter(j => j >= 0); if (!low.length) break;
    const need = low.reduce((s, j) => s + (MIN - next[j]), 0); const free = next.reduce((s, x, j) => s + (j !== i && !low.includes(j) ? x - MIN : 0), 0) || 1;
    next = next.map((x, j) => (j === i ? x : low.includes(j) ? MIN : x - ((x - MIN) / free) * need));
  }
  const r = next.map((x, j) => (j === i ? v : Math.round(x))); r[r.findIndex((_, j) => j !== i)] += 100 - r.reduce((a, b) => a + b, 0); return r;
}
export default function SplitControl({ legs, labels, pct, onChange, custom }: { legs: string[]; labels: Record<string, string>; pct: number[]; onChange: (p: number[]) => void; custom: boolean }) {
  const equal = legs.map(() => 100 / legs.length);
  return (<div className="split-ctl">
    <div className="sh2"><span className="mono">Your split</span>{custom ? <button className="btn" style={{ padding: '6px 10px' }} onClick={() => onChange(equal)}>Reset to equal</button> : <span className="mono" style={{ color: 'var(--mute)' }}>Equal by default · drag to change</span>}</div>
    {legs.map((l, i) => <label key={l} className="srow"><span>{labels[l]}</span>
      <input type="range" min={MIN} max={100 - MIN * (legs.length - 1)} step={1} value={Math.round(pct[i])} onChange={e => onChange(rebalance(pct, i, Number(e.target.value)))} aria-label={`${labels[l]} share`} />
      <b className="mono">{pct[i] % 1 ? pct[i].toFixed(1) : pct[i]}%</b></label>)}
    {custom && <div className="note" style={{ margin: '8px 0 0' }}>Your mix. Figures and chart below are recalculated from daily prices (buy and hold from Jan 2020, no rebalancing). Keel's score and quality bar apply to the equal split only, so this mix is not graded.</div>}
  </div>);
}
