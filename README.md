# Keel: hedged tokenized-stock pools (BNB Hack: Tokenized Stocks Edition)
Next.js 15 app. Pools are precomputed from daily prices (`npm run precompute`, data in `data/prices`).
## Run
```bash
npm i && cp .env.example .env.local   # DEMO_MODE=1 works with no keys (synthetic quotes)
npm run dev
```
Live mode: set `BINANCE_WEB3_API_KEY/SECRET`, `DEMO_MODE=0`.
## Layout
- `src/lib/plan.ts` quote every leg across issuers, pick cheapest per share, pre-flight (impact, $5 floor, market status), build + simulate. All legs must pass.
- `src/app/agents` public page: the three agents, their activity log and earnings.
- `scripts/precompute.py` pool statistics and 2-year chart series.
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
