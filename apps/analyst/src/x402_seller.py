"""Self-hosted x402 seller (EIP-3009 "exact" scheme) for the Analyst's daily briefing API.

bnbagent ships the BUYER side of x402 (X402Signer). There is no seller helper and the public B402 facilitator needs merchant
approval, so this module is a small facilitator of our own:

  1. GET /daily with no payment  -> 402 + a challenge (token, amount, payTo, network, validity window)
  2. buyer signs TransferWithAuthorization (EIP-3009) and retries with the signature in the PAYMENT-SIGNATURE / X-PAYMENT header
  3. we verify the signature, window, recipient, amount, and that the nonce is unused
  4. we submit transferWithAuthorization on-chain ourselves (we pay the gas, a few cents on mainnet, free on testnet)
  5. only after the transfer is confirmed do we return the briefing

Anyone can submit an EIP-3009 authorization, which is why no third-party facilitator is needed.
Status: signature and replay logic are unit-tested offline; the on-chain submit has not run (no BSC RPC in the build sandbox).
"""
from __future__ import annotations
import base64, json, logging, os, time
from dataclasses import dataclass
from typing import Any, Protocol

from eth_account import Account
from eth_account.messages import encode_typed_data
from web3 import Web3

from bnbagent.x402 import resolve_expected_eip3009_route

log = logging.getLogger("x402_seller")
TYPES = {"TransferWithAuthorization": [{"name": n, "type": t} for n, t in (
    ("from", "address"), ("to", "address"), ("value", "uint256"), ("validAfter", "uint256"), ("validBefore", "uint256"), ("nonce", "bytes32"))]}
TOKEN_ABI = [
    {"type": "function", "name": "authorizationState", "stateMutability": "view", "inputs": [{"name": "authorizer", "type": "address"}, {"name": "nonce", "type": "bytes32"}], "outputs": [{"name": "", "type": "bool"}]},
    {"type": "function", "name": "transferWithAuthorization", "stateMutability": "nonpayable", "outputs": [], "inputs": [
        {"name": "from", "type": "address"}, {"name": "to", "type": "address"}, {"name": "value", "type": "uint256"}, {"name": "validAfter", "type": "uint256"},
        {"name": "validBefore", "type": "uint256"}, {"name": "nonce", "type": "bytes32"}, {"name": "v", "type": "uint8"}, {"name": "r", "type": "bytes32"}, {"name": "s", "type": "bytes32"}]},
]


class PaymentError(Exception):
    """Payment missing or invalid. Message is safe to return to the caller."""


class Settler(Protocol):
    def used(self, payer: str, nonce: str) -> bool: ...
    def settle(self, auth: dict, v: int, r: str, s: str) -> str: ...   # returns tx hash after confirmation


@dataclass
class Web3Settler:
    w3: Web3
    token: str
    key: str                       # seller's key; pays gas

    def __post_init__(self):
        self.c = self.w3.eth.contract(address=Web3.to_checksum_address(self.token), abi=TOKEN_ABI); self.acct = Account.from_key(self.key)

    def used(self, payer: str, nonce: str) -> bool:
        return bool(self.c.functions.authorizationState(Web3.to_checksum_address(payer), nonce).call())

    def settle(self, a: dict, v: int, r: str, s: str) -> str:
        fn = self.c.functions.transferWithAuthorization(Web3.to_checksum_address(a["from"]), Web3.to_checksum_address(a["to"]), int(a["value"]),
                                                        int(a["validAfter"]), int(a["validBefore"]), a["nonce"], v, r, s)
        tx = fn.build_transaction({"from": self.acct.address, "nonce": self.w3.eth.get_transaction_count(self.acct.address),
                                   "gasPrice": self.w3.eth.gas_price, "chainId": self.w3.eth.chain_id})
        tx["gas"] = int(fn.estimate_gas({"from": self.acct.address}) * 1.2)
        signed = self.acct.sign_transaction(tx); h = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        rc = self.w3.eth.wait_for_transaction_receipt(h, timeout=90)
        if rc.status != 1: raise PaymentError("on-chain transfer reverted")
        return h.hex()


