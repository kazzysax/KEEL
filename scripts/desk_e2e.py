"""End-to-end check of the agent desk against a running server: python3 scripts/desk_e2e.py http://localhost:3100"""
import json, sys, time, urllib.request, urllib.error
sys.path.insert(0, "apps/analyst/client")
from eth_account import Account
from eth_account.messages import encode_defunct
from desk_suggest import suggest

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
owner, agent, stranger = Account.create(), Account.create(), Account.create()


def post(path, body):
    r = urllib.request.Request(BASE + path, json.dumps(body).encode(), {"content-type": "application/json"})
    try:
        return 200, json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def sign(acct, text):
    s = acct.sign_message(encode_defunct(text=text)).signature.hex()
    return s if s.startswith("0x") else "0x" + s


def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        sys.exit(1)


o, a = owner.address.lower(), agent.address.lower()
ts = int(time.time() * 1000)
c, _ = post("/api/desk/suggest", {})
check("empty body rejected", c == 400)
r = suggest(BASE, agent.key.hex(), owner.address, "exit", "T1", "x")
check("unlinked agent refused (403)", r.get("status") == 403)
c, _ = post("/api/desk/link", {"owner": owner.address, "agent": agent.address, "ts": ts, "signature": sign(stranger, f"Keel desk: link agent {a} to {o} at {ts}")})
check("link signed by someone else refused", c == 401)
c, _ = post("/api/desk/link", {"owner": owner.address, "agent": agent.address, "ts": ts - 10 * 60_000, "signature": sign(owner, f"Keel desk: link agent {a} to {o} at {ts - 10 * 60_000}")})
check("expired signature refused", c == 400)
c, d = post("/api/desk/link", {"owner": owner.address, "agent": agent.address, "label": "Test", "ts": ts, "signature": sign(owner, f"Keel desk: link agent {a} to {o} at {ts}")})
check("owner links agent", c == 200 and d["links"][0]["agent"] == a)
r = suggest(BASE, agent.key.hex(), owner.address, "exit", "T1", "Drawdown deepening")
check("linked agent suggestion accepted", r.get("status") == "pending")
check("duplicate pending refused", "Already pending" in suggest(BASE, agent.key.hex(), owner.address, "exit", "T1", "again").get("error", ""))
check("unknown pool refused", "Unknown poolId" in suggest(BASE, agent.key.hex(), owner.address, "add", "ZZ9", "").get("error", ""))
bad = suggest(BASE, stranger.key.hex(), owner.address, "exit", "T2", "")
check("unlinked stranger refused", bad.get("status") == 403)
ts2 = int(time.time() * 1000)
c, _ = post("/api/desk/resolve", {"owner": owner.address, "id": r["id"], "status": "approved", "ts": ts2, "signature": sign(agent, f"Keel desk: approved {r['id']} for {o} at {ts2}")})
check("agent cannot approve its own suggestion", c == 401)
c, d = post("/api/desk/resolve", {"owner": owner.address, "id": r["id"], "status": "approved", "ts": ts2, "signature": sign(owner, f"Keel desk: approved {r['id']} for {o} at {ts2}")})
check("owner approves", c == 200 and d["suggestions"][0]["status"] == "approved")
r2 = suggest(BASE, agent.key.hex(), owner.address, "add", "C1", "Looks good")
ts3 = int(time.time() * 1000)
c, d = post("/api/desk/link", {"owner": owner.address, "agent": agent.address, "revoke": True, "ts": ts3, "signature": sign(owner, f"Keel desk: revoke agent {a} from {o} at {ts3}")})
check("owner revokes; pending dismissed", c == 200 and all(s["status"] != "pending" for s in d["suggestions"]))
check("revoked agent refused", suggest(BASE, agent.key.hex(), owner.address, "exit", "T3", "").get("status") == 403)
print("desk e2e: all passed")
