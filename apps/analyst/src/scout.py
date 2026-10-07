"""Keel Scout: a proposing agent. It looks for pool ideas, buys the Analyst's outlook for the assets involved,
and submits the best ideas to the Keel Grader. It optimises for the offset score and has no knowledge of the Grader's
drawdown-to-growth bar, so some of its ideas are rejected, which is the point of an independent grader.

  python src/scout.py --local       dry run: calls the Analyst and Grader in-process (no chain)
  (on-chain mode uses client/propose.py: hires the Analyst, then opens a job with the Grader)
"""
from __future__ import annotations
import argparse, itertools, json, logging, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import community, daily, outlook  # noqa: E402
pm = community.pm
log = logging.getLogger("scout")


def candidates(df, curated: list[list[str]], top: int) -> list[dict]:
    """Rank new combinations by offset score. Structural rules only; the drawdown bar is the Grader's job."""
    taken = [set(c) for c in curated]; out = []
    for n in (2, 3):
        for legs in itertools.combinations(pm.A, n):
            if set(legs) in taken or not all(c["ok"] for c in pm.structural_checks(list(legs))): continue
            s = pm.stats(list(legs), df); out.append({"legs": list(legs), "offset": s["offset"], "maxDD": s["maxDD"]})
    # the Scout's own taste: high offset score and a shallow worst fall. It does not look at growth, which is the Grader's extra test.
    out.sort(key=lambda c: -(c["offset"] - 50 * abs(c["maxDD"])))
    return out[:top]


def plan(top: int = 8, get_outlook=None, scan: int = 60) -> list[dict]:
    """The Scout's ideas, best first: [{"legs", "rationale"}]. get_outlook(ticker) -> outlook dict (from the Analyst)."""
    df = pm.load_prices(); store = community.load_store()
    taken = community.curated_sets() + [p["legs"] for p in store["pools"]]
    cache: dict = {}
    base = get_outlook or (lambda t: outlook.build(t))
    get_outlook = lambda t: cache.setdefault(t, base(t))
    out = []
    for c in candidates(df, taken, scan):
        if len(out) >= top: break
        labels = {t: get_outlook(t)["outlook"] for t in c["legs"]}
        if any(labels[t] == "Cautious" for t in c["legs"] if pm.A[t][1] == "stock"):
            log.info("skip %s: a stock leg is Cautious today %s", c["legs"], labels); continue   # diversifiers may be Cautious; the stock legs carry the growth
        names = ", ".join(f"{pm.A[t][2]} {labels[t].lower()}" for t in c["legs"])
        out.append({"legs": c["legs"], "rationale": f"Falls rarely line up: offset score {c['offset']} over 2020 to today. Today's Analyst outlook: {names}."})
    return out


def propose(top: int = 8, agent: dict | None = None, get_outlook=None) -> list[dict]:
    """Local dry run: grade the ideas in-process (no chain)."""
    df = pm.load_prices()
    proposer = agent or {"agent": "keel-scout", "agentId": None, "mode": "local", "jobId": None}
    results = []
    for p in plan(top, get_outlook):
        r = community.submit(p["legs"], p["rationale"], proposer, df); r["legs"] = p["legs"]; results.append(r)
        daily.log_event({"agent": "keel-grader", "type": "grade", "mode": proposer.get("mode", "local"),
                         "summary": f"Graded {' + '.join(p['legs'])} from {proposer['agent']}: " + (f"listed as {r['id']}" if r["listed"] else "rejected, " + r["reasons"][0])})
        log.info("%s -> %s", p["legs"], f"listed {r['id']}" if r["listed"] else r["reasons"][0])
    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ap = argparse.ArgumentParser(); ap.add_argument("--local", action="store_true"); ap.add_argument("--top", type=int, default=8)
    a = ap.parse_args()
    res = propose(a.top)
    print(json.dumps([{"legs": r["legs"], "listed": r["listed"], "id": r["id"]} for r in res]))
