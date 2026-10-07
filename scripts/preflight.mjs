// npm run preflight: checks the deployment is complete before you submit. Reads .env.local (web) and, if present, apps/analyst/.env.
import fs from 'node:fs';
const load = f => Object.fromEntries((fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '').split('\n').filter(l => /^[A-Z0-9_]+=/.test(l)).map(l => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()]));
const web = { ...load('.env.local'), ...process.env }, ag = load('apps/analyst/.env');
const rows = []; const chk = (name, ok, fix) => rows.push([ok ? 'OK  ' : 'TODO', name, ok ? '' : fix]);
chk('Binance Web3 API key and secret', !!web.BINANCE_WEB3_API_KEY && !!web.BINANCE_WEB3_API_SECRET, 'set BINANCE_WEB3_API_KEY / _SECRET');
chk('Live mode (DEMO_MODE=0)', web.DEMO_MODE === '0', 'set DEMO_MODE=0');
chk('WalletConnect project id', !!web.NEXT_PUBLIC_WC_PROJECT_ID, 'set NEXT_PUBLIC_WC_PROJECT_ID and add the site domain at cloud.reown.com');
chk('Agent desk storage (Upstash)', !!web.UPSTASH_REDIS_REST_URL && !!web.UPSTASH_REDIS_REST_TOKEN, 'set UPSTASH_REDIS_REST_URL / _TOKEN');
chk('Agents on mainnet (NETWORK=bsc-mainnet)', ag.NETWORK === 'bsc-mainnet', 'set NETWORK=bsc-mainnet in apps/analyst/.env');
chk('x402 on mainnet (X402=1, eip155:56)', ag.X402 === '1' && ag.X402_NETWORK === 'eip155:56', 'set X402=1 and X402_NETWORK=eip155:56');
chk('Analyst runs daily (DAILY=1)', ag.DAILY === '1', 'set DAILY=1');
chk('Agent ids published', (() => { try { return JSON.parse(fs.readFileSync('public/data/agents/activity.json', 'utf8')).agents.every(a => a.agentId); } catch { return false; } })(), 'run register.py for each agent, then let the agents write their ids');
chk('Pool data fresh (within 3 days)', (() => { try { return (Date.now() - new Date(JSON.parse(fs.readFileSync('public/data/pools.json', 'utf8')).asOf)) < 3 * 864e5; } catch { return false; } })(), 'python3 scripts/precompute.py');
chk('Daily briefing fresh (within 2 days)', (() => { try { return (Date.now() - new Date(JSON.parse(fs.readFileSync('public/data/outlook/daily.json', 'utf8')).generatedAt ?? 0)) < 2 * 864e5; } catch { return false; } })(), 'the Analyst writes it daily; check it is running');
for (const r of rows) console.log(r.join('  '));
const todo = rows.filter(r => r[0] === 'TODO').length; console.log(todo ? `\n${todo} item(s) left` : '\nAll set'); process.exit(todo ? 1 : 0);
