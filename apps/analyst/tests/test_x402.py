"""Offline x402 tests: real EIP-712 signing and verification, fake chain. Run: python -I -m pytest apps/analyst/tests -q"""
import base64, json, sys, time
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from bnbagent.wallets import EVMWalletProvider
import x402_buyer as B, x402_seller as S

buyer = EVMWalletProvider(password="pw", private_key="0x" + "11" * 32, persist=False)
other = EVMWalletProvider(password="pw", private_key="0x" + "22" * 32, persist=False)


class Fake:
    def __init__(s): s.nonces, s.txs = set(), []
    def used(s, p, n): return n in s.nonces
    def settle(s, a, v, r, sg): s.nonces.add(a["nonce"]); s.txs.append(a["value"]); return "0xabc"


@pytest.fixture
def env():
    f = Fake(); sel = S.Seller(pay_to=other.address, price_atomic=5 * 10 ** 16, settler=f)
    return f, sel, sel.challenge("https://x/daily")["accepts"][0], B.Payer(buyer)


def test_paid_flow(env):
    f, sel, opt, p = env; rc = sel.charge(p.header(opt))
    assert rc["payer"] == buyer.address and f.txs == [str(5 * 10 ** 16)] and rc["txHash"] == "0xabc"


def test_replay_rejected(env):
    _, sel, opt, p = env; h = p.header(opt); sel.charge(h)
    with pytest.raises(S.PaymentError, match="already used"): sel.charge(h)


def test_underpay_wrong_payee_forged_payer_garbage(env):
    _, sel, opt, p = env
    with pytest.raises(S.PaymentError, match="amount too low"): sel.charge(B.Payer(buyer, max_per_call=10 ** 18).header({**opt, "amount": "1"}))
    with pytest.raises(S.PaymentError, match="not addressed"): sel.charge(p.header({**opt, "payTo": buyer.address}))
    h = json.loads(base64.b64decode(p.header(opt))); h["payload"]["authorization"]["from"] = other.address
    with pytest.raises(S.PaymentError, match="does not match payer"): sel.charge(base64.b64encode(json.dumps(h).encode()).decode())
    with pytest.raises(S.PaymentError, match="malformed"): sel.charge("not-base64!!")


def test_buyer_caps(env):
    _, _, opt, _ = env
    with pytest.raises(Exception, match="exceeds max_value_per_call"): B.Payer(buyer, max_per_call=10 ** 16).header(opt)
    p = B.Payer(buyer, max_per_call=10 ** 17, budget=10 ** 17)          # budget fits two 0.05 payments, not three
    p.header(opt); p.header(opt)
    with pytest.raises(Exception, match="budget"): p.header(opt)


def test_settlement_failure_releases_nonce(env):
    f, sel, opt, p = env
    class Boom(Fake):
        def settle(s, *a): raise RuntimeError("rpc down")
    sel.settler = Boom(); h = p.header(opt)
    with pytest.raises(S.PaymentError, match="settlement failed"): sel.charge(h)
    sel.settler = f; assert sel.charge(h)["txHash"] == "0xabc"          # same authorization can be retried
