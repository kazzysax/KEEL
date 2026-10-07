# Keel

**Curated pools of 2 to 3 tokenized assets on BNB Chain, each with at least one company stock, built to fall less and recover faster than holding one stock alone.** Buy a whole pool in one tap from your own wallet. Pools are graded by one public rule set, and AI agents can propose new pools that Keel grades, lists or rejects.

Built for *BNB Hack: Tokenized Stocks Edition*. **Target network: BNB Smart Chain mainnet (56) for everything**: stock tokens, the Binance Web3 API calls, the agents' identities (ERC-8004), jobs (ERC-8183) and x402 payments. Testnet is for rehearsal only.

> Not investment advice. Past performance does not predict future results. Tokenized stocks are restricted by region (US and UK persons are excluded) and carry issuer, custody and redemption terms.

## What is in the app

| Page | What it does |
|---|---|
| **Pools** (`/`) | 11 curated pools (duos, trios, stock pairs) plus a **Community** tab of agent-proposed pools. Each opens to worst fall, best and worst year, average per year, offset score, rolling 12-month range, a 2-year chart, yearly bars, and today's outlook. Community pools show their **Keel score**. |
| **Your split** | Every pool opens at an equal split (50/50, 33/33/33). Sliders (each asset at least 5%) recalculate every figure in the browser. A custom mix is labelled "not graded by Keel". |
| **Buy and positions** | Connect a browser wallet or any mobile wallet (WalletConnect v2). Every leg is quoted, pre-flighted and simulated first; if one fails nothing is bought. Orders sign in your wallet (EIP-712 for Ondo RFQ legs). Positions show your holdings with one-tap exit. |
| **Today's outlook** | The Analyst agent publishes a sourced Positive / Neutral / Cautious outlook for all 13 assets every day. No price targets. Every reason links to a page that was actually fetched. |
| **Agents** (`/agents`) | The Analyst, Scout and Grader: role, on-chain id and address, activity log, earnings. |
| **Bring your agent** (`/connect`) | How any agent proposes a pool, previews a grade for free, buys the briefing, or manages a user's pool. Rules and tradable tickers are read live from the Grader's config. |
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

## Agents (BNB Agent Studio)

Three agents share one codebase in `apps/analyst` (Python, `bnbagent` SDK). Each has its own wallet and ERC-8004 identity.

| Agent | Works without being asked | Others can pay it for |
|---|---|---|
| **keel-analyst** | Every day at 21:30 UTC refreshes prices and builds the outlook for all 13 assets. Writes `public/data/outlook/daily.json` and a dated history file. | `GET /daily` over **x402** (0.05 U), or an ERC-8183 `outlook AAPL,WMT` job |
| **keel-scout** | Buys the Analyst's briefing over x402, finds new pool ideas, sends them to the Grader as ERC-8183 jobs. | n/a (it is the buyer) |
| **keel-grader** | Scores any proposed pool with the same code as the curated pools; lists passing pools under Community with the proposer's identity; keeps rejections with reasons. | A grading job (1 U) |

**Ways for other agents in**
- **Propose a pool**: hire the Grader with an ERC-8183 job: `{"legs":["XOM","GLD","IEF"],"rationale":"...","proposer":{"agent":"my-agent","agentId":"123"}}`. Result is final.
- **Check first, free**: `POST /api/grade-preview {"legs":["XOM","GLD","IEF"]}` returns the same checks and score. Lists nothing. 30 per minute per IP. Parity with the Python Grader is tested on all 1,106 asset combinations (`npm run test:parity`: 0 real mismatches, 1 score off by one point).
- **Buy the briefing**: x402. A 402 reply carries the price; sign an EIP-3009 authorization and retry. `bnbagent` ships only the buyer side, so `apps/analyst/src/x402_seller.py` is a small self-hosted seller that verifies the signature, checks the nonce, then submits `transferWithAuthorization` itself (the seller pays gas).
- **Manage a user's pool**: the agent desk (below).

**Agent desk.** The owner signs a free message in their wallet to link an agent's address. The agent signs *suggestions* with its own key; the owner approves or dismisses each. The agent never holds keys and cannot trade. Revoking is instant. Limits: 5 agents per owner, 20 pending, 20 suggestions per hour per agent. Storage is Upstash Redis (local file fallback). Suggestions are readable by anyone who knows the owner address. Only plain wallets (EOA) can sign. Example agent: `apps/analyst/client/desk_suggest.py`.

## Run it

```bash
npm i && cp .env.example .env.local     # DEMO_MODE=1 works with no keys (synthetic quotes)
npm run dev
```
Live: set `BINANCE_WEB3_API_KEY/SECRET`, `DEMO_MODE=0`. Mobile wallets: set `NEXT_PUBLIC_WC_PROJECT_ID` (free at cloud.reown.com) and add the site's domain there.

```bash
# agents (apps/analyst)
pip install -r requirements.txt && cp .env.example .env          # mainnet by default; fund the wallet with BNB and U
python scripts/register.py                      # one-time ERC-8004 identity; also writes the id to public/data for the Agents page
python scripts/run_agent.py                     # analyst: provider loop + daily loop + /daily
python scripts/run_agent.py --env .env.grader   # grader
python client/propose.py 3                      # scout: pay for the briefing (x402), propose 3 pools
python src/scout.py --local                     # no chain: dry run of Scout + Grader (labelled "dry run")
python src/daily.py --once                      # one daily run now
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
- **Agents → any always-on host**: `docker compose up -d --build` (`docker-compose.yml`, `Dockerfile.agents`). A `publisher` service pushes new briefings, community pools and agent activity to GitHub; Vercel redeploys on push.
- `npm run preflight` lists every missing setting.

## Layout
- `src/lib/plan.ts` quote every leg across issuers, pick cheapest per share, pre-flight (impact, $5 floor, market status), build and simulate. All legs must pass.
- `src/lib/execute.ts`, `src/app/api/swap/*` approve, sign, submit and track each leg; partial-fill handling, retry, sell-back.
- `src/lib/grade.ts`, `src/app/api/grade-preview` the free grade preview. `src/lib/desk.ts`, `src/app/api/desk/*` the agent desk. `src/lib/wallet.ts` browser wallet and WalletConnect behind one provider.
- `scripts/poolmath.py` shared pool math, rules and score. `scripts/precompute.py` regenerates pools, history and rules.
- `apps/analyst` the agents. `docs/DEVEX-NOTES.md` raw log for the Developer Experience Report.

## Status, honestly
Built and tested offline: pool math, grading (both languages), custom split, desk, x402 signing and verification, daily runner, wallet connection with a mock wallet. **Not yet run live** (needs your keys and funds): Binance quote, build and RFQ submit; on-chain agent registration, jobs and x402 settlement; WalletConnect with a real phone wallet; the daily price and news fetch from a real host. See PRODUCTION.md section 3.

Not investment advice.
