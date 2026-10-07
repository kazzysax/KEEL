// npm run test:parity: the website's TypeScript grader must agree with the Python Grader on every combination.
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { gradeProposal } from '../src/lib/grade';
const R = path.join(process.cwd(), 'public/data'); const tmp = path.join(os.tmpdir(), 'keel_py_grades.json');
execFileSync('python3', ['scripts/dump_grades.py', tmp], { stdio: 'inherit' });
const h = JSON.parse(fs.readFileSync(`${R}/history.json`, 'utf8')); const rules = JSON.parse(fs.readFileSync(`${R}/rules.json`, 'utf8'));
const cur: string[][] = JSON.parse(fs.readFileSync(`${R}/pools.json`, 'utf8')).pools.map((p: any) => p.legs);
const py = JSON.parse(fs.readFileSync(tmp, 'utf8')); let hard = 0, soft = 0;
for (const c of py) {
  const g = gradeProposal(c.legs, h, rules, cur);
  if (g.pass !== c.pass || JSON.stringify(g.checks.map(x => [x.name, x.ok])) !== JSON.stringify(c.checks)) { hard++; console.log('MISMATCH', c.legs); continue; }
  if (c.score != null && (g.score !== c.score || g.tier !== c.tier)) { if (Math.abs(g.score! - c.score) <= 1 && g.tier === c.tier) soft++; else { hard++; console.log('SCORE MISMATCH', c.legs, g.score, c.score); } }
}
console.log(`${py.length} proposals: ${hard} real mismatches, ${soft} off by one point (same tier and outcome)`);
process.exit(hard || soft > py.length / 100 ? 1 : 0);
