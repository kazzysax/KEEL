# Offset: hedged tokenized-stock pools (BNB Hack: Tokenized Stocks Edition)
Next.js 15 app. Pools are precomputed from daily prices (`npm run precompute`, data in `data/prices`).
## Run
```bash
npm i && cp .env.example .env.local   # DEMO_MODE=1 works with no keys (synthetic quotes)
npm run dev
```
Live mode: set `BINANCE_WEB3_API_KEY/SECRET`, `DEMO_MODE=0`. Agent mode: install `baw`, `baw auth signin`, set `BAW_ENABLED=1` and `AGENT_WALLET_ADDRESS`.
## Layout
- `src/lib/plan.ts` quote every leg across issuers, pick cheapest per share, pre-flight (impact, $5 floor, market status), build + simulate. All legs must pass.
- `src/app/api/agent` operator-run purchase through the Binance Agentic Wallet (`baw market-order quote/swap`).
- `scripts/precompute.py` pool statistics and 2-year chart series.
## Agent identity (BNB Agent Studio)
`apps/analyst` is the **Offset Outlook Analyst**, an ERC-8183 provider agent built on `bnbagent-sdk` (Python). It takes a job like `outlook AAPL,WMT,GLD`, builds a cited outlook per ticker (price facts + fetched headlines, no price targets, URLs validated against what was fetched), commits the deliverable hash on-chain, and is discoverable via ERC-8004.
```bash
cd apps/analyst && pip install -r requirements.txt && cp .env.example .env   # fund the wallet with testnet BNB
python scripts/register.py          # one-time ERC-8004 identity; write the id to public/data/outlook/agent.json
python scripts/run_agent.py         # starts the provider + funded-job poll loop
python client/hire.py AAPL,WMT,GLD  # buyer side: create, fund; settle after the dispute window
python src/outlook.py ../../public/data/outlook   # refresh the static snapshots the UI shows
```
`public/data/outlook/agent.json` format: `{"agentId":"123","explorer":"https://testnet.bscscan.com/tx/0x..."}`.
Status: code written against the SDK's reference example and syntax/logic-tested offline; not yet run against a chain RPC.

## Execution modes
- **My wallet**: `/api/swap/prepare` quotes and builds each leg (approve data included), the browser signs EIP-712 for Ondo/RFQ legs, `/api/swap/submit` and `/api/swap/status` complete and track it. Legs run one by one and stop on the first failure; the UI offers retry or sell-back.
- **Agent**: `/api/agent` runs `baw market-order quote/swap` and polls until FINISHED/FAILED.

Not investment advice. Past performance does not predict future results.
