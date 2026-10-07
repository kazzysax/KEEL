"""Daily autonomous run of the Keel Analyst: nobody asks, it just publishes today's outlook.

Each run:
  1. refreshes daily closes for the 13 tradable assets (Yahoo chart API; if unreachable it says so and uses the last prices)
  2. builds the sourced outlook for every asset (src/outlook.py: price facts + fetched headlines, no price targets)
  3. writes public/data/outlook/<TICKER>.json (what the app shows), daily.json (today's briefing) and history/<date>.json
  4. appends an event to public/data/agents/activity.json so the run is visible on the app's Agents page

Schedule: runs at startup if today's briefing is missing, then once a day at DAILY_UTC_HOUR (default 21:30 UTC, after the US close).
Used in-process by service.py (DAILY=1) or on its own: python src/daily.py --once | --loop
"""
from __future__ import annotations
import argparse, csv, hashlib, json, logging, os, sys, threading, time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import outlook  # noqa: E402

log = logging.getLogger("daily")
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public" / "data" / "outlook"
ACT = ROOT / "public" / "data" / "agents" / "activity.json"
AGENT = os.getenv("AGENT_NAME", "keel-analyst")
RUN_HOUR_UTC = float(os.getenv("DAILY_UTC_HOUR", "21.5"))


def _http_json(url: str):
    import httpx
    r = httpx.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"}); r.raise_for_status(); return r.json()


def fetch_recent(ticker: str, fetch=_http_json) -> list[tuple[str, float, float]]:
    """Last ~1 month of (date, close, adjclose) from Yahoo's public chart endpoint."""
    j = fetch(f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=1mo&interval=1d&events=div,splits")
    res = j["chart"]["result"][0]; ts = res["timestamp"]; q = res["indicators"]["quote"][0]["close"]
    adj = (res["indicators"].get("adjclose") or [{}])[0].get("adjclose") or q
    return [(datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d"), c, a) for t, c, a in zip(ts, q, adj) if c is not None and a is not None]


def refresh_prices(fetch=_http_json) -> dict:
    """Append new daily rows to data/prices/<T>.csv. Returns {"updated": n, "failed": [..], "latest": date}."""
    updated, failed, latest = 0, [], ""
    for t in outlook.NAMES:
        f = outlook.DATA / f"{t}.csv"
        try:
            rows = list(csv.reader(open(f)))[1:]; have = rows[-1][0]
            new = [r for r in fetch_recent(t, fetch) if r[0] > have]
            if new:
                with open(f, "rb+") as fh:                      # the files may lack a trailing newline
                    fh.seek(-1, 2)
                    if fh.read(1) != b"\n": fh.write(b"\n")
                with open(f, "a", newline="") as fh:
                    w = csv.writer(fh, lineterminator="\n")
                    for d, c, a in new: w.writerow([d, c, a])
                updated += len(new)
            latest = max(latest, new[-1][0] if new else have)
        except Exception as e:
            failed.append(t); log.warning("price refresh failed for %s: %s", t, str(e)[:100])
    return {"updated": updated, "failed": failed, "latest": latest}


def log_event(ev: dict) -> None:
    ACT.parent.mkdir(parents=True, exist_ok=True)
    d = json.loads(ACT.read_text()) if ACT.exists() else {"agents": [], "events": [], "ledger": {}}
    d["events"] = ([{"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), **ev}] + d["events"])[:200]
    ACT.write_text(json.dumps(d, indent=1))


def run_once(fetch=_http_json, news=None, refresh: bool = True) -> dict:
    t0 = time.time()
    pr = refresh_prices(fetch) if refresh else {"updated": 0, "failed": [], "latest": ""}
    if pr["updated"]:
        try: __import__("community").pm.export_history()           # keep the browser's price history (custom splits) current
        except Exception: log.exception("history export failed")
    outs = [outlook.build(t, news=None if news is None else news(t)) for t in outlook.NAMES]
    OUT.mkdir(parents=True, exist_ok=True)
    for o in outs: (OUT / f"{o['ticker']}.json").write_text(json.dumps(o, indent=1))
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    price_as_of = max(o["priceAsOf"] for o in outs)
    counts = {k: sum(1 for o in outs if o["outlook"] == k) for k in ("Positive", "Neutral", "Cautious")}
    body = json.dumps(outs, sort_keys=True).encode()
    rep = {"schema": 1, "date": today, "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "agent": AGENT,
           "priceAsOf": price_as_of, "pricesRefreshed": not pr["failed"] and pr["latest"] != "", "refreshFailed": pr["failed"],
           "counts": counts, "reportHash": "0x" + hashlib.sha256(body).hexdigest(), "outlooks": outs}
    (OUT / "daily.json").write_text(json.dumps(rep, indent=1))
    (OUT / "history").mkdir(exist_ok=True); (OUT / "history" / f"{today}.json").write_text(json.dumps(rep, indent=1))
    log_event({"agent": AGENT, "type": "daily-run", "summary": f"Daily outlook for {len(outs)} assets: {counts['Positive']} positive, {counts['Neutral']} neutral, {counts['Cautious']} cautious. Prices to {price_as_of}" + (f" (refresh failed for {len(pr['failed'])} assets)" if pr["failed"] else ""),
               "reportHash": rep["reportHash"], "seconds": round(time.time() - t0, 1)})
    log.info("daily briefing %s written (%s)", today, counts)
    return rep


def _next_run(now: datetime) -> datetime:
    h = int(RUN_HOUR_UTC); m = int((RUN_HOUR_UTC - h) * 60)
    t = now.replace(hour=h, minute=m, second=0, microsecond=0)
    return t if t > now else t + timedelta(days=1)


def todays_exists() -> bool:
    f = OUT / "daily.json"
    return f.exists() and json.loads(f.read_text()).get("date") == datetime.now(timezone.utc).strftime("%Y-%m-%d")


def loop(stop: threading.Event | None = None) -> None:
    stop = stop or threading.Event()
    if not todays_exists():
        try: run_once()
        except Exception: log.exception("startup run failed")
    while not stop.is_set():
        now = datetime.now(timezone.utc); nxt = _next_run(now)
        log.info("next daily run at %s UTC", nxt.strftime("%Y-%m-%d %H:%M"))
        if stop.wait((nxt - now).total_seconds()): break
        try: run_once()
        except Exception: log.exception("daily run failed; will retry tomorrow")


def start_background() -> threading.Event:
    stop = threading.Event(); threading.Thread(target=loop, args=(stop,), daemon=True, name="daily-analyst").start(); return stop


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    ap = argparse.ArgumentParser(); g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--once", action="store_true"); g.add_argument("--loop", action="store_true"); a = ap.parse_args()
    run_once() if a.once else loop()
