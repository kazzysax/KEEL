"""Community pools: proposals from outside agents, graded by Keel with the same math as the curated pools.

submit() is the single entry point used by the Grader agent (on-chain job) and by the Scout's local dry run.
Output is static JSON under public/data/community/ that the web app reads:
  pools.json            listed pools (same fields as curated pools, plus grade/proposer/rationale) + recent rejections
  pools/<id>.json       2-year rebased series for the chart
"""
from __future__ import annotations
import json, sys, time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
import poolmath as pm  # noqa: E402

OUT = ROOT / "public" / "data" / "community"
KINDS = {2: "duo", 3: "trio"}
MAX_REJECTED_KEPT = 12


def _now() -> str: return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_store() -> dict:
    f = OUT / "pools.json"
    if f.exists(): return json.loads(f.read_text())
    return {"asOf": None, "pools": [], "rejected": []}


def curated_sets() -> list[list[str]]:
    return [p["legs"] for p in json.loads((ROOT / "public" / "data" / "pools.json").read_text())["pools"]]


def _kind(legs, df) -> str:
    stocks = all(pm.A[l][1] == "stock" for l in legs)
    return "pair" if len(legs) == 2 and stocks else KINDS[len(legs)]


def submit(legs: list[str], rationale: str, proposer: dict, df=None) -> dict:
    """Grade one proposal. Returns {"listed": bool, "id": str|None, "checks": [...], "reasons": [...]}."""
    df = df if df is not None else pm.load_prices()
    legs = [str(l).upper().strip() for l in legs][:4]
    store = load_store()
    g = pm.grade(legs, df, taken=curated_sets() + [p["legs"] for p in store["pools"]])
    rationale = (rationale or "").strip()[:500]
    now = _now()
    if not g["pass_"]:
        reasons = [f"{c['name']}: {c['detail']}" for c in g["checks"] if not c["ok"]]
        store["rejected"] = ([{"legs": legs, "reasons": reasons, "proposer": proposer, "at": now, "rationale": rationale}] + store["rejected"])[:MAX_REJECTED_KEPT]
        store["asOf"] = now; _write(store)
        return {"listed": False, "id": None, "checks": g["checks"], "reasons": reasons}
    n = 1 + max([int(p["id"][1:]) for p in store["pools"]] or [0]); pid = f"C{n}"
    s = g["stats"]; last = df.index[-1]; w2 = df[df.index >= last - __import__("pandas").DateOffset(years=2)]
    rel = w2[legs] / w2[legs].iloc[0] * 100; pool = rel.mean(axis=1)
    series = [dict(d=d.strftime("%Y-%m-%d"), **{l: round(float(rel.loc[d, l]), 2) for l in legs}, POOL=round(float(pool.loc[d]), 2)) for d in rel.index]
    step = max(1, len(pool) // 48); spark = [round(float(v), 1) for v in pool.iloc[::step]]
    rec = dict(id=pid, kind=_kind(legs, df), legs=legs, weights=[round(1 / len(legs), 4)] * len(legs),
               name=" + ".join(pm.A[l][2] for l in legs), **s)
    (OUT / "pools").mkdir(parents=True, exist_ok=True)
    (OUT / "pools" / f"{pid}.json").write_text(json.dumps({**rec, "series": series}, separators=(",", ":")))
    store["pools"].append({**rec, "spark": spark, "community": True, "rationale": rationale, "proposer": proposer, "listedAt": now,
                           "listedPrices": {l: round(float(df[l].iloc[-1]), 2) for l in legs}, "priceAsOf": str(last.date()),
                           "grade": {"pass": True, "checks": g["checks"], "windows": g["windows"]}})
    store["asOf"] = now; _write(store)
    return {"listed": True, "id": pid, "checks": g["checks"], "reasons": []}


def _write(store: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True); (OUT / "pools.json").write_text(json.dumps(store, indent=1))