class Seller:
    def __init__(self, *, network: str = "eip155:97", asset: str = "TEST_U", pay_to: str, price_atomic: int, settler: Settler, validity_s: int = 300):
        self.route = resolve_expected_eip3009_route(network, asset)
        self.network, self.pay_to, self.price, self.settler, self.validity = self.route.network, Web3.to_checksum_address(pay_to), int(price_atomic), settler, validity_s
        self._seen: set[tuple[str, str]] = set()      # nonces accepted in this process (defence in depth; chain is the source of truth)

    def challenge(self, resource: str, description: str = "") -> dict:
        return {"x402Version": 2, "error": "payment required", "resource": {"url": resource, "description": description, "mimeType": "application/json"},
                "accepts": [{"scheme": "exact", "network": self.network, "asset": self.route.address, "amount": str(self.price), "payTo": self.pay_to,
                             "maxTimeoutSeconds": self.validity, "extra": {"name": self.route.name, "version": self.route.version, "transferMethod": "eip3009"}}]}

    def verify(self, header: str, now: float | None = None) -> tuple[dict, int, str, str]:
        """Return (authorization, v, r, s) if the payment is valid for this seller, else raise PaymentError."""
        now = now or time.time()
        try:
            p = json.loads(base64.b64decode(header)); a = p["payload"]["authorization"]; sig = p["payload"]["signature"]
            if p.get("scheme") != "exact" or p.get("network") != self.network: raise PaymentError("wrong scheme or network")
            msg = {"from": Web3.to_checksum_address(a["from"]), "to": Web3.to_checksum_address(a["to"]), "value": int(a["value"]),
                   "validAfter": int(a["validAfter"]), "validBefore": int(a["validBefore"]), "nonce": a["nonce"]}
        except PaymentError: raise
        except Exception as e: raise PaymentError(f"malformed payment header ({type(e).__name__})") from e
        if msg["to"] != self.pay_to: raise PaymentError("payment is not addressed to this agent")
        if msg["value"] < self.price: raise PaymentError("amount too low")
        if not (msg["validAfter"] <= now < msg["validBefore"]): raise PaymentError("authorization expired or not yet valid")
        if msg["validBefore"] - now > 3600: raise PaymentError("validity window too long")
        full = {"types": {"EIP712Domain": [{"name": "name", "type": "string"}, {"name": "version", "type": "string"}, {"name": "chainId", "type": "uint256"}, {"name": "verifyingContract", "type": "address"}], **TYPES},
                "primaryType": "TransferWithAuthorization", "message": msg,
                "domain": {"name": self.route.name, "version": self.route.version, "chainId": self.route.chain_id, "verifyingContract": self.route.address}}
        try: signer = Account.recover_message(encode_typed_data(full_message=full), signature=sig)
        except Exception as e: raise PaymentError("bad signature") from e
        if signer != msg["from"]: raise PaymentError("signature does not match payer")
        key = (msg["from"], msg["nonce"])
        if key in self._seen or self.settler.used(*key): raise PaymentError("authorization already used")
        sig_b = bytes.fromhex(sig[2:] if sig.startswith("0x") else sig)
        return a, sig_b[64] if sig_b[64] >= 27 else sig_b[64] + 27, "0x" + sig_b[:32].hex(), "0x" + sig_b[32:64].hex()

    def charge(self, header: str) -> dict:
        """Verify + settle. Returns a receipt; raises PaymentError if anything is off. Resource is released only on success."""
        a, v, r, s = self.verify(header)
        self._seen.add((Web3.to_checksum_address(a["from"]), a["nonce"]))
        try: tx = self.settler.settle(a, v, r, s)
        except Exception as e:
            self._seen.discard((Web3.to_checksum_address(a["from"]), a["nonce"])); raise PaymentError(f"settlement failed: {str(e)[:120]}") from e
        return {"payer": a["from"], "amount": str(a["value"]), "asset": self.route.address, "network": self.network, "txHash": tx}


def from_env(wallet_key: str, pay_to: str) -> Seller | None:
    """Build the seller from env, or None if X402 is not enabled. X402=1, X402_NETWORK, X402_ASSET, X402_PRICE_U, RPC_URL."""
    if os.getenv("X402", "0") != "1": return None
    network = os.getenv("X402_NETWORK", "eip155:97"); asset = os.getenv("X402_ASSET", "TEST_U" if network.endswith(":97") else "U")
    price = int(float(os.getenv("X402_PRICE_U", "0.005")) * 10 ** 18)
    route = resolve_expected_eip3009_route(network, asset)
    rpc = os.getenv("RPC_URL") or {"eip155:97": "https://data-seed-prebsc-1-s1.bnbchain.org:8545", "eip155:56": "https://bsc-dataseed.bnbchain.org"}[network]
    return Seller(network=network, asset=asset, pay_to=pay_to, price_atomic=price, settler=Web3Settler(Web3(Web3.HTTPProvider(rpc)), route.address, wallet_key))
