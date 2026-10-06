"""Offline tests: no network, no chain, no keys. Finnhub is mocked via http_get."""
from __future__ import annotations

import asyncio
import copy
import json
from datetime import date, datetime, timezone

import pytest

import outlook as o

TODAY = date(2026, 10, 6)
URL1 = "https://news.example.com/a1"
URL2 = "https://news.example.com/a2"


def ts(d: str) -> int:
    return int(datetime.fromisoformat(d + "T12:00:00+00:00").timestamp())


def good_doc(sources=o.SOURCES_FINNHUB):
    return {
        "ticker": "AAPL",
        "outlook": "Neutral",
        "reasons": [
            {"text": "Apple unveils new product line (Reuters)", "sourceUrl": URL1,
             "publishedAt": "2026-10-05T12:00:00Z"},
            {"text": "Apple is 3.0% below its 52-week high as of 2026-10-06.",
             "sourceUrl": None, "publishedAt": "2026-10-06"},
        ],
        "asOf": "2026-10-06",
        "history": {"r12": {"p5": -0.08, "p50": 0.2, "p95": 0.6, "min": -0.3, "max": 1.2,
                            "pctPositive": 0.88}},
        "sources": sources,
        "disclaimer": o.DISCLAIMER,
    }


# ---------------------------------------------------------------- validator

def test_validator_accepts_good_doc():
    assert o.validate_outlook(good_doc(), {URL1})["ticker"] == "AAPL"


def test_validator_rejects_url_not_in_fetched_set():
    d = good_doc()
    d["reasons"][0]["sourceUrl"] = "https://made.up/fake"
    with pytest.raises(o.OutlookValidationError) as e:
        o.validate_outlook(d, {URL1})
    assert "not in the fetched set" in str(e.value)


@pytest.mark.parametrize("text", [
    "Analyst sets price target of $250 on Apple",
    "Apple will reach $300 by year end",
    "Expected return of 12% next year",
    "Shares forecast to rise 10%",
    "Upside to $280 seen",
    "Predicted return 8%",
])
def test_validator_rejects_targets_and_predictions(text):
    d = good_doc()
    d["reasons"][1]["text"] = text
    with pytest.raises(o.OutlookValidationError) as e:
        o.validate_outlook(d, {URL1})
    assert "price target or predicted return" in str(e.value)


def test_validator_rejects_forbidden_keys():
    d = good_doc()
    d["priceTarget"] = 250
    with pytest.raises(o.OutlookValidationError):
        o.validate_outlook(d, {URL1})
    d = good_doc()
    d["history"]["r12"]["predictedReturn"] = 0.1
    with pytest.raises(o.OutlookValidationError):
        o.validate_outlook(d, {URL1})


def test_validator_requires_disclaimer_and_reason_count():
    d = good_doc()
    d["disclaimer"] = "whatever"
    with pytest.raises(o.OutlookValidationError):
        o.validate_outlook(d, {URL1})
    d = good_doc()
    d["reasons"] = d["reasons"][:1]
    with pytest.raises(o.OutlookValidationError):
        o.validate_outlook(d, {URL1})
    d = good_doc()
    d["reasons"] = d["reasons"] * 2
    with pytest.raises(o.OutlookValidationError):
        o.validate_outlook(d, {URL1})


def test_validator_history_only_forbids_links_and_bad_label():
    d = good_doc(sources=o.SOURCES_HISTORY_ONLY)
    with pytest.raises(o.OutlookValidationError) as e:
        o.validate_outlook(d, {URL1})
    assert "history-only" in str(e.value)
    d = good_doc()
    d["outlook"] = "Bullish"
    with pytest.raises(o.OutlookValidationError):
        o.validate_outlook(d, {URL1})
    d = good_doc()
    d["extra"] = 1
    with pytest.raises(o.OutlookValidationError):
        o.validate_outlook(d, {URL1})


# ---------------------------------------------------------- history-only path

