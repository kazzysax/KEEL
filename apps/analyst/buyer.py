"""Client side: order one outlook from the Offset Outlook Analyst over ERC-8183.

    python buyer.py order AAPL            # negotiate -> create_job -> register_job -> set_budget -> fund
                                          #   -> poll for submission -> read + verify deliverable -> settle
    python buyer.py order D1 --no-settle  # stop after reading the deliverable
    python buyer.py settle 123            # settle a job later (after the dispute window)

stdout: ONE JSON object (progress goes to stderr). This SPENDS testnet tokens/gas when run
(unless BNB_NETWORK=bsc-mainnet is explicitly enabled, then real funds) - never run it in tests.

Env: OUTLOOK_PROVIDER_URL (agent public URL), OUTLOOK_PROVIDER_ADDRESS (trusted, out-of-band),
BUYER_PRIVATE_KEY / BUYER_WALLET_ADDRESS, WALLET_PASSWORD, BNB_NETWORK, optional BUYER_MAX_PRICE
(atomic token units), IPFS_GATEWAY.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any

from outlook import DISCLAIMER, is_forward_looking, load_universe

MAX_DELIVERABLE_BYTES = 1024 * 1024


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


class BuyerError(Exception):
    def __init__(self, code: str, message: str, **extra: Any):
        super().__init__(message)
        self.code, self.extra = code, extra


def fetch_deliverable(url: str, http_get=None) -> dict:
    """Download the manifest JSON (https/http/ipfs only, 1 MB cap)."""
    if url.startswith("ipfs://"):
        gw = os.environ.get("IPFS_GATEWAY", "https://ipfs.io/ipfs/").rstrip("/")
        url = f"{gw}/{url[len('ipfs://'):]}"
    if not url.startswith(("https://", "http://")):
        raise BuyerError("unfetchable_deliverable", "deliverable URL scheme not supported")
    import requests

    resp = (http_get or requests.get)(url, timeout=20, stream=False)
    resp.raise_for_status()
    if len(resp.content) > MAX_DELIVERABLE_BYTES:
        raise BuyerError("payload_too_large", "deliverable exceeds 1 MB")
    return resp.json()


def check_outlook(outlook: Any) -> list[str]:
    """Light client-side sanity checks (buyer cannot re-verify the seller's fetched set)."""
    problems = []
    if not isinstance(outlook, dict):
        return ["outlook is not an object"]
    if outlook.get("disclaimer") != DISCLAIMER:
        problems.append("disclaimer missing")
    if outlook.get("outlook") not in ("Positive", "Neutral", "Cautious"):
        problems.append("bad outlook label")
    reasons = outlook.get("reasons")
    if not isinstance(reasons, list) or not 2 <= len(reasons) <= 3:
        problems.append("reasons must be 2-3")
    else:
        for r in reasons:
            if is_forward_looking(str(r.get("text", ""))):
                problems.append("forward-looking wording in reason")
            u = r.get("sourceUrl")
            if u is not None and not str(u).startswith(("https://", "http://")):
                problems.append("non-http source link")
    return problems


def order(args) -> dict:
    import requests
    from bnbagent.erc8183 import DeliverableManifest, ERC8183Client, JobStatus
    from bnbagent.erc8183.negotiation import build_job_description

    from common import get_network, make_wallet

    assets, pools = load_universe()
    subject = args.subject.strip().upper()
    if subject not in assets and subject not in pools:
        raise BuyerError("unsupported_subject", f"{subject!r} is not a known ticker or pool id")
    base = (args.provider_url or os.environ.get("OUTLOOK_PROVIDER_URL") or "").rstrip("/")
    provider = args.provider_address or os.environ.get("OUTLOOK_PROVIDER_ADDRESS")
    if not base or not provider:
        raise BuyerError("config", "OUTLOOK_PROVIDER_URL and OUTLOOK_PROVIDER_ADDRESS are required")

    client = ERC8183Client(make_wallet("BUYER"), get_network())

    # 1. negotiate (single-round signed quote), verify against the out-of-band provider address
    body = {
        "task_description": f"Outlook for {subject}",
        "terms": {
            "deliverables": f"Strict-JSON outlook (Positive/Neutral/Cautious) for {subject}",
            "quality_standards": "2-3 reasons with real source links, no price targets, disclaimer attached",
        },
    }
    resp = requests.post(f"{base}/erc8183/negotiate", json=body, timeout=20)
    envelope = resp.json()
    if resp.status_code != 200 or not envelope.get("response", {}).get("accepted"):
        raise BuyerError("negotiation_rejected", "provider rejected the request",
                         detail=envelope.get("response") or envelope)
    verdict = client.verify_negotiation_quote(envelope, expected_provider=provider)
    if not verdict.valid:
        raise BuyerError("quote_invalid", f"quote failed verification: {verdict.reason}")
    price = int(envelope["response"]["terms"]["price"])
    cap = args.max_price or os.environ.get("BUYER_MAX_PRICE")
    if cap and price > int(cap):
        raise BuyerError("price_above_cap", f"quote {price} exceeds cap {cap}")
    balance = client.token_balance()
    if balance < price:
        raise BuyerError("insufficient_token_balance", f"need {price}, have {balance} (atomic units)")
    description = build_job_description(envelope)

    # 2. create -> register -> budget -> fund (fund must land inside the quote TTL)
    dispute_window = int(client.policy.dispute_window())
    expired_at = int(time.time()) + dispute_window + args.expiry_buffer
    log(f"creating job for {subject}, price={price}, dispute_window={dispute_window}s")
    created = client.create_job(provider=provider, expired_at=expired_at, description=description)
    job_id = created["jobId"]
    client.register_job(job_id)
    client.set_budget(job_id, price)
    funded = client.fund(job_id, price)
    out: dict[str, Any] = {
        "jobId": job_id, "subject": subject, "price": str(price), "network": get_network(),
        "createTx": created["transactionHash"], "fundTx": funded.get("transactionHash"),
    }

    # 3. poll for submission
    deadline = time.time() + args.timeout
    while True:
        status = client.get_job_status(job_id)
        if status == JobStatus.SUBMITTED:
            break
        if status in (JobStatus.COMPLETED, JobStatus.REJECTED, JobStatus.EXPIRED):
            raise BuyerError("job_ended", f"job ended with status {status.name}", **out)
        if time.time() > deadline:
            raise BuyerError("timeout", "no submission before timeout; job stays funded "
                             "(claim_refund after expiry)", **out)
        time.sleep(args.poll)

    # 4. read + verify deliverable
    job = client.get_job(job_id)
    url = client.get_deliverable_url(job_id)
    if not url:
        raise BuyerError("unfetchable_deliverable", "no deliverable_url found on-chain", **out)
    manifest = fetch_deliverable(url)
    hash_ok = DeliverableManifest.from_dict(manifest).verify(job.deliverable)
    if not hash_ok:
        raise BuyerError("hash_mismatch", "deliverable does not match on-chain hash; consider "
                         "disputing", deliverableUrl=url, **out)
    outlook = json.loads(manifest["response"]["content"])
    out.update({"deliverableUrl": url, "hashVerified": True, "outlook": outlook,
                "outlookChecks": check_outlook(outlook)})

    # 5. settle after the dispute window
    out["settle"] = settle_job(client, job_id, args.no_settle, args.settle_wait, job.submitted_at)
    return out


def settle_job(client, job_id: int, skip: bool, max_wait: int, submitted_at: int | None = None) -> dict:
    from bnbagent.erc8183 import JobStatus

    if skip:
        return {"status": "skipped"}
    if submitted_at is None:
        submitted_at = client.get_job(job_id).submitted_at
    ready_at = submitted_at + int(client.policy.dispute_window()) + 5
    wait = ready_at - int(time.time())
    if wait > max_wait:
        return {"status": "pending", "settleAfter": ready_at, "hint": f"python buyer.py settle {job_id}"}
    if wait > 0:
        log(f"waiting {wait}s for dispute window")
        time.sleep(wait)
    res = client.settle(job_id)
    return {"status": client.get_job_status(job_id).name, "settleTx": res.get("transactionHash")}


def main(argv: list[str] | None = None) -> int:
    from common import load_env

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    o = sub.add_parser("order")
    o.add_argument("subject", help="ticker or pool id, e.g. AAPL or D1")
    o.add_argument("--provider-url")
    o.add_argument("--provider-address")
    o.add_argument("--max-price", help="abort if quote (atomic units) exceeds this")
    o.add_argument("--no-settle", action="store_true", help="skip the settle step")
    o.add_argument("--settle-wait", type=int, default=120,
                   help="max seconds to wait for the dispute window before returning 'pending'")
    o.add_argument("--timeout", type=int, default=1800, help="seconds to wait for submission")
    o.add_argument("--poll", type=int, default=15)
    o.add_argument("--expiry-buffer", type=int, default=6 * 3600,
                   help="seconds beyond the dispute window the job stays open for the seller")
    s = sub.add_parser("settle")
    s.add_argument("job_id", type=int)
    args = ap.parse_args(argv)
    load_env()
    try:
        if args.cmd == "order":
            result = order(args)
        else:
            from bnbagent.erc8183 import ERC8183Client

            from common import get_network, make_wallet

            client = ERC8183Client(make_wallet("BUYER"), get_network())
            result = {"jobId": args.job_id, "settle": settle_job(client, args.job_id, False, 0)}
    except BuyerError as exc:
        print(json.dumps({"error": str(exc), "error_code": exc.code, **exc.extra}))
        return 1
    except Exception as exc:
        from bnbagent.exceptions import TransactionPendingError

        code = "tx_pending" if isinstance(exc, TransactionPendingError) else "internal_error"
        print(json.dumps({"error": type(exc).__name__, "error_code": code,
                          "txHash": getattr(exc, "tx_hash", None)}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
