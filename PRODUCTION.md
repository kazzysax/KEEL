# Keel: deploy runbook

Web app on Vercel, the Grader agent on an always-on host, the daily outlook on GitHub Actions. Network: BNB Smart Chain mainnet (chain 56). Submission deadline: **Oct 11, 2026, 12:00 UTC**. `npm run preflight` lists anything still missing.

## 1. Pieces
| Piece | Where | Needs |
|---|---|---|
| Web app (pools, buy flow, grade preview, bring-your-agent, desk) | Vercel, region `fra1` (the Binance API refuses US regions) | `BINANCE_WEB3_API_KEY`, `BINANCE_WEB3_API_SECRET`, `DEMO_MODE=0`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Server-only; never prefix `NEXT_PUBLIC_`. |
| Grader agent (ERC-8004 identity, ERC-8183 provider) | Railway (any always-on host works; `Dockerfile.agents`) | Wallet with BNB for gas, `PRIVATE_KEY`, `WALLET_PASSWORD`, `AGENT_ROLE=grader`, `AGENT_NAME=keel-grader`, `ERC8183_AGENT_URL`, `RPC_URL` (a node that serves log queries) |
| Daily outlook | GitHub Actions `daily-outlook.yml`, weekdays 21:35 UTC | Nothing. Commits `data/prices` and `public/data`. |
| Agent desk storage | Upstash Redis (free tier) | REST URL and token |

## 2. Deploy, in order
1. **Web app.** `vercel deploy --prod`. After a data commit, redeploy the same way, or connect the repo to Vercel (Settings, Git) so pushes deploy by themselves.
2. **Grader identity (one time).** `cd apps/analyst && cp .env.example .env`, fill the wallet values, then `python scripts/register.py`. It prints the ERC-8004 id and writes it to `public/data/agents/activity.json`.
3. **Grader service.** Deploy `Dockerfile.agents` with `RAILWAY_DOCKERFILE_PATH=Dockerfile.agents` (or `docker compose up -d --build grader`). Check `GET /erc8183/status`.
4. **Daily outlook.** Run the workflow once with `gh workflow run daily-outlook.yml`.

## 3. Check it works
1. `npm run preflight` shows no TODO.
2. A small buy and exit from a wallet; keep the BscScan links.
3. `python client/propose.py 1` from a funded outside-agent wallet: it gets a quote, funds a job, and the Grader scores it within about a minute.
4. Link a test agent on `/desk` and send a suggestion with `client/desk_suggest.py`.

## 4. Security
- API key and secret server-side only; rotate after the hackathon.
- Exact-amount token approvals, never unlimited.
- One wallet per agent, holding only what it needs.
- Request validation on every route; amount caps; rate limits are per server instance, so add a Vercel firewall rule in front.
- Server clock NTP-synced (a 30-second drift triggers Binance `40103`).
- Pre-flight every leg; execute nothing if any leg fails.
- Desk: the agent can only suggest; every link, suggestion and approval is wallet-signed and expires in 5 minutes.
- `.env*` and keys stay out of git. One replica per agent (the SDK's job rate limiter is in memory).

## 5. Limits
- Past drawdowns are double digits (about 15 to 33 percent in the study). Disclaimers sit beside every figure.
- Equal weights drift with no rebalancing.
- Desk: plain wallets only; suggestions are readable by anyone who knows the owner address.
- Tokenized stocks are restricted by region (US and UK persons excluded). Not legal advice.
