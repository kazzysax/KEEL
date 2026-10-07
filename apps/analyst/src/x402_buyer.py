"""Buyer side of x402 for agents that pay for the Analyst's daily briefing. Uses the SDK's X402Signer, so every payment is
checked against: expected recipient, per-call cap, session budget and the wallet's signing policy before anything is signed."""
from __future__ import annotations
import base64, json, os, time
from typing import Any

import httpx
from bnbagent.x402 import X402Signer, resolve_expected_eip3009_route
from web3 import Web3

TYPES_HEAD = {"EIP712Domain": [{"name": "name", "type": "string"}, {"name": "version", "type": "string"}, {"name": "chainId", "type": "uint256"}, {"name": "verifyingContract", "type": "address"}]}
TWA = {"TransferWithAuthorization": [{"name": n, "type": t} for n, t in (("from", "address"), ("to", "address"), ("value", "uint256"), ("validAfter", "uint256"), ("validBefore", "uint256"), ("nonce", "bytes32"))]}


class Payer:
    """One wallet, one session budget. The X402Signer (and so the budget counter) lives as long as this object."""

    def __init__(self, wallet, *, max_per_call: int = 10 ** 17, budget: int = 10 ** 18):
        self.wallet, self.max_per_call, self.budget = wallet, max_per_call, budget
        self._signers: dict[str, X402Signer] = {}

    def header(self, option: dict, now: float | None = None) -> str:
        route = resolve_expected_eip3009_route(option["network"], option["asset"])    # raises unless it's a catalogued EIP-3009 token
        signer = self._signers.setdefault(route.address, X402Signer(self.wallet, max_value_per_call={route.address: self.max_per_call}, session_budget={route.address: self.budget}))
        now = int(now or time.time())
        msg = {"from": self.wallet.address, "to": option["payTo"], "value": int(option["amount"]), "validAfter": now - 30,   # SDK policy caps validBefore - validAfter at 600 s
               "validBefore": now + min(int(option.get("maxTimeoutSeconds", 300)), 300), "nonce": "0x" + os.urandom(32).hex()}
        domain = {"name": route.name, "version": route.version, "chainId": route.chain_id, "verifyingContract": route.address}
        signed = signer.sign_payment(domain=domain, types={**TYPES_HEAD, **TWA}, message=msg, expected_route=route, expected_to=option["payTo"])
        sig = signed["signature"]; sig = sig if isinstance(sig, str) else "0x" + bytes(sig).hex()
        payload = {"x402Version": 2, "scheme": "exact", "network": option["network"],
                   "payload": {"signature": sig, "authorization": {k: (str(v) if isinstance(v, int) else v) for k, v in msg.items()}}}
        return base64.b64encode(json.dumps(payload).encode()).decode()

    def fetch(self, url: str, client: Any = None) -> tuple[dict, dict | None]:
        """GET url; if it answers 402, sign one payment within the caps and retry. Returns (json, payment_info|None)."""
        c = client or httpx.Client(timeout=60)
        r = c.get(url)
        if r.status_code != 402: r.raise_for_status(); return r.json(), None
        opt = next(o for o in r.json()["accepts"] if o["scheme"] == "exact")
        r2 = c.get(url, headers={"PAYMENT-SIGNATURE": self.header(opt)}); r2.raise_for_status()
        return r2.json(), {"amount": opt["amount"], "asset": opt["asset"], "payTo": opt["payTo"], "receipt": r2.headers.get("PAYMENT-RESPONSE")}
