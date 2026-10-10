# Keel

**Keel is an analysis unit for agents.** It pairs crypto with tokenized stocks and funds (Ondo, xStocks, bStocks), grades every pair or trio by fixed, published rules, and serves the result to other agents over **MCP** and a small **SDK**. Keel never holds funds, never connects a wallet and never trades: the calling agent executes with its own wallet, using the venues and token addresses Keel returns.

Built for *BNB Hack: Tokenized Stocks Edition*. The Grader agent (ERC-8004 identity, ERC-8183 jobs on BNB Smart Chain) lists verified pairs on the site.

## Use it from an agent

- **MCP** (for agents that already speak the Model Context Protocol; paste one URL, the model calls the tools itself): `https://keel-io.vercel.app/api/mcp`. Tools: `search_assets`, `analyze_pair`, `suggest_pairs`.
- **SDK** (for code you write): `import { Keel } from 'https://keel-io.vercel.app/keel-sdk.mjs'` then `keel.search()`, `keel.analyze(['BTC','NVDA'])`, `keel.suggest('TSLA')`. Plain HTTP also works: `POST /api/analyze`, `GET /api/universe`, `GET /api/suggest`.
- Universe: about 1,440 assets: tokenized stocks and funds from Ondo (BNB Chain), xStocks (official API, with BNB Chain and Solana addresses) and bStocks (BNB Chain), plus 20 major crypto assets.

> Not investment advice. Past performance does not predict future results. Tokenized stocks are restricted by region (US and UK persons are excluded) and carry issuer, custody and redemption terms.

## What is in the app

| Page | What it does |
|---|---|
| **Pools** (`/`) | 11 curated pools (duos, trios, stock pairs) plus a **Community** tab of agent-proposed pools. Each opens to worst fall, best and worst year, average per year, offset score, rolling 12-month range, a 2-year chart, yearly bars, and today's outlook. Community pools show their **Keel score**. |
| **Your split** | Every pool opens at an equal split (50/50, 33/33/33). Sliders (each asset at least 5%) recalculate every figure in the browser. A custom mix is labelled "not graded by Keel". |
| **Buy and positions** | Connect your browser wallet (MetaMask, Binance Web3 Wallet, Trust, OKX, Rabby). On a phone, open Keel inside your wallet app's built-in browser. The app switches the wallet to BNB Smart Chain. Every leg is quoted, pre-flighted and simulated first; if one fails nothing is bought. Orders sign in your wallet (EIP-712 for Ondo RFQ legs). Positions show your holdings with one-tap exit. |
| **Today's outlook** | A sourced Positive / Neutral / Cautious outlook for all 13 assets, rebuilt every weekday after the US close by an automated job from price trend, volatility and fetched headlines. No price targets. Every reason links to a page that was actually fetched. |
| **Agents** (`/agents`) | The Grader agent: role, on-chain id and address, activity log, earnings. |
| **Bring your agent** (`/connect`) | How any agent proposes a pool, previews a grade for free, reads the daily outlook, or manages a user's pool. Rules and tradable tickers are read live from the Grader's config. |
| **Agent desk** (`/desk`) | An owner links an agent. The agent signs suggestions (exit or add a pool). The owner approves or dismisses; approving sends them to the app to act with their own wallet. |

## How pools are graded

Curated and proposed pools use the same math (`scripts/poolmath.py`; a TypeScript port in `src/lib/grade.ts` powers the free preview). A **proposal is listed only if it passes every check**, then ranked by its **Keel score** (0 to 100, 50 to list, 70+ is tier A):

1. **Structure**: 2 or 3 different tradable assets, at least one company stock, no two from the same sector, no SPY with QQQ, no QQQ with AAPL or MSFT, not already listed.
2. **Fall vs growth**: worst drawdown at most 1.5x the average yearly growth.
3. **Held up lately**: positive return since Jan 2025, and a worst fall since then no deeper than 1.25x the full-period fall.
4. **Score of at least 50**, from four parts: fall vs growth 40 points, offset score 30, share of positive rolling 12-month windows 20, fall since Jan 2025 10.

Prices: dividend-adjusted daily closes, Jan 2, 2020 to the latest close, 13 assets (AAPL, MSFT, WMT, COST, KO, JNJ, XOM, SPY, QQQ, GLD, SHY, IEF, TLT). Equal-weight, buy and hold, no rebalancing.

**Curated pools** were picked with the fall-vs-growth bar for variety. Our own list is held to a floor: pools scoring **40 or lower are dropped** (D3, D4, D5 were removed), leaving 11. Several curated pools still score under the 50 listing bar for community pools (S1 50, S4 48, S2 45, S3 41); that is stated, not hidden.

### Is a tilted split better than equal? (we tested it)
`PYTHONPATH=scripts python3 scripts/weight_study.py`. (1) Rolling 12-month holds from 57 start dates, split chosen only from earlier prices by inverse volatility, momentum, or minimum variance: none beat equal in a way that matters. (2) A fixed split picked on 2020 to 2023 and judged on 2024 to today: a shallower fall in most pools but worse in some, the same on average. Equal stays the default. Limits: few pools, one strong market, overlapping windows. This is not true out-of-sample proof.

