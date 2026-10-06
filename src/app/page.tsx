import { manifest } from '@/lib/pools';
import PoolBrowser from '@/components/PoolBrowser';
import Holdings from '@/components/Holdings';
export default function Home() {
  const man = manifest();
  const tick = Object.entries(man.assets).filter(([, v]) => v.kind !== 'commodity' || true);
  return (<>
    <header className="top"><div className="wrap" style={{ display: 'flex', width: '100%', padding: 0, maxWidth: 'none' }}>
      <div className="brand" style={{ paddingLeft: 28 }}><span className="logo">⊕</span>KEEL</div>
      <nav className="mono"><a href="#how">The mechanism</a><a href="#pools">The proof</a><a className="cta" href="#pools">Open app</a></nav></div></header>
    <div className="ticker mono">{tick.map(([k, v]) => <span key={k}><b>{k}</b> {v.last?.toFixed(2)} <i>●</i></span>)}<span>BSC MAINNET · SPOT ONLY</span><span>DATA THROUGH {man.asOf}</span></div>
    <div className="wrap">
      <div className="hero">
        <div className="hero-l">
          <div className="tag mono">Hedged tokenized stocks on BNB Chain</div>
          <h1>Stocks that<em>soften each<br />other’s falls.</em></h1>
          <p className="lede">Keel pairs a company stock with an asset that has historically held up when it fell. Pick a pool, enter an amount, confirm once. An agent splits it equally, finds the best route across issuers and buys every leg.</p>
          <div className="btns"><a className="btn acc" href="#pools">Browse pools</a><a className="btn" href="#how">How it works</a></div>
        </div>
        <div className="fig" style={{ alignSelf: 'center' }}>
          <div className="cap mono"><span>Fig. 01 / The offset route</span><span>Equal split · no rebalancing</span></div>
          <div className="flow">
            <div className="node"><span className="mono">01 / Input</span><span className="big">$100</span><span className="mono" style={{ color: 'var(--mute)' }}>one confirmation</span></div><div className="arrow" />
            <div className="node hot"><span className="mono">02 / Policy</span><span className="big">50 / 50</span><span className="mono" style={{ color: 'var(--mute)' }}>spend limit set in app</span></div><div className="arrow" />
            <div className="node"><span className="mono">03 / Execution</span><span className="big">SWAP</span><span className="mono" style={{ color: 'var(--mute)' }}>best issuer per leg</span></div>
          </div>
          <div className="rail"><span style={{ left: '4%' }} /><span className="a" style={{ left: '50%' }} /><span style={{ right: '4%' }} /></div>
          <div className="railcap mono"><span>Simulate all legs</span><span>Buy</span><span>Receipt</span></div>
        </div>
      </div>
      <section className="block" id="pools"><PoolBrowser man={man} /></section>
      <section className="block" id="positions"><Holdings man={man} /></section>
      <section className="block" id="how">
        <div className="sh"><h2>The mechanism</h2><span className="mono" style={{ color: 'var(--mute)' }}>Four steps, no rebalancing</span></div>
        <div className="steps">
          {[['01 / Study', 'Chosen from history', 'Every pool was picked from daily prices since Jan 2020, keeping those where growth is large next to the worst fall.'], ['02 / Plan', 'Every leg simulated first', 'Quotes, price impact and a dry run for each leg. If any leg fails, nothing is bought.'], ['03 / Buy', 'Best issuer per leg', 'Ondo and bStock versions are compared per share, then bought through the Binance Web3 API.'], ['04 / Exit', 'Reverse in one confirmation', 'Sell all legs back to USDT. The pool is left alone while you hold it.']].map(([a, b, c]) => <div key={a}><span className="mono" style={{ color: 'var(--acc)' }}>{a}</span><h4>{b}</h4><p>{c}</p></div>)}
        </div>
      </section>
      <footer><span className="mono">Read this first</span>Figures come from historical daily prices of the underlying stocks and funds, equal-weight buy and hold, and do not predict future returns. The worst drawdown shows pools can still fall by double digits. Tokenized stocks are not available to US or UK persons. Not investment advice.</footer>
    </div>
  </>);
}
