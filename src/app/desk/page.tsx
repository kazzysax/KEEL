import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import Desk from '@/components/Desk';
export const metadata: Metadata = { title: 'Agent desk', description: 'Link an agent that watches your Keel pools and suggests changes. You approve everything.' };
export default function Page() {
  return (<><SiteHeader /><div className="wrap">
    <div className="crumbs mono"><Link href="/" style={{ color: 'inherit' }}>← Back to Keel</Link><span>Agent desk</span></div>
    <section className="block"><div className="sh"><h2>Agent desk</h2></div>
      <p style={{ maxWidth: 640 }}>Bring an agent that watches your pools. It can suggest exiting a pool or adding one, with a reason. You see each suggestion here and approve or dismiss it. <Link href="/connect">How to build one</Link>.</p>
      <Desk /></section></div></>);
}
