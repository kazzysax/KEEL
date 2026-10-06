"""Headless seller loop + small HTTP surface for the Offset Outlook Analyst.

* funded_job_watcher polls for FUNDED jobs assigned to this agent's wallet.
* For each, the on-chain description is parsed for a ticker / pool id, an outlook is built
  (outlook.py) and submitted through ERC8183JobOps.submit_result (the SDK uploads the
  manifest to storage and records its keccak hash on-chain via ERC8183Client.submit).
* HTTP (starlette/uvicorn), mounted under /erc8183 as the SDK expects:
    POST /erc8183/negotiate            signed quote (REQUIRED: ERC8183JobOps.verify_job rejects
                                       jobs whose description lacks a signed negotiation quote)
    GET  /erc8183/job/{id}/response    serves the stored manifest when storage is file://
    GET  /.well-known/agent-card.json  minimal card so the registered A2A endpoint resolves
    GET  /health

Run:  python provider.py            (testnet unless BNB_NETWORK says otherwise)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from decimal import Decimal

from outlook import (
    FinnhubClient,
    OutlookError,
    build_outlook,
    finnhub_from_env,
    load_universe,
    parse_outlook_request,
)

log = logging.getLogger("outlook.provider")

MAX_NEGOTIATE_BYTES = 8 * 1024


def price_to_units(price: str, decimals: int) -> int:
    """'0.01' -> 10**(decimals-2). Rejects negatives / sub-unit precision."""
    d = Decimal(str(price))
    units = d * (10 ** decimals)
    if d < 0 or units != units.to_integral_value():
        raise ValueError(f"PRICE_PER_OUTLOOK={price!r} not representable with {decimals} decimals")
    return int(units)


def make_on_funded(ops, universe: set[str], finnhub: FinnhubClient | None):
    """Build the watcher callback. Return value follows funded_job_watcher's retry contract:
    {"retry": True} only for failures the SDK marks retryable; everything else is final."""

    async def on_funded(job: dict):
        jid = job["jobId"]
        subject = parse_outlook_request(job.get("description", ""), universe)
        if subject is None:
            # Cannot be rejected on-chain by the provider; the client recovers via claim_refund
            # after expiry. Do not retry: the description will not change.
            log.error("job %s: description does not name exactly one known ticker/pool id", jid)
            return None
        try:
            doc = await asyncio.to_thread(build_outlook, subject, finnhub=finnhub)
        except OutlookError as exc:
            log.error("job %s: outlook failed code=%s", jid, exc.code)
            return {"retry": True} if exc.code == "data_unavailable" else None
        except Exception as exc:  # validator rejection or unexpected bug: fail closed, never submit
            log.error("job %s: outlook build failed (%s)", jid, type(exc).__name__)
            return {"retry": True}

        payload = json.dumps(doc, sort_keys=True, separators=(",", ":"))
        res = await ops.submit_result(
            jid, payload, metadata={"schema": "offset-outlook/v1", "subject": subject}
        )
        if res.get("success"):
            log.info("job %s: submitted tx=%s deliverable=%s", jid, res["txHash"], res["deliverable"])
            return None
        code = res.get("error_code")
        if res.get("retryable"):  # chain_unavailable / internal_error
            log.warning("job %s: submit failed code=%s, will retry", jid, code)
            return {"retry": True}
        # Permanent: budget_too_low, not_assigned, job_expired, wrong_status, description_invalid,
        # submit_deadline_passed, payload_too_large, quote_invalid, job_token_mismatch, tx_pending.
        # tx_pending means the tx is already broadcast: never resend, check tx_hash later.
        log.error("job %s: submit refused code=%s tx=%s", jid, code, res.get("tx_hash"))
        return None

    return on_funded


def create_app(ops, handler, universe: set[str], public_url: str, price_display: str):
    from starlette.applications import Starlette
    from starlette.concurrency import run_in_threadpool
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    from bnbagent.utils import RateLimitExceeded, SlidingWindowLimiter

    limiter = SlidingWindowLimiter(max_requests=20, window_seconds=60)

    async def negotiate(request):
        # Behind a proxy run uvicorn with --forwarded-allow-ips so client.host is the real IP.
        try:
            limiter.check(request.client.host if request.client else "unknown")
        except RateLimitExceeded:
            return JSONResponse({"error": "rate limited", "error_code": "rate_limited"}, 429)
        raw = await request.body()
        if len(raw) > MAX_NEGOTIATE_BYTES:
            return JSONResponse({"error": "body too large", "error_code": "payload_too_large"}, 413)
        try:
            body = json.loads(raw)
            req = body.get("request", body)
            if parse_outlook_request(req.get("task_description", ""), universe) is None:
                return JSONResponse(
                    {"error": "task_description must name exactly one known ticker or pool id",
                     "error_code": "unsupported_subject"}, 422)
            from bnbagent.erc8183 import QuoteSigningError

            try:
                result = await run_in_threadpool(handler.negotiate, req)
            except QuoteSigningError:
                return JSONResponse({"error": "quote signing unavailable", "error_code": "signing_unavailable"}, 503)
        except (ValueError, AttributeError):
            return JSONResponse({"error": "invalid JSON body", "error_code": "bad_request"}, 400)
        return JSONResponse(result.to_dict(), 200 if result.accepted else 422)

    async def job_response(request):
        try:
            jid = int(request.path_params["job_id"])
        except ValueError:
            return JSONResponse({"error": "bad job id"}, 400)
        res = await ops.get_response(jid)
        if not res.get("success"):
            status = 404 if res.get("error_code") == "not_found" else 503
            return JSONResponse({"error": res.get("error"), "error_code": res.get("error_code")}, status)
        res.pop("success", None)
        return JSONResponse(res)

    async def card(_request):
        return JSONResponse({
            "protocolVersion": "0.3.0",
            "name": "Offset Outlook Analyst",
            "description": "Strict-JSON stock/pool outlook with sourced reasons. Not financial advice.",
            "url": public_url,
            "version": "0.1.0",
            "capabilities": {},
            "defaultInputModes": ["application/json", "text/plain"],
            "defaultOutputModes": ["application/json"],
            "skills": [{
                "id": "outlook", "name": "Ticker / pool outlook",
                "description": "Input: a ticker or pool id (D1-D5, T1-T5, S1-S4).",
                "tags": ["outlook", "stocks"],
            }],
            # Stub card: jobs flow through ERC-8183 + the /erc8183/negotiate HTTP quote, not A2A messages.
            "x-erc8183": {"negotiate": f"{public_url.rstrip('/')}/erc8183/negotiate",
                          "pricePerOutlook": price_display},
        })

    async def health(_request):
        return JSONResponse({"ok": True, "agent": ops.agent_address})

    return Starlette(routes=[
        Route("/erc8183/negotiate", negotiate, methods=["POST"]),
        Route("/erc8183/job/{job_id}/response", job_response, methods=["GET"]),
        Route("/.well-known/agent-card.json", card, methods=["GET"]),
        Route("/health", health, methods=["GET"]),
    ])


async def run(args) -> int:
    from bnbagent.erc8183 import ERC8183JobOps, NegotiationHandler, funded_job_watcher
    from bnbagent.storage import LocalStorageProvider

    from common import get_network, make_wallet

    network = get_network()
    public_url = (os.environ.get("AGENT_PUBLIC_URL") or "").strip().rstrip("/")
    if not public_url:
        print("AGENT_PUBLIC_URL is required (ops needs it to publish file:// deliverables).", file=sys.stderr)
        return 2
    price_str = os.environ.get("PRICE_PER_OUTLOOK", "0.01")

    wallet = make_wallet("AGENT")
    storage = LocalStorageProvider(os.environ.get("STORAGE_LOCAL_PATH") or ".agent-data")
    probe = ERC8183JobOps(wallet, network, storage_provider=storage, agent_url=f"{public_url}/erc8183")
    client = probe.erc8183_client
    units = price_to_units(price_str, client.token_decimals())
    ops = ERC8183JobOps(
        wallet, network, storage_provider=storage, service_price=units,
        agent_url=f"{public_url}/erc8183",
    )
    handler = NegotiationHandler.from_erc8183_client(
        ops.erc8183_client, service_price=units, wallet_provider=wallet,
        quote_ttl_seconds=int(os.environ.get("QUOTE_TTL_SECONDS", "300")),
    )

    assets, pools = load_universe()
    universe = set(assets) | set(pools)
    finnhub = finnhub_from_env()
    if finnhub is None:
        log.warning("FINNHUB_API_KEY not set: outlooks will be history-only")
    on_funded = make_on_funded(ops, universe, finnhub)

    stop = asyncio.Event()
    watcher = asyncio.create_task(
        funded_job_watcher(ops, on_funded, interval=args.interval, stop=stop)
    )
    log.info("provider %s on %s, price %s token units=%s", ops.agent_address, network, price_str, units)
    if args.no_http:
        await watcher
        return 0

    import uvicorn

    app = create_app(ops, handler, universe, public_url, price_str)
    server = uvicorn.Server(uvicorn.Config(
        app, host=args.host, port=args.port, log_level="info", forwarded_allow_ips="*"
        if os.environ.get("TRUST_PROXY") == "1" else None,
    ))
    try:
        await server.serve()
    finally:
        stop.set()
        await watcher
    return 0


def main(argv: list[str] | None = None) -> int:
    from common import load_env

    ap = argparse.ArgumentParser(description="Offset Outlook Analyst seller")
    ap.add_argument("--interval", type=float, default=float(os.environ.get("POLL_INTERVAL", "30")))
    ap.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8003")))
    ap.add_argument("--no-http", action="store_true", help="watcher only (no /negotiate)")
    args = ap.parse_args(argv)
    load_env()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    return asyncio.run(run(args))


if __name__ == "__main__":
    raise SystemExit(main())
