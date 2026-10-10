import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import Analyzer from '@/components/Analyzer';
export const metadata: Metadata = { title: 'Analyze a pair', description: 'Pair crypto with tokenized stocks and funds and get the Keel grade. Free, no wallet.' };
export default function Page() {
  return (<><SiteHeader /><div className="wrap">
    <div className="crumbs mono"><Link href="/" style={{ color: 'inherit' }}>← Back to Keel</Link><span>Analyze a pair</span></div>
    <section className="block"><div className="sh"><h2>Analyze a pair</h2></div>
      <p style={{ maxWidth: 680 }}>Choose two or three assets from crypto and tokenized stocks and funds (Ondo, xStocks, bStocks). You get the same grade and figures as the curated pools. Nothing is bought and no wallet is needed.</p>
      <Analyzer /></section></div></>);
}
