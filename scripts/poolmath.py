"""Shared pool math for Keel: used by precompute.py (curated pools) and the Grader agent (community pools).

One definition of every figure, so a community pool is scored by exactly the same rules as a curated one.
Equal-weight buy-and-hold on dividend-adjusted daily closes, no rebalancing.
"""
from __future__ import annotations
import os
from pathlib import Path
import numpy as np, pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PRICES = Path(os.environ.get('KEEL_PRICES', ROOT / 'data' / 'prices'))
START = '2020-01-02'
DD_TO_GROWTH_MAX = 1.5   # the curated-pool bar: worst drawdown must not exceed 1.5x average yearly growth
# asset -> (group, kind, label, source csv)
A = {
 'AAPL': ('tech', 'stock', 'Apple', 'AAPL'),
 'MSFT': ('tech', 'stock', 'Microsoft', 'MSFT'),
 'WMT': ('retail', 'stock', 'Walmart', 'WMT'),
 'COST': ('retail2', 'stock', 'Costco', 'COST'),
 'KO': ('bev', 'stock', 'Coca-Cola', 'KO'),
 'JNJ': ('health', 'stock', 'Johnson & Johnson', 'JNJ'),
 'XOM': ('energy', 'stock', 'Exxon Mobil', 'XOM'),
 'SPY': ('index', 'etf', 'S&P 500 ETF', 'SPY'),
 'QQQ': ('ndx', 'etf', 'Nasdaq-100 ETF', 'QQQ'),
 'GLD': ('gold', 'commodity', 'Gold ETF', 'GLD'),
 'SHY': ('bond', 'bond', '1-3Y Treasuries', 'SHY'),
 'IEF': ('bond', 'bond', '7-10Y Treasuries', 'IEF'),
 'TLT': ('bond', 'bond', '20Y+ Treasuries', 'TLT'),
}


def load_prices() -> pd.DataFrame:
    px = {}
    for k, (_g, _kind, _l, src) in A.items():
        px[k] = pd.read_csv(PRICES / f'{src}.csv', parse_dates=['date']).set_index('date')['adjclose']
    df = pd.DataFrame(px).dropna()
    return df[df.index >= START]


def stats(legs: list[str], df: pd.DataFrame) -> dict:
    w = 1 / len(legs); rel = df[legs] / df[legs].iloc[0]; pool = (rel * w).sum(axis=1)
    mdd = (pool / pool.cummax() - 1).min()
    yrs = df.index.year.unique(); yr = []
    for y in yrs:
        s = pool[pool.index.year == y]; prev = pool[pool.index < f'{y}-01-01']
        base = prev.iloc[-1] if len(prev) else s.iloc[0]
        yr.append((y, float(s.iloc[-1] / base - 1)))
    cagr = pool.iloc[-1] ** (365.25 / (df.index[-1] - df.index[0]).days) - 1
    ret = df[legs].pct_change().dropna(); pr = pool.pct_change().dropna()
    down = (ret < 0).any(axis=1); off = float((pr[down] >= 0).mean() * 100)
    cm = ret.corr().values; corr = float(cm[np.triu_indices(len(legs), 1)].mean())
    r12 = (pool / pool.shift(252) - 1).dropna()
    return dict(maxDD=float(mdd), avgYear=float(cagr), bestYear=float(max(r for y, r in yr)), worstYear=float(min(r for y, r in yr)),
                years={str(y): round(r, 4) for y, r in yr}, offset=round(off), corr=round(corr, 2),
                r12=dict(p5=float(r12.quantile(.05)), p50=float(r12.median()), p95=float(r12.quantile(.95)), min=float(r12.min()), max=float(r12.max()), pctPositive=float((r12 > 0).mean())))


def structural_checks(legs: list[str]) -> list[dict]:
    """Rules about what a pool may contain. Same rules that shaped the curated set."""
    out = []
    def add(name, ok, detail): out.append({'name': name, 'ok': bool(ok), 'detail': detail})
    uniq = list(dict.fromkeys(legs))
    unknown = [l for l in uniq if l not in A]
    add('Tradable assets only', not unknown, 'All assets are tradable on BSC as Ondo tokens.' if not unknown else f'Not in the tradable list: {", ".join(unknown)}.')
    add('Two or three different assets', len(uniq) == len(legs) and 2 <= len(legs) <= 3, f'{len(legs)} assets proposed.' if len(uniq) == len(legs) else 'An asset appears more than once.')
    known = [l for l in uniq if l in A]
    add('Includes a company stock', any(A[l][1] == 'stock' for l in known), 'At least one company stock is required.')
    groups = [A[l][0] for l in known]
    add('Different sectors', len(set(groups)) == len(groups), 'No two assets from the same group (for example two tech stocks, or two bond funds).')
    overlap = ('SPY' in known and 'QQQ' in known) or ('QQQ' in known and bool({'AAPL', 'MSFT'} & set(known)))
    add('No overlapping holdings', not overlap, 'An index fund and its own biggest holdings count the same exposure twice.')
    return out


def window_stats(pool: pd.Series, a: str | None, b: str | None) -> dict | None:
    s = pool[(pool.index >= a) if a else slice(None)]
    if b: s = s[s.index <= b]
    if len(s) < 30: return None
    s = s / s.iloc[0]
    return dict(**{'from': str(s.index[0].date()), 'to': str(s.index[-1].date())}, ret=float(s.iloc[-1] - 1), maxDD=float((s / s.cummax() - 1).min()))