## Agent (BNB Agent Studio)

The **keel-grader** agent runs on BNB Smart Chain mainnet (`apps/analyst`, Python, `bnbagent` SDK). It has its own wallet and an ERC-8004 identity (id 367797). It scores any proposed pool with the same code as the curated pools, lists passing pools under Community with the proposer's identity, and keeps rejections with their reasons. Hiring it costs 0.02 U per job, paid through ERC-8183 escrow.

The **daily outlook** is not an agent: a scheduled GitHub Actions job (`.github/workflows/daily-outlook.yml`, weekdays 21:35 UTC) refreshes prices, rebuilds all 13 outlooks with `apps/analyst/src/daily.py` and commits the files. It needs no server, no gas and no tokens.

**Ways for outside agents in**
- **Propose a pool**: ask the Grader for a signed quote (`POST /erc8183/negotiate`, free), put it in an ERC-8183 job description with the legs as `XOM,GLD,IEF`, fund the job with the quoted price. Result is final.
- **Check first, free**: `POST /api/grade-preview {"legs":["XOM","GLD","IEF"]}` returns the same checks and score. Lists nothing. 30 per minute per IP. Parity with the Python Grader is tested on all 1,106 asset combinations (`npm run test:parity`: 0 real mismatches, 1 score off by one point).
- **Read the outlook**: free public files, `/data/outlook/daily.json` and `/data/outlook/<TICKER>.json`.
- **Manage a user's pool**: the agent desk (below).

**Agent desk.** The owner signs a free message in their wallet to link an agent's address. The agent signs *suggestions* with its own key; the owner approves or dismisses each. The agent never holds keys and cannot trade. Revoking is instant. Limits: 5 agents per owner, 20 pending, 20 suggestions per hour per agent. Storage is Upstash Redis (local file fallback). Suggestions are readable by anyone who knows the owner address. Only plain wallets (EOA) can sign. Example agent: `apps/analyst/client/desk_suggest.py`.

## Run it

```bash
npm i && cp .env.example .env.local     # DEMO_MODE=1 works with no keys (synthetic quotes)
npm run dev
```
Live: set `BINANCE_WEB3_API_KEY/SECRET`, `DEMO_MODE=0`.

```bash
# grader agent (apps/analyst)
pip install -r requirements.txt && cp .env.example .env          # mainnet by default; fund the wallet with BNB
python scripts/register.py                      # one-time ERC-8004 identity
python scripts/run_agent.py                     # the Grader: provider loop and HTTP service
python client/propose.py 1                      # example outside agent: read the outlook, get a quote, hire the Grader
python src/daily.py --once                      # build today's outlook now
```

## Test

```bash
npx tsc --noEmit
npm run test:parity                                  # TS grader vs Python grader, 1,106 combinations
python -I -m pytest apps/analyst/tests -q            # 12 offline tests: grader rules, hostile input, x402 signing/replay/caps, paid route
python3 scripts/desk_e2e.py http://localhost:3000    # 13 agent-desk checks against a running app
npm run preflight                                    # what is still missing before submission
```
CI (`.github/workflows/ci.yml`) runs all of these on every push.

## Deploy (full mainnet)

Full runbook, costs and the verify-first list are in **[PRODUCTION.md](PRODUCTION.md)**. In short:
- **Web app → Vercel**, EU region (`vercel.json` sets `fra1`; the Binance API refuses US regions).
- **Grader agent → any always-on host** (runs on Railway today; `Dockerfile.agents`, `docker-compose.yml`). Set `RPC_URL` to a node that serves log queries.
- **Daily outlook** → the GitHub Actions job above; it commits fresh data, and the site is redeployed with `vercel deploy --prod`.
- `npm run preflight` lists every missing setting.

## Layout
- `src/lib/plan.ts` quote every leg across issuers, pick cheapest per share, pre-flight (impact, $5 floor, market status), build and simulate. All legs must pass.
- `src/lib/execute.ts`, `src/app/api/swap/*` approve, sign, submit and track each leg; partial-fill handling, retry, sell-back.
- `src/lib/grade.ts`, `src/app/api/grade-preview` the free grade preview. `src/lib/desk.ts`, `src/app/api/desk/*` the agent desk. `src/lib/wallet.ts` browser wallet connection (EIP-1193).
- `scripts/poolmath.py` shared pool math, rules and score. `scripts/precompute.py` regenerates pools, history and rules.
- `apps/analyst` the agents. `docs/DEVEX-NOTES.md` raw log for the Developer Experience Report.

## Verified live
- **Binance Web3 quotes** through the deployed app in live mode (real prices, price impact and pre-flight per leg).
- **Grader agent** registered on BNB mainnet (ERC-8004 id 367797), running on Railway. A funded ERC-8183 job with a signed quote was picked up, scored and its deliverable submitted on-chain (job 56923).
- **Agent desk** storage on Upstash Redis, link and resolve flow, surviving a redeploy.
- **Daily outlook** job run end to end from GitHub Actions: 13 assets, sourced reasons.
- Tests: 12 agent tests, TypeScript grader parity on 1,106 combinations, 13 desk checks.

Not investment advice.
