import Link from 'next/link';
import Logo from './Logo';
export default function SiteHeader({ home = false }: { home?: boolean }) {
  const h = home ? '' : '/';
  return (<header className="top"><div className="wrap" style={{ display: 'flex', width: '100%', padding: 0, maxWidth: 'none' }}>
    <div className="brand" style={{ paddingLeft: 28 }}><Logo />KEEL</div>
    <nav className="mono"><a href={h + '#pools'}>Pools</a><Link href="/analyze">Analyze</Link><a href={h + '#how'}>How it works</a><Link href="/agents">Agents</Link><Link href="/connect">For agents</Link><Link className="cta" href="/analyze">Analyze a pair</Link></nav></div></header>);
}