def test_history_only_without_finnhub_key():
    doc = o.build_outlook("AAPL", finnhub=None, today=TODAY, llm=False)
    assert doc["sources"] == "historical data only"
    assert doc["disclaimer"] == o.DISCLAIMER
    assert 2 <= len(doc["reasons"]) <= 3
    assert all(r["sourceUrl"] is None for r in doc["reasons"])  # no fake links
    assert doc["outlook"] in o.OUTLOOKS
    assert set(doc["history"]["r12"]) == {"p5", "p50", "p95", "min", "max", "pctPositive"}
    json.dumps(doc)  # strict-JSON serializable


def test_history_only_pool():
    doc = o.build_outlook("D1", finnhub=None, today=TODAY, llm=False)
    assert doc["ticker"] == "D1" and doc["sources"] == "historical data only"
    assert doc["history"]["r12"]["p50"] == pytest.approx(0.2179, abs=1e-3)  # from pools json


def test_unknown_subject():
    with pytest.raises(o.OutlookError) as e:
        o.build_outlook("ZZZZ", finnhub=None, today=TODAY, llm=False)
    assert e.value.code == "unsupported_subject"


def test_llm_off_by_default(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    assert o.llm_rewrite([{"text": "x"}], http_post=lambda *a: pytest.fail("called")) is None


# ------------------------------------------------------------ Finnhub (mocked)

def fake_http(news, earnings=None, fail=False):
    calls = []

    def get(url, params, headers, timeout):
        calls.append((url, params, headers))
        assert "token" not in params  # key goes in header, not URL
        if fail:
            raise RuntimeError("boom https://secret")
        if url.endswith("/company-news"):
            return news
        return {"earningsCalendar": earnings or []}

    get.calls = calls
    return get


def news_item(url, headline, d, **kw):
    return {"url": url, "headline": headline, "source": "Reuters", "datetime": ts(d),
            "summary": "ARTICLE BODY MUST NOT APPEAR", "image": "x", **kw}


def test_finnhub_path_uses_only_fetched_links_and_drops_bodies():
    http = fake_http([
        news_item(URL1, "Apple beats expectations, shares surge", "2026-10-05"),
        news_item(URL2, "Apple record quarter, analysts upgrade", "2026-10-04"),
        news_item(URL2 + "x", "Analyst raises price target to $300", "2026-10-03"),
    ])
    fh = o.FinnhubClient("KEY", http_get=http, limiter=o.RateLimiter(60, 60))
    doc = o.build_outlook("AAPL", finnhub=fh, today=TODAY, llm=False)
    assert doc["sources"] == o.SOURCES_FINNHUB
    links = [r["sourceUrl"] for r in doc["reasons"] if r["sourceUrl"]]
    assert links and set(links) <= {URL1, URL2, URL2 + "x"}
    assert URL2 + "x" not in links  # price-target headline never used as a reason
    assert "ARTICLE BODY" not in json.dumps(doc)
    assert all(h["X-Finnhub-Token"] == "KEY" for _, _, h in http.calls)


def test_earnings_flag_caps_positive_to_neutral():
    assert o.score_signals(0.2, -0.01, 2, earnings_soon=False)[1] == "Positive"
    assert o.score_signals(0.2, -0.01, 2, earnings_soon=True)[1] == "Neutral"
    assert o.score_signals(-0.2, -0.3, -3, False)[1] == "Cautious"


def test_finnhub_failure_falls_back_to_history_only():
    fh = o.FinnhubClient("KEY", http_get=fake_http([], fail=True), limiter=o.RateLimiter(60, 60))
    doc = o.build_outlook("AAPL", finnhub=fh, today=TODAY, llm=False)
    assert doc["sources"] == "historical data only"
    assert doc["warnings"] and "secret" not in json.dumps(doc)
    assert all(r["sourceUrl"] is None for r in doc["reasons"])


def test_rate_limiter_blocks_after_budget():
    t = [0.0]
    slept = []

    def sleep(s):
        slept.append(s)
        t[0] += s

    rl = o.RateLimiter(2, 60, clock=lambda: t[0], sleep=sleep)
    rl.acquire(); rl.acquire(); rl.acquire()
    assert slept and t[0] >= 60


def test_llm_rewrite_cannot_inject_target(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    reasons = good_doc()["reasons"]
    bad = lambda *a: {"choices": [{"message": {"content": json.dumps(
        ["Apple has a price target of $300", "Fine sentence."])}}]}
    texts = o.llm_rewrite(reasons, http_post=bad)
    assert texts is not None  # rewrite returned...
    d = good_doc()
    for r, t in zip(d["reasons"], texts):
        r["text"] = t
    with pytest.raises(o.OutlookValidationError):  # ...but the validator rejects it
        o.validate_outlook(d, {URL1})
    # and build_outlook keeps rule-based text when the rewrite is rejected
    doc = o.build_outlook("AAPL", finnhub=None, today=TODAY, llm=True, llm_http_post=bad)
    assert "price target" not in json.dumps(doc).lower()


# --------------------------------------------------------- request parsing

U = {"AAPL", "MSFT", "D1", "S4"}


@pytest.mark.parametrize("text,expected", [
    ('{"ticker":"aapl"}', "AAPL"),
    ('{"pool":"D1"}', "D1"),
    ("Please give me an outlook for msft", "MSFT"),
    (json.dumps({"version": 1, "task": "Outlook for S4", "terms": {"deliverables": "x"},
                 "negotiation_hash": "0xd1" + "ab" * 31}), "S4"),
    ("outlook for AAPL and MSFT", None),   # ambiguous
    ("outlook for TSLA", None),            # unknown
    ("", None),
])
def test_parse_request(text, expected):
    assert o.parse_outlook_request(text, U) == expected


# ------------------------------------------- provider / register (offline)

def test_price_to_units():
    import provider

    assert provider.price_to_units("0.01", 18) == 10**16
    assert provider.price_to_units("0.01", 6) == 10_000
    with pytest.raises(ValueError):
        provider.price_to_units("0.0000001", 6)


class FakeOps:
    def __init__(self, result):
        self.result, self.calls = result, []

    async def submit_result(self, jid, content, metadata=None):
        self.calls.append((jid, json.loads(content), metadata))
        return self.result


def run_funded(ops, description):
    import provider

    cb = provider.make_on_funded(ops, set(o.load_universe()[0]) | set(o.load_universe()[1]), None)
    return asyncio.run(cb({"jobId": 7, "description": description}))


def test_on_funded_submits_validated_outlook():
    ops = FakeOps({"success": True, "txHash": "0x1", "deliverable": "0x2"})
    assert run_funded(ops, '{"task":"Outlook for AAPL"}') is None
    jid, payload, meta = ops.calls[0]
    assert jid == 7 and payload["ticker"] == "AAPL" and payload["disclaimer"] == o.DISCLAIMER


@pytest.mark.parametrize("res,retry", [
    ({"success": False, "error_code": "chain_unavailable", "retryable": True}, True),
    ({"success": False, "error_code": "budget_too_low"}, False),
    ({"success": False, "error_code": "tx_pending", "retryable": False, "tx_hash": "0x9"}, False),
])
def test_on_funded_error_code_semantics(res, retry):
    out = run_funded(FakeOps(res), '{"ticker":"D1"}')
    assert (out == {"retry": True}) is retry


def test_on_funded_unparseable_description_not_submitted():
    ops = FakeOps({"success": True, "txHash": "0x1", "deliverable": "0x2"})
    assert run_funded(ops, "do something nice") is None and ops.calls == []


def test_register_dry_run_offline(monkeypatch, capsys):
    import register

    monkeypatch.setenv("AGENT_PUBLIC_URL", "https://agent.example")
    monkeypatch.delenv("BNB_NETWORK", raising=False)
    monkeypatch.setenv("AGENT_PRIVATE_KEY", "0x" + "11" * 32)
    assert register.main(["--dry-run"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["network"] == "bsc-testnet" and out["dryRun"] is True
    assert out["decoded"]["name"] == "Offset Outlook Analyst"
    assert out["decoded"]["services"][0]["endpoint"].endswith("/.well-known/agent-card.json")
    assert "11" * 32 not in json.dumps(out)


def test_mainnet_needs_double_opt_in(monkeypatch):
    import common

    monkeypatch.setenv("BNB_NETWORK", "bsc-mainnet")
    monkeypatch.delenv("BNB_ALLOW_MAINNET", raising=False)
    with pytest.raises(SystemExit):
        common.get_network()
