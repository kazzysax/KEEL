# Keel: path to full production

Where the project stands, what separates it from a real launch, and the order to close the gaps. Written Oct 7, 2026, before the hackathon submission (Oct 11, 12:00 UTC).

## 1. Status today

| Area | State |
|---|---|
| Pool study (10 to 14 pools, equal-weight buy and hold, drawdown, avg and best year, offset score, rolling 12-month range) | Built. Computed from daily closes Jan 2020 to Oct 6, 2026 (`scripts/precompute.py`) |
| UI (pool list, dropdown with 4 figures, 2-year chart, yearly bars, outlook card, buy panel, positions) | Built and viewed in a browser |
| Quote, pre-flight and simulate for every leg (`src/lib/plan.ts`) | Written against `@binance-web3/wallet` types. **Not run live** |
| Buy from user wallet: approve, sign EIP-712 (RFQ), submit, poll (`src/lib/execute.ts`, `/api/swap/*`) | Written. Logic tested with a mocked wallet and API. **Not run live** |
| Partial-fill handling, retry, sell-back, holdings and exit | Written. Mock-tested only |
| Agentic Wallet mode | **Removed** (optional in the hackathon rules; one account only, so it cannot serve other users) |
| Agents: Analyst (daily run, x402 `/daily`), Scout, Grader, Community pools tab, Agents page | Built. 10 offline tests pass (grader rules, x402 signing, replay, caps, paid route). Daily price refresh and news fetch failed in the sandbox (blocked), so the seeded briefing is price-only. **Never run on-chain** (testnet default) |
| Demo mode (synthetic quotes) | Works with no keys |
| Hosting, domain, CI, monitoring | Not set up |

## 2. Blockers only the owner can clear
1. Binance Web3 API key (free during the hackathon): unlocks every live call.
2. A little USDT and BNB on BSC for real swaps (about 15 to 20 USDT and 1 USD of BNB).
3. Testnet BNB (bnbchain.org/en/testnet-faucet) and U tokens (united-coin-u.github.io/u-faucet) for three agent wallets: analyst, scout, grader.
4. Vercel (or other host) access; European region, because the API refuses US regions (`40304`).
5. Eligibility: US and UK persons are excluded by the hackathon and by all three issuers.

## 3. Verify first (day one with a key)
- Which of the 13 Ondo BSC tokens actually quote at $20, $50 and $200. Listed on the Ondo token list is not the same as liquid. Walmart and Coca-Cola showed very thin on-chain size in earlier checks.
- `priceImpactPercent`: fraction or percent (code assumes fraction and multiplies by 100).
- RFQ flow end to end: `typedDataToSign` format (hex vs JSON), approve spender per vendor, `requestId` semantics, status values.
- Ondo behaviour out of US market hours, per-leg $5 floor, `marketStatus` handling.
- bStock addresses for AAPL, MSFT, SPY, QQQ (via `searchRwaToken`) so the cheaper-issuer comparison has two sides.
- Agents: does the testnet U token's `transferWithAuthorization` take `(v,r,s)` or a packed `bytes` signature (our seller assumes v,r,s)? Does the SDK expose an ERC-8183 evaluator role? Does Yahoo's chart endpoint answer from the host (daily price refresh)?
Log every surprise in `docs/DEVEX-NOTES.md` (also the raw material for the human-written Developer Experience Report).

## 4. Build still needed for production
1. **Wallet connection**: built (`src/lib/wallet.ts`, `ConnectButton`): browser wallet and WalletConnect v2 behind one provider. Browser path tested with a mock wallet; **WalletConnect path never tested with a real phone wallet** and needs `NEXT_PUBLIC_WC_PROJECT_ID`. Test with the Binance app and one other wallet, including the chain switch to BSC and `eth_signTypedData_v4`.
2. **Multi-issuer router**: add bStock (and xStock where quotable) options per leg; show "bought via X, Y% cheaper per share" with the share multiplier applied.
3. **Receipts**: derive fills from transaction Transfer logs, not from the quote; store an order journal (Upstash Redis or Postgres).
4. **Rate and cost control**: one paced queue and cache for Binance calls (exists in-process; needs a shared store when running more than one instance).
5. **Data refresh**: scheduled job to re-run `precompute.py` and the outlook snapshots; show "data through" date; version the pool list.
6. **Outlook inputs**: headlines work from a normal server (blocked in the build sandbox); add Finnhub or similar for earnings dates; keep "no price targets" validator.
7. **Analyst agent on mainnet**: deploy with `bag` (AWS AgentCore), register ERC-8004, fund for ERC-8183 writes (not gas-sponsored on mainnet), write the agent id to `public/data/outlook/agent.json`.
8. **Agents on an always-on host**: run analyst, grader and scout as services (the daily loop lives inside the analyst process); persist `public/data/{outlook,community,agents}` somewhere the web app can read (object storage or a small API) instead of committing files; try `bag` deploy to AgentCore.
9. **Tests**: unit tests for pool math; integration tests against the API in dry-run (simulate) mode; a browser test for the buy and partial-fill flows.

## 5. Security checklist
- API key and secret server-side only (`import "server-only"`, never `NEXT_PUBLIC_`); rotate after the hackathon.
- Exact-amount token approvals, never unlimited; show and offer revoke.
- Request validation on every route (zod; present); amount caps; rate limiting per IP on `/api/*`.
- Server clock NTP-synced (a 30-second drift triggers `40103`).
- Agents: separate wallet per agent holding only testnet or small amounts; X402 caps (`max_per_call`, session budget) on the buyer; seller key never reused for anything else.
- Pre-flight everything, execute nothing if any leg fails; never continue after a failed leg without the user.
- Secrets scanning in CI; `.env*` ignored (present).
- Dependency audit; pin versions; review the SDK's unauthenticated-endpoint notes before exposing the analyst publicly (the debug search route in the reference example is intentionally not included).

## 6. Product and legal
- Honest figures: worst drawdowns are double digits (about 15 to 33 percent in the study). Keep the "past results do not predict future ones" and "not investment advice" notes next to every figure and outlook.
- The offset score and growth-to-drawdown rule are our own definitions; publish the formulas in a "How we score" drawer.
- Tokenized stocks are restricted by region and carry issuer, custody and redemption terms; link to each issuer's terms and risk disclosures.
- Equal weights drift with no rebalancing (some legs can reach 70 to 80 percent); say so, and consider an optional exit reminder.
- Get proper legal review before charging fees, adding rebalancing, or marketing outside the hackathon. Not legal advice.

## 7. Launch sequence
1. Day one with key: section 3 checks, fix mismatches.
2. Wire a real wallet connector, run a $15 to $20 live buy and exit; capture BscScan links.
3. Register the three agent identities, run the Scout against the Grader on testnet, and let the Analyst's daily run fire once on its own; capture the job and x402 transaction links for the Agents page and the demo.
4. Deploy web app (EU region) with env vars; deploy the analyst; register identity.
5. README "verify it yourself" table, demo video (4 minutes or less), Developer Experience Report written by the owner, submit before Oct 11, 12:00 UTC (aim for 10:00).
6. After the hackathon: sections 4 to 6 in order, then rotate keys, add monitoring and alerts (failed legs, API error codes, stale data), and set up a status page.

| Agent desk storage | Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on the host. Without them desk data sits in a local file and disappears on redeploy. |
| Grade preview rate limit | In memory per server instance. Put a real limiter in front (Vercel firewall) if the endpoint gets abused. |
