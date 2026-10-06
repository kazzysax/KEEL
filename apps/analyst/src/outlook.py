"""Outlook engine for the Keel Analyst agent.

Rules (so the output is safe to show next to a buy button):
  * every number comes from a tool result (price CSV or fetched headlines), never from a model's memory
  * no predicted profit figure, no price target: the output is a label plus sourced reasons
  * every news reason must carry a URL that was actually fetched; anything else is dropped
  * the historical 12-month range is labelled as past data
"""
from __future__ import annotations

import csv, json, logging, math, os, re, statistics
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("outlook")
DATA = Path(__file__).resolve().parent.parent / "data"
NAMES = {"AAPL": "Apple", "MSFT": "Microsoft", "WMT": "Walmart", "COST": "Costco", "KO": "Coca-Cola", "JNJ": "Johnson & Johnson",
         "XOM": "Exxon Mobil", "SPY": "S&P 500 ETF", "QQQ": "Nasdaq-100 ETF", "GLD": "gold", "SHY": "short-term US Treasuries",
         "IEF": "7-10 year US Treasuries", "TLT": "20+ year US Treasuries"}
DISCLAIMER = "AI-generated summary of linked sources and past prices. Not investment advice. Past returns do not predict future results."
FORBIDDEN = re.compile(r"\b(will (reach|hit|rise|fall|rally|crash)|price target|target price|forecast(ed)? (return|profit)|expected (return|profit)|guaranteed|can't lose)\b", re.I)
POS = {"beats", "beat", "record", "raises", "raised", "upgrade", "upgraded", "growth", "surge", "surges", "strong", "gains", "profit", "outperform", "buyback", "dividend increase"}
NEG = {"miss", "misses", "cuts", "cut", "downgrade", "downgraded", "lawsuit", "probe", "recall", "falls", "plunge", "weak", "layoffs", "warning", "warns", "investigation", "decline", "slump"}


def load_closes(t: str) -> list[tuple[str, float]]:
    rows = []
    with open(DATA / f"{t}.csv") as f:
        for r in csv.DictReader(f):
            rows.append((r["date"], float(r["adjclose"])))
    return rows


def price_facts(t: str) -> dict:
    c = load_closes(t); px = [p for _, p in c]; last = px[-1]
    def ret(n): return last / px[-1 - n] - 1 if len(px) > n else None
    hi52 = max(px[-252:]); ma200 = statistics.fmean(px[-200:])
    d = [px[i] / px[i - 1] - 1 for i in range(len(px) - 30, len(px))]
    vol30 = statistics.pstdev(d) * math.sqrt(252)
    r12 = sorted(px[i] / px[i - 252] - 1 for i in range(252, len(px)))
    q = lambda p: r12[min(len(r12) - 1, int(p * len(r12)))]
    return {"asOf": c[-1][0], "ret1m": ret(21), "ret3m": ret(63), "ret12m": ret(252), "offHigh": last / hi52 - 1, "aboveMA200": last / ma200 - 1,
            "vol30": vol30, "hist12m": {"p5": q(.05), "p50": q(.5), "p95": q(.95), "min": r12[0], "max": r12[-1], "windows": len(r12)}}


def fetch_news(t: str, n: int = 6) -> list[dict]:
    try:
        from ddgs import DDGS
        q = f"{NAMES.get(t, t)} {'stock' if t not in ('GLD','SHY','IEF','TLT') else 'price'} news"
        out = []
        for r in DDGS().news(q, max_results=n):
            url = r.get("url") or r.get("href")
            if url and r.get("title"):
                out.append({"title": r["title"], "url": url, "date": r.get("date", ""), "source": r.get("source", "")})
        return out
    except Exception as e:  # network blocked or rate limited: price-only outlook, said so in output
        log.warning("news fetch failed for %s: %s", t, e); return []


def headline_score(items: list[dict]) -> int:
    s = 0
    for it in items:
        w = set(re.findall(r"[a-z']+", it["title"].lower()))
        s += len(w & POS) - len(w & NEG)
    return s


def pct(x): return f"{x*100:+.0f}%"


def build(t: str, news: list[dict] | None = None, llm=None) -> dict:
    f = price_facts(t); news = fetch_news(t) if news is None else news
    sig = 0; reasons = []
    if f["ret3m"] is not None:
        sig += 1 if f["ret3m"] > 0.03 else -1 if f["ret3m"] < -0.05 else 0
        reasons.append({"kind": "price", "text": f"Past 3 months: {pct(f['ret3m'])}; past 12 months: {pct(f['ret12m'])} (historical closes).", "sourceUrl": None, "publishedAt": f["asOf"]})
    sig += 1 if f["aboveMA200"] > 0 else -1
    reasons.append({"kind": "price", "text": f"Trades {pct(f['aboveMA200'])} vs its 200-day average and {pct(f['offHigh'])} from its 52-week high.", "sourceUrl": None, "publishedAt": f["asOf"]})
    if f["vol30"] > 0.35:
        sig -= 1; reasons.append({"kind": "price", "text": f"Recent volatility is high ({f['vol30']*100:.0f}% annualised over 30 days).", "sourceUrl": None, "publishedAt": f["asOf"]})
    ns = headline_score(news) if news else 0
    sig += 1 if ns >= 2 else -1 if ns <= -2 else 0
    for it in news[:3]:
        reasons.append({"kind": "news", "text": it["title"], "sourceUrl": it["url"], "publishedAt": it["date"]})
    if not news: reasons.append({"kind": "note", "text": "No headlines could be fetched, so this outlook uses price data only.", "sourceUrl": None, "publishedAt": None})
    label = "Positive" if sig >= 2 else "Cautious" if sig <= -1 else "Neutral"
    out = {"ticker": t, "name": NAMES.get(t, t), "outlook": label, "reasons": reasons, "historical12m": f["hist12m"], "asOf": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "priceAsOf": f["asOf"], "method": "rules+headline-lexicon", "disclaimer": DISCLAIMER}
    if llm:  # optional: model rewrites reasons from the SAME fetched facts; validation below still applies
        try: out = llm(out, news) or out
        except Exception as e: log.warning("llm step skipped: %s", e)
    return validate(out, {n["url"] for n in news})


def validate(o: dict, allowed_urls: set[str]) -> dict:
    if o["outlook"] not in ("Positive", "Neutral", "Cautious"): raise ValueError("bad label")
    keep = []
    for r in o["reasons"]:
        if FORBIDDEN.search(r["text"]): continue                       # no forecasts
        if r["kind"] == "news" and r["sourceUrl"] not in allowed_urls: continue  # no invented sources
        keep.append(r)
    if not keep: raise ValueError("no valid reasons")
    o["reasons"] = keep; return o


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    outdir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    for t in NAMES:
        o = build(t); print(t, o["outlook"], len(o["reasons"]), "reasons")
        if outdir: outdir.mkdir(parents=True, exist_ok=True); (outdir / f"{t}.json").write_text(json.dumps(o, indent=1))
