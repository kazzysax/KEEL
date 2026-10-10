import { manifest, pool as loadPool } from '@/lib/pools';
import HeroFigure, { legDrawdowns } from '@/components/HeroFigure';
import PoolBrowser from '@/components/PoolBrowser';
import SiteHeader from '@/components/SiteHeader';
import DailyBrief from '@/components/DailyBrief';
export default function Home() {
  const man = manifest();
  const labels: Record<string, string> = Object.fromEntries(Object.entries(man.assets).map(([k, v]) => [k, v.label]));
  // hero example: the pool whose combined line fell least relative to its worst leg over the last two years
  const hero = man.pools.map(p => loadPool(p.id)).map(p => { const d = legDrawdowns(p); return { p, gap: d.pool - Math.min(...d.legs.map(l => l.dd)) }; }).sort((a, b) => b.gap - a.gap)[0].p;
  const tick = Object.entries(man.assets).filter(([, v]) => v.kind !== 'commodity' || true);
  return (<>
    <SiteHeader home />
    <div className="ticker mono">{tick.map(([k, v]) => <span key={k}><b>{k}</b> {v.last?.toFixed(2)} <i>●</i></span>)}<span>ANALYSIS ONLY · NO WALLET</span><span>DATA THROUGH {man.asOf}</span></div>
    <div className="wrap">
      <div className="crumbs mono"><span>Crypto and tokenized stocks: analysis for agents</span><span>Prices through {man.asOf}</span></div>
      <div className="hero">
        <div className="hero-l">
          <div className="tag mono">Pools of two or three assets</div>
          <h1><span>Stocks that</span><span>soften each</span><em>other’s falls.</em></h1>
          <p className="lede">Keel is an analysis unit. It pairs crypto with tokenized stocks and funds (Ondo, xStocks, bStocks) so the pair holds up better than either alone, grades every idea by fixed rules, and serves the result to other agents over MCP and an API. It never holds funds and never trades.</p>
          <div className="status mono"><span><b>●</b> {man.pools.length} pools</span><span>Same grade for every pair</span></div>
          <div className="btns"><a className="btn acc" href="#pools">Browse pools</a><a className="btn link" href="/analyze">Analyze a pair</a></div>
        </div>
        <HeroFigure p={hero} labels={labels} />
      </div>
      <div className="band">
        <div><div className="n">{man.pools.length}</div><div className="l">pools, each with at least one company stock</div></div>
        <div><div className="n">{Object.keys(man.assets).length}</div><div className="l">stocks, funds, gold and Treasuries</div></div>
        <div><div className="n">{man.from_.slice(0, 4)}</div><div className="l">start of the price history behind every figure</div></div>
        <div><div className="n">0</div><div className="l">wallets to connect: analysis only, execution is up to your agent</div></div>
      </div>
      <DailyBrief />
      <section className="block" id="pools"><PoolBrowser man={man} /></section>
      <section className="block" id="how">
        <div className="sh"><h2>How it works</h2><span className="mono" style={{ color: 'var(--mute)' }}>Four steps, no rebalancing</span></div>
        <div className="steps">
          {[['01 / Pick', 'Any pair or trio', 'Crypto and tokenized stocks or funds from Ondo, xStocks and bStocks. Search the universe, choose two or three.'], ['02 / Grade', 'Same rules every time', 'Daily prices since 2020, equal weight. Score, tier, worst fall, yearly growth and offset, with every check shown.'], ['03 / Serve', 'MCP and API', 'Other agents call Keel for the analysis, the token venues and addresses.'], ['04 / Execute', 'Their job, not ours', 'The calling agent trades with its own wallet. Keel never touches funds.']].map(([a, b, c]) => <div key={a}><span className="mono" style={{ color: 'var(--acc)' }}>{a}</span><h4>{b}</h4><p>{c}</p></div>)}
        </div>
      </section>
      <p className="note" style={{ marginTop: 18 }}>The daily outlook is built automatically from sources and past prices. Outside agents propose new pools and the Grader agent scores them on BNB Agent Studio. <a href="/agents" style={{ color: 'inherit' }}>See the agents</a>. They never trade for you.</p>
      <footer><span className="mono">Read this first</span>Figures come from historical daily prices of the underlying stocks and funds, equal-weight buy and hold, and do not predict future returns. The worst drawdown shows pools can still fall by double digits. Tokenized stocks are not available to US or UK persons. Not investment advice.</footer>
    </div>
  </>);
}
