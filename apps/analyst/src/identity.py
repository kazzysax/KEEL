"""Publish an agent's on-chain identity to the files the website reads (agents page, /connect, outlook card)."""
import json, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "public" / "data"
SCAN = {"bsc-mainnet": "https://bscscan.com", "bsc-testnet": "https://testnet.bscscan.com"}


def announce(name: str, agent_id: str, address: str, network: str, registry: str = "") -> None:
    base = SCAN.get(network, SCAN["bsc-mainnet"])
    f = DATA / "agents" / "activity.json"
    a = json.loads(f.read_text()) if f.exists() else {"agents": [], "events": [], "ledger": {"earnedU": 0, "spentU": 0, "gasBNB": 0, "note": ""}}
    for card in a["agents"]:
        if card["name"] == name:
            card.update(agentId=str(agent_id), address=address, explorer=f"{base}/address/{address}", network=network.replace("bsc-", "bsc "), status="live")
    f.write_text(json.dumps(a, indent=1))
    if name.endswith("analyst"):
        (DATA / "outlook").mkdir(parents=True, exist_ok=True)
        (DATA / "outlook" / "agent.json").write_text(json.dumps({"agentId": str(agent_id), "registry": registry, "explorer": f"{base}/address/{address}"}, indent=1))
