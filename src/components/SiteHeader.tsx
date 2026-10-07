import Link from 'next/link';
import Logo from './Logo';
export default function SiteHeader({ home = false }: { home?: boolean }) {
  const h = home ? '' : '/';
  return (<header className="top"><div className="wrap" style={{ display: 'flex', width: '100%', padding: 0, maxWidth: 'none' }}>
    <div className="brand" style={{ paddingLeft: 28 }}><Logo />KEEL</div>
    <nav className="mono"><a href={h + '#pools'}>Pools</a><a href={h + '#positions'}>Positions</a><a href={h + '#how'}>How it works</a><Link href="/agents">Agents</Link><a className="cta" href={h + '#pools'}>Open app</a></nav></div></header>);
}
