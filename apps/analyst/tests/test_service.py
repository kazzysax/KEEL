"""/daily answers 402, accepts a signed payment, returns the briefing. Chain is faked; the ERC-8183 app is not needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bnbagent.wallets import EVMWalletProvider
import daily, paid_routes, x402_buyer as B, x402_seller as S


class Fake:
    def __init__(s): s.n, s.tx = set(), []
    def used(s, p, n): return n in s.n
    def settle(s, a, v, r, sg): s.n.add(a["nonce"]); s.tx.append(a["value"]); return "0xfeed"


def test_daily_paid_flow(tmp_path, monkeypatch):
    monkeypatch.setattr(daily, "ACT", tmp_path / "act.json")
    seller = S.Seller(pay_to=EVMWalletProvider(password="pw", private_key="0x" + "22" * 32, persist=False).address, price_atomic=5 * 10 ** 16, settler=Fake())
    app = FastAPI(); paid_routes.install(app, seller, "keel-analyst"); c = TestClient(app)
    r = c.get("/daily"); assert r.status_code == 402 and r.json()["accepts"][0]["amount"] == str(5 * 10 ** 16) and "payment-required" in r.headers
    buyer = EVMWalletProvider(password="pw", private_key="0x" + "11" * 32, persist=False)
    j, paid = B.Payer(buyer).fetch("http://testserver/daily", client=c)
    assert j["agent"] == "keel-analyst" and len(j["outlooks"]) == 13 and paid["amount"] == str(5 * 10 ** 16)
    assert seller.settler.tx == [str(5 * 10 ** 16)]
    assert c.get("/daily", headers={"PAYMENT-SIGNATURE": "junk"}).status_code == 402
    assert "x402-payment" in (tmp_path / "act.json").read_text()


def test_daily_free_when_no_seller():
    app = FastAPI(); paid_routes.install(app, None, "keel-analyst")
    assert TestClient(app).get("/daily").status_code == 200
