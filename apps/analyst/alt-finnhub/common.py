"""Shared helpers: env loading, network selection, wallet construction.

Nothing in here ever prints or logs a private key or wallet password.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

VALID_NETWORKS = ("bsc-testnet", "bsc-mainnet")


def load_env() -> None:
    """Load .env.local then .env from this directory (real env wins)."""
    try:
        from bnbagent import load_env as sdk_load_env

        sdk_load_env(HERE)
    except Exception:  # SDK missing (offline unit tests) - env is simply used as-is
        pass


def get_network() -> str:
    """BNB_NETWORK, default bsc-testnet. Mainnet needs an explicit second opt-in."""
    net = (os.environ.get("BNB_NETWORK") or "bsc-testnet").strip()
    if net not in VALID_NETWORKS:
        raise SystemExit(f"BNB_NETWORK must be one of {VALID_NETWORKS}, got {net!r}")
    if net == "bsc-mainnet":
        if os.environ.get("BNB_ALLOW_MAINNET", "").lower() not in ("1", "yes", "true"):
            raise SystemExit(
                "Refusing to use bsc-mainnet: set BNB_ALLOW_MAINNET=yes as well "
                "(this can spend real funds)."
            )
        print("WARNING: running against BSC MAINNET", file=sys.stderr)
    return net


def make_wallet(prefix: str = "AGENT"):
    """Build an EVMWalletProvider from env.

    ``{prefix}_PRIVATE_KEY`` (optional, first run only) is imported into an
    encrypted keystore; afterwards ``{prefix}_WALLET_ADDRESS`` selects the
    keystore. Password: ``{prefix}_WALLET_PASSWORD`` falling back to
    ``WALLET_PASSWORD``. We never auto-generate a wallet silently.
    """
    from bnbagent.wallets import EVMWalletProvider

    password = os.environ.get(f"{prefix}_WALLET_PASSWORD") or os.environ.get("WALLET_PASSWORD")
    if not password:
        raise SystemExit("WALLET_PASSWORD is required (keystore encryption password).")
    key = os.environ.get(f"{prefix}_PRIVATE_KEY") or None
    address = os.environ.get(f"{prefix}_WALLET_ADDRESS") or None
    if not key and not address and not EVMWalletProvider.keystore_exists():
        raise SystemExit(
            f"No wallet: set {prefix}_PRIVATE_KEY (first run, imported into an encrypted "
            f"keystore) or {prefix}_WALLET_ADDRESS (existing keystore)."
        )
    return EVMWalletProvider(password=password, private_key=key, address=address)
