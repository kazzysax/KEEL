import { manifest, pool as loadPool } from '@/lib/pools';
import HeroFigure, { legDrawdowns } from '@/components/HeroFigure';
import PoolBrowser from '@/components/PoolBrowser';
import Holdings from '@/components/Holdings';
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
    <div className="ticker mono">{tick.map(([k, v]) => <span key={k}><b>{k}</b> {v.last?.toFixed(2)} <i>●</i></span>)}<span>BSC MAINNET · SPOT ONLY</span><span>DATA THROUGH {man.asOf}</span></div>
    <div className="wrap">
      <div className="crumbs mono"><span>Tokenized stocks on BNB Chain</span><span>Prices through {man.asOf}</span></div>
      <div className="hero">
        <div className="hero-l">
          <div className="tag mono">Pools of two or three assets</div>
          <h1><span>Stocks that</span><span>soften each</span><em>other’s falls.</em></h1>
          <p className="lede">Keel pairs a company stock with assets that have tended to hold up when it dropped. Pick a pool, enter an amount, confirm once. The amount is split equally and every leg is bought for you.</p>
          <div className="status mono"><span><b>●</b> {man.pools.length} pools</span><span>Every leg checked before buying</span></div>
          <div className="btns"><a className="btn acc" href="#pools">Browse pools</a><a className="btn link" href="#how">How it works</a></div>
        </div>
        <HeroFigure p={hero} labels={labels} />
      </div>
      <div className="band">
        <div><div className="n">{man.pools.length}</div><div className="l">pools, each with at least one company stock</div></div>
        <div><div className="n">{Object.keys(man.assets).length}</div><div className="l">stocks, funds, gold and Treasuries</div></div>
        <div><div className="n">{man.from_.slice(0, 4)}</div><div className="l">start of the price history behind every figure</div></div>
        <div><div className="n">1</div><div className="l">confirmation to buy, one to exit</div></div>
      </div>
      <DailyBrief />
      <section className="block" id="pools"><PoolBrowser man={man} /></section>
      <section className="block" id="positions"><Holdings man={man} /></section>
      <section className="block" id="how">
        <div className="sh"><h2>How it works</h2><span className="mono" style={{ color: 'var(--mute)' }}>Four steps, no rebalancing</span></div>
        <div className="steps">
          {[['01 / Study', 'Chosen from history', 'Every pool was picked from daily prices since Jan 2020, keeping those where growth is large next to the worst fall.'], ['02 / Plan', 'Every leg simulated first', 'Quotes, price impact and a dry run for each leg. If any leg fails, nothing is bought.'], ['03 / Buy', 'Best issuer per leg', 'Ondo and bStock versions are compared per share, then bought from your own wallet through the Binance Web3 API.'], ['04 / Exit', 'Reverse in one confirmation', 'Sell all legs back to USDT. The pool is left alone while you hold it.']].map(([a, b, c]) => <div key={a}><span className="mono" style={{ color: 'var(--acc)' }}>{a}</span><h4>{b}</h4><p>{c}</p></div>)}
        </div>
      </section>
      <p className="note" style={{ marginTop: 18 }}>The daily outlook is built automatically from sources and past prices. Outside agents propose new pools and the Grader agent scores them on BNB Agent Studio. <a href="/agents" style={{ color: 'inherit' }}>See the agents</a>. They never trade for you.</p>
      <footer><span className="mono">Read this first</span>Figures come from historical daily prices of the underlying stocks and funds, equal-weight buy and hold, and do not predict future returns. The worst drawdown shows pools can still fall by double digits. Tokenized stocks are not available to US or UK persons. Not investment advice.</footer>
    </div>
  </>);
}
