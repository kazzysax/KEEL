# Keel: deploy to full mainnet

The runbook for taking the finished build live on BNB Smart Chain mainnet (chain 56): web app, three agents, x402, agent desk. Written Oct 7, 2026. Submission deadline: **Oct 11, 2026, 12:00 UTC** (aim for 10:00). Run `npm run preflight` at any point to see what is still missing.

## 1. What is built
| Area | State |
|---|---|
| Pool study, 11 curated pools (floor: Keel score above 40), Keel score, custom split, outlook, positions | Built, viewed in a browser |
| Quote, pre-flight, simulate, buy, partial fills, retry, sell-back | Written, mock-tested. **Not run live** |
| Wallet: browser wallet (MetaMask, Binance Web3 Wallet, Trust, OKX; on phones, the wallet app's built-in browser) | Built, mock-tested. **Never tried with a real wallet** |
| Grader, Scout, Analyst (daily, unprompted), x402 seller and buyer, community pools | Built. 12 offline tests pass. **Never run on-chain** |
| Free grade preview (`/api/grade-preview`), bring-your-agent page, agent desk | Built. Parity test (1,106 cases) and desk e2e (13 checks) pass |
| Deploy files: `vercel.json`, `Dockerfile.agents`, `docker-compose.yml`, `scripts/publish_data.sh`, CI, `npm run preflight` | Built, **not yet used** |
| Agentic Wallet | Removed on purpose (optional in the rules; one account only) |

## 2. What only you can do
1. **Binance Web3 API key and secret** (free during the hackathon).
2. **Money on BSC mainnet**:
   - Trading: about 15 to 20 USDT plus about $1 of BNB (min buy about $12 for a duo, $18 for a trio).
   - Agents: BNB for gas in **three wallets** (analyst, grader, scout). On mainnet, ERC-8004 and ERC-8183 writes are **never gas-sponsored**, and the x402 seller pays gas to settle each payment. Budget a few dollars of BNB in total to start. **U tokens** (mainnet payment token `0xcE24439F2D9C6a2289F741120FE202248B666666`) in the scout wallet to pay for jobs and briefings, about 5 U to start. Check where you can buy U and its liquidity before the deadline.
3. **Upstash Redis** (free tier) for the agent desk.
4. **Accounts**: Vercel (EU region), an always-on host for the agents (small VPS, Railway or Fly), a GitHub deploy key with write access.
5. **Eligibility**: US and UK persons are excluded by the hackathon and by all three issuers.
6. **Make the repo public, record the demo (4 minutes or less), write the Developer Experience Report yourself** (AI-written reports are rejected).

## 3. Verify first (day one with a key; log every surprise in `docs/DEVEX-NOTES.md`)
- Which Ondo tokens on BSC actually quote at $20, $50 and $200 (listed is not liquid; Walmart and Coca-Cola were thin earlier).
- `priceImpactPercent`: fraction or percent (code assumes fraction).
- RFQ end to end: `typedDataToSign` format, approve spender, `requestId`, status values. Ondo out-of-hours behaviour, the $5-per-leg floor (unverified), `marketStatus`.
- bStock addresses for AAPL, MSFT, SPY, QQQ.
- x402: does the mainnet U token's `transferWithAuthorization` take `(v,r,s)` or a packed signature (the seller assumes v,r,s)? Does the on-chain settle succeed? Check the EIP-712 domain (`United Stables`, version `1`).
- Does the Yahoo chart endpoint and the news fetch answer from the agent host?
- Wallet connect with MetaMask on desktop and the Binance app's built-in browser on a phone: chain switch to BSC, `eth_signTypedData_v4`.

## 4. Deploy, in order

**A. Rehearse on testnet (optional but wise, 1 hour).** Set `NETWORK=bsc-testnet`, `X402_NETWORK=eip155:97`, fund with tBNB and testnet U, run one job end to end. Then switch back.

**B. Register the agents on mainnet.**
```bash
cd apps/analyst && cp .env.example .env && cp .env.example .env.grader   # edit: grader gets AGENT_ROLE=grader, AGENT_NAME=keel-grader, PORT=8004
# fill PRIVATE_KEY (first run only) and WALLET_PASSWORD in each, fund each wallet with BNB
python scripts/register.py                    # analyst: prints the ERC-8004 id and writes it to public/data
ENV_FILE=.env.grader AGENT_NAME=keel-grader python scripts/register.py   # grader (and again for keel-scout)
```
Put each agent's public URL in `ERC8183_AGENT_URL`, set `X402_PAY_TO` to the analyst wallet, and `GRADER_ADDRESS`, `PROVIDER_ADDRESS`, `SCOUT_AGENT_ID` for the scout.

**C. Start the agents on the always-on host.**
```bash
git clone <repo> && cd keel
# copy the two env files and put a write-enabled deploy key at ./deploy_key; export KEEL_REPO=git@github.com:you/keel.git
docker compose up -d --build
```
`analyst` and `grader` run the services (the daily loop is inside the analyst). `publisher` pushes `public/data/{outlook,community,agents}` to GitHub every 10 minutes when something changed, and Vercel redeploys. Expect a 1 to 2 minute delay between a Grader listing and the site showing it.

**D. Deploy the web app.** Import the repo in Vercel (region `fra1` is set in `vercel.json`) and set:
`BINANCE_WEB3_API_KEY`, `BINANCE_WEB3_API_SECRET`, `DEMO_MODE=0`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Keys are server-only; never prefix them `NEXT_PUBLIC_`.

**E. Prove it works (this is your demo material).**
1. `npm run preflight` shows no TODO.
2. A real $15 to $20 buy and exit from a phone wallet; save the BscScan links.
3. Run the Scout: `python client/propose.py 3`. Save the x402 payment and ERC-8183 job links, and watch a pool appear under Community.
4. Let the Analyst's daily run fire on its own once; the Agents page shows the event.
5. Link a test agent on `/desk` and send a suggestion with `client/desk_suggest.py`.

## 5. Security checklist
- API key and secret server-side only; rotate after the hackathon.
- Exact-amount token approvals, never unlimited.
- One wallet per agent, holding only what it needs. The x402 buyer has per-call and session caps. The seller key is not reused.
- Request validation on every route; amount caps; the grade preview and desk have rate limits that are per server instance, so add a Vercel firewall rule in front.
- Server clock NTP-synced (a 30-second drift triggers `40103`).
- Pre-flight everything, execute nothing if any leg fails; never continue after a failed leg without the user.
- Desk: the agent can only suggest; every link, suggestion and approval is wallet-signed and expires in 5 minutes; revoking is immediate.
- CI runs secrets-free; `.env*` and `deploy_key` must stay out of git. Pin and audit dependencies.
- Production caveat from the SDK: with `ENV=production` it warns that its job rate limiter is in memory; run one replica per agent.

## 6. Known limits
- Past drawdowns are double digits (about 15 to 33 percent in the study). Keep the disclaimers beside every figure.
- Equal weights drift with no rebalancing; legs can reach 70 to 80 percent.
- Weight study: not out-of-sample proof; one strong market.
- Desk: plain wallets only; suggestions are public to anyone who knows the owner address.
- Data delay: community pools and briefings reach the site through a git push and redeploy.
- The "held up lately" gate has never been shown rejecting a pool in a synthetic test.
- Tokenized stocks are restricted by region. Get proper legal review before charging fees, adding rebalancing, or marketing outside the hackathon. Not legal advice.

## 7. After the hackathon
Multi-issuer router (bStock, xStock) with "cheaper by X% per share"; on-chain receipts from Transfer logs and an order journal; shared rate-limit store; data refresh as a scheduled job instead of git pushes; smart-wallet support for the desk; monitoring and alerts (failed legs, API error codes, stale data) and a status page.
