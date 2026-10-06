"""Register the Offset Outlook Analyst as an ERC-8004 agent identity.

    python register.py --dry-run     # print the agent URI (decoded), send nothing
    python register.py               # sends ONE register tx (+ a setAgentURI tx) from the agent wallet

Env: AGENT_PUBLIC_URL (required), BNB_NETWORK (default bsc-testnet), WALLET_PASSWORD,
AGENT_PRIVATE_KEY or AGENT_WALLET_ADDRESS. Keys are never printed.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys

from common import get_network, load_env, make_wallet

AGENT_NAME = "Offset Outlook Analyst"
AGENT_DESCRIPTION = (
    "Seller agent for Offset (hedged tokenized-stock pools on BSC). Given a ticker or pool id "
    "(D1-D5, T1-T5, S1-S4) it returns a strict-JSON outlook (Positive / Neutral / Cautious) with "
    "2-3 sourced reasons (news headline links via Finnhub, plus Offset's own price history) and "
    "a rolling 12-month return range. No price targets or return predictions. "
    "AI-generated outlook, not financial advice."
)


def build_endpoints(public_url: str):
    from bnbagent import AgentEndpoint

    base = public_url.rstrip("/")
    return [
        AgentEndpoint.a2a(base, version="0.3.0"),  # appends /.well-known/agent-card.json
        AgentEndpoint(name="web", endpoint=base),
    ]


def decode_agent_uri(uri: str) -> dict:
    """Decode a data:application/json;base64 agent URI for display."""
    if uri.startswith("data:") and ";base64," in uri:
        return json.loads(base64.b64decode(uri.split(";base64,", 1)[1]))
    return {"uri": uri}


def offline_agent_uri(network: str, public_url: str) -> str:
    """Generate the agent URI without any RPC connection or wallet (used by --dry-run)."""
    from bnbagent.erc8004.agent_uri import AgentURIGenerator
    from bnbagent.erc8004.constants import get_erc8004_config

    cfg = get_erc8004_config(network)
    return AgentURIGenerator.generate_agent_uri(
        name=AGENT_NAME,
        description=AGENT_DESCRIPTION,
        endpoints=build_endpoints(public_url),
        image=os.environ.get("AGENT_IMAGE_URL") or None,
        agent_id=None,
        identity_registry=cfg["registry_contract"],
        chain_id=cfg["chain_id"],
        supported_trust=None,
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="print the agent URI, send nothing")
    args = ap.parse_args(argv)

    load_env()
    network = get_network()
    public_url = (os.environ.get("AGENT_PUBLIC_URL") or "").strip()
    if not public_url:
        print("AGENT_PUBLIC_URL is required (the deployed agent's https URL).", file=sys.stderr)
        return 2

    if args.dry_run:
        uri = offline_agent_uri(network, public_url)
        print(json.dumps({"dryRun": True, "network": network, "agentURI": uri,
                          "decoded": decode_agent_uri(uri)}, indent=2))
        return 0

    from bnbagent import ERC8004Agent
    from bnbagent.exceptions import ERC8004PartialRegistrationError

    wallet = make_wallet("AGENT")
    sdk = ERC8004Agent(wallet_provider=wallet, network=network)

    existing = sdk.get_local_agent_info(AGENT_NAME)  # indexer lookup; avoids duplicate registration
    if existing:
        print(json.dumps({"alreadyRegistered": True, "agentId": existing["agent_id"],
                          "owner": existing["owner_address"], "network": network}, indent=2))
        return 0

    uri = sdk.generate_agent_uri(
        name=AGENT_NAME,
        description=AGENT_DESCRIPTION,
        endpoints=build_endpoints(public_url),
        image=os.environ.get("AGENT_IMAGE_URL") or None,
    )
    try:
        result = sdk.register_agent(agent_uri=uri)
    except ERC8004PartialRegistrationError as exc:
        # The agent exists on-chain; only the registrations-field URI update is pending.
        print(json.dumps({"partial": True, "agentId": exc.agent_id,
                          "txHash": getattr(exc, "tx_hash", None), "network": network,
                          "note": "agent registered; re-run set_agent_uri to finish"}, indent=2))
        return 1
    print(json.dumps({
        "success": True, "network": network, "agentId": result["agentId"],
        "transactionHash": result["transactionHash"], "registry": sdk.contract_address,
        "owner": sdk.wallet_address,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
