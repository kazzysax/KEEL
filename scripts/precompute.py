import pandas as pd, numpy as np, itertools, json, os
from poolmath import A, load_prices, stats as _stats
OUT='public/data'
df=load_prices()
def stats(legs): return _stats(legs, df)
cands=[]
for n in (2,3):
    for legs in itertools.combinations(A,n):
        if len({A[l][0] for l in legs})<n: continue
        if not any(A[l][1]=='stock' for l in legs): continue
        if 'SPY' in legs and 'QQQ' in legs: continue
        if 'QQQ' in legs and ({'AAPL','MSFT'}&set(legs)): continue
        s=stats(list(legs)); s['legs']=list(legs); s['ddToGrowth']=abs(s['maxDD'])/s['avgYear']
        cands.append(s)
def stocks_only(c): return all(A[l][1]=='stock' for l in c['legs'])
def has_gold(c): return 'GLD' in c['legs']
duos=[c for c in cands if len(c['legs'])==2 and not stocks_only(c)]
trios=[c for c in cands if len(c['legs'])==3]
pairs=[c for c in cands if len(c['legs'])==2 and stocks_only(c)]
def pick(lst,k,maxuse=2):
    lst=[c for c in lst if c['ddToGrowth']<=1.5]
    lst=sorted(lst,key=lambda c:(c['ddToGrowth'],-c['offset'])); out=[];use={}
    for c in lst:
        if all(use.get(l,0)<maxuse for l in c['legs']):
            out.append(c)
            for l in c['legs']: use[l]=use.get(l,0)+1
        if len(out)==k: break
    return out
sel={'duo':pick(duos,5),'trio':pick(trios,5),'pair':pick(pairs,5)}
# 2-year chart series
last=df.index[-1]; w2=df[df.index>=last-pd.DateOffset(years=2)]
w2=w2.iloc[::2] if False else w2
pools=[]
names={'duo':'D','trio':'T','pair':'S'}
for kind,lst in sel.items():
    for i,c in enumerate(lst,1):
        legs=c['legs']; pid=f"{names[kind]}{i}"
        rel=w2[legs]/w2[legs].iloc[0]*100; pool=rel.mean(axis=1)
        series=[dict(d=d.strftime('%Y-%m-%d'),**{l:round(float(rel.loc[d,l]),2) for l in legs},POOL=round(float(pool.loc[d]),2)) for d in rel.index]
        rec=dict(id=pid,kind=kind,legs=legs,weights=[round(1/len(legs),4)]*len(legs),
            name=' + '.join(A[l][2].split(' (')[0] for l in legs),**{k:v for k,v in c.items() if k!='legs'},series=series)
        json.dump(rec,open(f'{OUT}/pools/{pid}.json','w'),separators=(',',':'))
        step=max(1,len(pool)//48); sp=[round(float(v),1) for v in pool.iloc[::step]]
        pools.append({**{k:v for k,v in rec.items() if k!='series'},'spark':sp})
json.dump(dict(asOf=str(last.date()),from_=str(df.index[0].date()),assets={k:dict(group=v[0],kind=v[1],label=v[2],historySource=v[3],last=round(float(df[k].iloc[-1]),2)) for k,v in A.items()},pools=pools),open(f'{OUT}/pools.json','w'),indent=1)
for p in pools: print(p['id'],p['name'],f"dd {p['maxDD']:.1%} avg {p['avgYear']:.1%} best {p['bestYear']:.1%} off {p['offset']} corr {p['corr']} ddg {p['ddToGrowth']:.2f}")
print(df.index[0],df.index[-1],len(df))
