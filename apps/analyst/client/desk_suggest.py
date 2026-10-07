"""Example agent for the Keel agent desk: sign a suggestion for a user who has linked this agent's address.
usage: AGENT_KEY=0x... KEEL_URL=https://... python desk_suggest.py OWNER_ADDRESS exit T1 "Why"
The agent key only signs messages. It holds no funds and cannot touch the owner's wallet."""
import json, os, sys, time, urllib.request
from eth_account import Account
from eth_account.messages import encode_defunct


def suggest(base: str, key: str, owner: str, action: str, pool_id: str, note: str = "") -> dict:
    acct = Account.from_key(key)
    ts = int(time.time() * 1000)
    text = f"Keel desk suggestion: {action} {pool_id} for {owner.lower()} by {acct.address.lower()} at {ts} note:{note}"
    sig = acct.sign_message(encode_defunct(text=text)).signature.hex()
    body = json.dumps({"owner": owner, "agent": acct.address, "action": action, "poolId": pool_id, "note": note, "ts": ts, "signature": sig if sig.startswith("0x") else "0x" + sig}).encode()
    req = urllib.request.Request(base.rstrip("/") + "/api/desk/suggest", body, {"content-type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=20))
    except urllib.error.HTTPError as e:
        return {"error": json.load(e).get("error", str(e)), "status": e.code}


if __name__ == "__main__":
    owner, action, pool_id = sys.argv[1:4]
    print(json.dumps(suggest(os.environ.get("KEEL_URL", "http://localhost:3000"), os.environ["AGENT_KEY"], owner, action, pool_id, sys.argv[4] if len(sys.argv) > 4 else ""), indent=1))
