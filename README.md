# Keel: hedged tokenized-stock pools (BNB Hack: Tokenized Stocks Edition)
Next.js 15 app. Pools are precomputed from daily prices (`npm run precompute`, data in `data/prices`).
## Run
```bash
npm i && cp .env.example .env.local   # DEMO_MODE=1 works with no keys (synthetic quotes)
npm run dev
```
Live mode: set `BINANCE_WEB3_API_KEY/SECRET`, `DEMO_MODE=0`. Wallets: browser wallet works as is; for mobile wallets (WalletConnect QR) set `NEXT_PUBLIC_WC_PROJECT_ID` (free at cloud.reown.com) and add your site's domain there.
## Layout
- `src/lib/plan.ts` quote every leg across issuers, pick cheapest per share, pre-flight (impact, $5 floor, market status), build + simulate. All legs must pass.
- `src/app/agents` public page: the three agents, their activity log and earnings.
- `scripts/precompute.py` pool statistics and 2-year chart series.
## How a proposed pool is graded
A proposal is listed only if it passes every check, then ranked by its **Keel score** (0 to 100; 50 to list, 70+ is tier A):
1. Structure: 2 or 3 different tradable assets, at least one company stock, no two from the same sector, no index fund together with its own top holdings, not already listed.
2. Fall vs growth: worst drawdown at most 1.5x the average yearly growth (the bar the curated pools were chosen with).
3. Held up lately: positive return since Jan 2025, and a worst fall since then no deeper than 1.25x the full-period fall.
4. Score of at least 50, from four parts: fall vs growth 40 points, offset score 30, share of positive rolling 12-month windows 20, fall since Jan 2025 10. Formulas and scales live in `scripts/poolmath.py` (`SCORE_PARTS`).
Curated pools were picked for variety, not by this score (the equal-split duos with Nasdaq-100 score below 50), so the curated list is not held to the listing bar.

## Custom split
Every pool opens with an equal split. "Your split" sliders (each asset at least 5%) recalculate worst drawdown, best year, average per year, offset score, rolling range, yearly bars and the chart in the browser from `public/data/history.json` (`src/lib/mix.ts`; checked against all 14 published pools at equal weights). The buy plan uses the same split (`weights` in `/api/plan`). A custom mix is labelled "not graded by Keel".

## Is a tilted split better than equal? (we tested it)
`PYTHONPATH=scripts python3 scripts/weight_study.py` runs two checks on the 11 curated pools. (1) Rolling 12-month holds from 57 start dates, with the split chosen only from earlier prices by inverse volatility, momentum tilt, or minimum variance: none beat equal in a way that matters (average 12-month return 17.3 to 19.4% vs 19.2% equal; average worst fall within 0.1 points; minimum variance had a deeper worst case, 30.9% vs 27.2%). (2) A fixed split picked on 2020 to 2023 and judged on 2024 to today: it had a shallower fall in 10 of 14 pools but a worse one in 4 (up to 3.3 points), and on average the same fall (17.4% vs 17.2%) and the same return (75.5% vs 76.1%). Equal stays the default. Limits: 14 pools, one strong market, overlapping windows, a few rules tried.

## Agents (BNB Agent Studio)
Three agents share one codebase in `apps/analyst` (Python, `bnbagent` SDK). Each has its own wallet and ERC-8004 identity (`AGENT_ROLE` + `AGENT_NAME` + its own env file and port).
| Agent | What it does without being asked | What others can pay it for |
|---|---|---|
| **keel-analyst** | Every day (21:30 UTC, after the US close) refreshes prices, builds a sourced Positive/Neutral/Cautious outlook for all 13 assets, writes `public/data/outlook/daily.json` and a dated history file. No price targets; every news reason must link to a page that was actually fetched. | `GET /daily` over **x402** (default 0.05 U), or an ERC-8183 `outlook AAPL,WMT` job |
| **keel-scout** | Buys the Analyst's briefing over x402, looks for new 2 to 3 asset pools, sends each idea to the Grader as an ERC-8183 job. | n/a (it is the buyer) |
| **keel-grader** | Scores any proposed pool with `scripts/poolmath.py`, the same code that produced the curated 14, and lists passing pools under "Community" with the proposer's identity. Rejections are kept with their reasons. | A grading job (default 1 U) |
Anyone can run their own Scout: send the Grader an ERC-8183 job whose task is `{"legs":["WMT","GLD"],"rationale":"...","proposer":{"agent":"my-agent","agentId":"123"}}`.
```bash
cd apps/analyst && pip install -r requirements.txt && cp .env.example .env    # then fund the wallets with tBNB and U (testnet faucets)
python scripts/register.py                      # one-time ERC-8004 identity per agent (AGENT_NAME)
python scripts/run_agent.py                     # analyst: provider loop + daily loop + /daily
python scripts/run_agent.py --env .env.grader   # grader (AGENT_ROLE=grader, own port)
python client/propose.py 3                      # scout: pay for the briefing (x402), propose 3 pools
python src/scout.py --local                     # no chain: dry run of Scout + Grader (what the app currently shows, labelled "dry run")
python src/daily.py --once                      # one daily run now
python -I -m pytest tests -q                    # 10 offline tests: grader rules, x402 signing/replay/caps, paid route
```
x402: `bnbagent` ships the buyer side only, and the public B402 facilitator needs merchant approval, so `src/x402_seller.py` is a small self-hosted seller. It verifies the EIP-3009 signature, then submits `transferWithAuthorization` itself (the seller pays gas: free on testnet, cents on mainnet). Set `X402=1`. Status: signing, verification and replay protection are tested offline; the on-chain submit has not run.
Status: nothing here has run against a chain yet (no BSC RPC in the build sandbox). The app's Agents page says "not registered yet" and "dry run" until it has.

## Execution modes
- **My wallet**: `/api/swap/prepare` quotes and builds each leg (approve data included), the browser signs EIP-712 for Ondo/RFQ legs, `/api/swap/submit` and `/api/swap/status` complete and track it. Legs run one by one and stop on the first failure; the UI offers retry or sell-back.

Not investment advice. Past performance does not predict future results.


## Bring your agent, and the agent desk

- **/connect** explains the ways in: propose a pool to the Grader (ERC-8183 job), preview a grade for free, buy the daily briefing (x402), or manage a user's pool.
- **Free grade preview**: `POST /api/grade-preview {"legs":["XOM","GLD","IEF"]}`. Same rules and score as the Python Grader (TypeScript port, checked by `npm run test:parity` on all 1,106 combinations: 0 real mismatches, 1 score off by one point). 30 per minute per IP, best effort. It lists nothing.
- **/desk**: the owner links an agent address by signing a free message in their wallet. The agent signs *suggestions* (`exit` or `add` a pool) with its own key. The owner approves or dismisses; approving sends them to the app to act with their own wallet. The agent never holds keys and cannot trade. Revoking is instant. Limits: 5 agents per owner, 20 pending, 20 suggestions per hour per agent.
- Storage: Upstash Redis REST if `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set, otherwise a local file (`.agent-data/desk.json`, lost on serverless redeploys). Suggestions are readable by anyone who knows the owner address. Only plain wallets (EOA) can sign; smart-contract wallets are not supported yet.
- Test: start the app, then `python3 scripts/desk_e2e.py http://localhost:3000` (13 checks). Example agent: `apps/analyst/client/desk_suggest.py`.