# ---- Keel score: how good a passing pool is, 0 to 100. Four parts, each scaled between a "poor" and a "great" level. ----
SCORE_PARTS = [  # name, weight, poor, great, what it measures
    ('Fall vs growth', 40, 1.5, 0.9, 'Worst drawdown divided by average yearly growth. Lower is better.'),
    ('Offset score', 30, 25, 50, 'How often the pool held flat or rose on days an asset fell.'),
    ('Consistency', 20, 0.75, 1.0, 'Share of rolling 12-month windows with a positive return.'),
    ('Recent fall', 10, 0.30, 0.10, 'Worst drawdown since Jan 2025. Shallower is better.'),
]
CURATED_MIN_SCORE = 41  # our own pools are dropped at 40 or lower
LIST_MIN_SCORE = 50   # a proposal must score at least this to be listed; 70 and above is tier A


def _scale(x: float, poor: float, great: float) -> float:
    return float(min(1.0, max(0.0, (x - poor) / (great - poor))))


def keel_score(s: dict, recent: dict | None) -> dict:
    vals = [s['ddToGrowth'], s['offset'], s['r12']['pctPositive'], abs(recent['maxDD']) if recent else 0.30]
    parts = []
    for (name, w, poor, great, what), v in zip(SCORE_PARTS, vals):
        f = _scale(v, poor, great); parts.append({'name': name, 'weight': w, 'value': round(float(v), 3), 'points': round(w * f, 1), 'what': what})
    total = round(sum(p['points'] for p in parts))
    return {'score': total, 'tier': 'A' if total >= 70 else 'B' if total >= LIST_MIN_SCORE else 'C', 'parts': parts}


def grade(legs: list[str], df: pd.DataFrame, taken: list[list[str]] | None = None) -> dict:
    """Return the Keel grade for a proposed pool. Never raises on bad input; failed rules are reported."""
    checks = structural_checks(legs)
    taken = taken or []
    dup = any(set(t) == set(legs) for t in taken)
    checks.append({'name': 'Not already listed', 'ok': not dup, 'detail': 'A pool with these assets already exists.' if dup else 'New combination.'})
    res: dict = {'legs': list(legs), 'checks': checks}
    if not all(c['ok'] for c in checks[:5]):
        res.update(pass_=False, stats=None); return res
    s = stats(list(legs), df); ddg = abs(s['maxDD']) / s['avgYear'] if s['avgYear'] > 0 else float('inf')
    s['ddToGrowth'] = ddg if np.isfinite(ddg) else 99.0
    checks.append({'name': 'Fall is small next to growth', 'ok': ddg <= DD_TO_GROWTH_MAX,
                   'detail': f'Worst drawdown is {ddg:.2f}x the average yearly growth (limit {DD_TO_GROWTH_MAX}x).' if np.isfinite(ddg) else 'Average yearly growth is not positive.'})
    pool = (df[list(legs)] / df[list(legs)].iloc[0]).mean(axis=1)
    res['windows'] = {'early': window_stats(pool, None, '2024-12-31'), 'recent': window_stats(pool, '2025-01-01', None)}
    rec = res['windows']['recent']
    checks.append({'name': 'Held up lately', 'ok': bool(rec and rec['ret'] > 0 and abs(rec['maxDD']) <= 1.25 * abs(s['maxDD'])),
                   'detail': (f"Since Jan 2025: {rec['ret']*100:+.0f}% return, worst fall {rec['maxDD']*100:.0f}% (must be positive, and no deeper than 1.25x the full-period fall)." if rec else 'Not enough recent data.')})
    ks = keel_score(s, rec)
    checks.append({'name': 'Keel score', 'ok': ks['score'] >= LIST_MIN_SCORE, 'detail': f"{ks['score']} out of 100 (tier {ks['tier']}); at least {LIST_MIN_SCORE} is needed to be listed."})
    res['stats'] = s; res['score'] = ks; res['pass_'] = all(c['ok'] for c in checks)
    return res


def export_history(path: Path | str | None = None) -> Path:
    """Daily adjusted closes for every tradable asset as compact JSON, so the browser can recompute figures for a custom split."""
    import json
    df = load_prices(); out = Path(path or ROOT / 'public' / 'data' / 'history.json')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({'dates': [d.strftime('%Y-%m-%d') for d in df.index], 'px': {k: [round(float(v), 5) for v in df[k]] for k in df.columns}}, separators=(',', ':')))
    return out


def export_rules(path: Path | str | None = None) -> Path:
    """The grading rules as data, so the website and the "bring your agent" page quote exactly what the Grader enforces."""
    import json
    out = Path(path or ROOT / 'public' / 'data' / 'rules.json'); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        'assets': {k: {'label': v[2], 'group': v[0], 'kind': v[1]} for k, v in A.items()},
        'ddToGrowthMax': DD_TO_GROWTH_MAX, 'listMinScore': LIST_MIN_SCORE, 'tierA': 70,
        'heldUp': {'since': '2025-01-01', 'maxFallRatio': 1.25}, 'earlyEnd': '2024-12-31',
        'parts': [{'name': n, 'weight': w, 'poor': p, 'great': g, 'what': t} for n, w, p, g, t in SCORE_PARTS],
        'legs': {'min': 2, 'max': 3}}, indent=1))
    return out
