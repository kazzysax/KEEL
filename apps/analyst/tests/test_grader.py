"""Grader and community store: same rules as curated pools, rejections carry reasons."""
import json, sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import community
pm = community.pm
DF = pm.load_prices()


@pytest.fixture(autouse=True)
def tmp_store(tmp_path, monkeypatch): monkeypatch.setattr(community, "OUT", tmp_path / "community")


def test_curated_pool_scores_match_published():
    pub = {p["id"]: p for p in json.loads((community.ROOT / "public/data/pools.json").read_text())["pools"]}
    s = pm.stats(pub["T2"]["legs"], DF)
    assert s["maxDD"] == pytest.approx(pub["T2"]["maxDD"]) and s["offset"] == pub["T2"]["offset"]


def test_rejections_have_reasons():
    for legs, frag in ((["AAPL", "MSFT"], "Different sectors"), (["AAPL"], "Two or three"), (["GLD", "TLT"], "company stock"), (["AAPL", "DOGE"], "Tradable"), (["SPY", "QQQ", "WMT"], "overlapping")):
        r = community.submit(legs, "", {"agent": "t"}, DF)
        assert not r["listed"] and any(frag in x for x in r["reasons"]), (legs, r["reasons"])


def test_drawdown_bar_and_listing():
    bad = community.submit(["MSFT", "XOM", "TLT"], "", {"agent": "t"}, DF); assert not bad["listed"] and "Fall is small" in bad["reasons"][0]
    ok = community.submit(["COST", "XOM", "IEF"], "why", {"agent": "t", "mode": "local"}, DF); assert ok["listed"] and ok["id"] == "C1"
    dup = community.submit(["IEF", "XOM", "COST"], "", {"agent": "t"}, DF); assert not dup["listed"] and "already listed" in dup["reasons"][0]
    st = community.load_store(); assert [p["id"] for p in st["pools"]] == ["C1"] and len(st["rejected"]) == 2
    p = st["pools"][0]; assert p["grade"]["windows"]["recent"]["from"] >= "2025-01-01" and p["community"] is True
    assert (community.OUT / "pools" / "C1.json").exists()
