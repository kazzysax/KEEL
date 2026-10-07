"""Dump the Python Grader's verdict for every 1 to 4 asset combination (used by scripts/parity.ts)."""
import sys, json, itertools, pathlib; ROOT = pathlib.Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT / 'scripts'))
import poolmath as pm
df=pm.load_prices(); cur=[p['legs'] for p in json.load(open(ROOT / 'public/data/pools.json'))['pools']]
out=[]
tickers=list(pm.A)+['DOGE']
for n in (1,2,3,4):
    for legs in itertools.combinations(tickers,n):
        if n>=3 and 'DOGE' in legs: continue
        g=pm.grade(list(legs),df,taken=cur)
        out.append({'legs':list(legs),'pass':g['pass_'],'checks':[[c['name'],c['ok']] for c in g['checks']],'score':g.get('score',{}).get('score'),'tier':g.get('score',{}).get('tier'),
                    'ddg':(g.get('stats') or {}).get('ddToGrowth'),'offset':(g.get('stats') or {}).get('offset'),'recent':(g.get('windows') or {}).get('recent')})
json.dump(out,open(sys.argv[1],'w')); print(len(out),'cases',sum(o['pass'] for o in out),'pass')
