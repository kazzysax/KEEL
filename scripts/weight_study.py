"""Does choosing the starting split (instead of equal) help? Buy and hold, no rebalancing, 12-month holds from many start dates.
Every rule only uses prices BEFORE the start date. 'hindsight' uses the whole period and is shown only as an upper bound.
Usage: python3 scripts/weight_study.py"""
import itertools, json
import numpy as np, pandas as pd
from poolmath import load_prices

df = load_prices(); R = df.pct_change().dropna(); N = len(df); H = 252; LB = 252
pools = json.load(open('public/data/pools.json'))['pools']
GRID = {2: [(a / 100, 1 - a / 100) for a in range(5, 96, 5)],
        3: [(a / 100, b / 100, 1 - (a + b) / 100) for a in range(5, 91, 5) for b in range(5, 91, 5) if 100 - a - b >= 5]}

def clamp(w):
    w = np.maximum(np.array(w, float), 0.05); w = w / w.sum()
    for _ in range(5): w = np.maximum(w, 0.05); w = w / w.sum()
    return w

def rule_equal(px, i, legs): return np.ones(len(legs)) / len(legs)
def rule_invvol(px, i, legs):
    v = px[legs].pct_change().iloc[i - LB:i].std().values; return clamp(1 / v)
def rule_momo(px, i, legs):
    r = (px[legs].iloc[i - 1] / px[legs].iloc[i - 127] - 1).values; return clamp(1 + np.clip(r, -0.5, 0.5))
def rule_minvar(px, i, legs):
    C = px[legs].pct_change().iloc[i - LB:i].cov().values
    best = min(GRID[len(legs)], key=lambda w: np.array(w) @ C @ np.array(w)); return np.array(best)
RULES = {'equal': rule_equal, 'inverse volatility': rule_invvol, 'momentum tilt': rule_momo, 'min variance (past year)': rule_minvar}

def hold(px, legs, w, i):
    seg = px[legs].iloc[i:i + H + 1]; rel = seg / seg.iloc[0]; pool = (rel * w).sum(axis=1)
    return float(pool.iloc[-1] - 1), float((pool / pool.cummax() - 1).min())

starts = list(range(LB + 1, N - H - 1, 21))
rows = []
for p in pools:
    legs = p['legs']
    for name, f in RULES.items():
        for i in starts:
            ret, dd = hold(df, legs, f(df, i, legs), i); rows.append((p['id'], name, i, ret, dd))
res = pd.DataFrame(rows, columns=['pool', 'rule', 'i', 'ret', 'dd'])
eq = res[res.rule == 'equal'].set_index(['pool', 'i'])
print(f'{len(pools)} curated pools x {len(starts)} start dates, 12-month holds, every start uses only earlier prices\n')
print(f"{'rule':28s} {'avg ret':>8s} {'worst ret':>9s} {'avg worst-fall':>14s} {'deepest fall':>12s} {'beats equal on return':>22s} {'beats equal on fall':>20s}")
for name in RULES:
    s = res[res.rule == name].set_index(['pool', 'i']); e = eq.loc[s.index]
    print(f"{name:28s} {s.ret.mean():8.1%} {s.ret.min():9.1%} {s.dd.mean():14.1%} {s.dd.min():12.1%} {(s.ret > e.ret).mean():22.0%} {(s.dd > e.dd).mean():20.0%}")

# fixed split picked on the first part of history (2020-2023), judged on the rest: does an optimised split survive?
cut = int(df.index.searchsorted(pd.Timestamp('2024-01-01'))); out = []
for p in pools:
    legs = p['legs']; tr = df[legs].iloc[:cut]; te = df[legs].iloc[cut:]
    def dd_of(d, w): rel = d / d.iloc[0]; pool = (rel * w).sum(axis=1); return float((pool / pool.cummax() - 1).min()), float(pool.iloc[-1] - 1)
    best = max(GRID[len(legs)], key=lambda w: dd_of(tr, np.array(w))[0]); e = np.ones(len(legs)) / len(legs)  # best = least negative = shallowest fall
    out.append((p['id'], best, dd_of(tr, np.array(best))[0], dd_of(tr, e)[0], dd_of(te, np.array(best)), dd_of(te, e)))
print('\nSplit with the smallest worst fall in 2020-2023, then judged on 2024 to today (equal split for comparison):')
print(f"{'pool':4s} {'chosen split':22s} {'train fall opt/eq':>18s} {'test fall opt/eq':>18s} {'test return opt/eq':>20s}")
wins_dd = wins_ret = 0
for pid, best, tdo, tde, (ddo, reto), (dde, rete) in out:
    wins_dd += ddo > dde; wins_ret += reto > rete
    print(f"{pid:4s} {str([round(x * 100) for x in best]):22s} {tdo:8.1%} /{tde:7.1%} {ddo:8.1%} /{dde:7.1%} {reto:9.1%} /{rete:7.1%}")
print(f"\nout-of-sample: optimised split had a shallower fall in {wins_dd} of {len(out)} pools and a higher return in {wins_ret} of {len(out)}")
