import 'server-only';
import fs from 'node:fs'; import path from 'node:path';
export type AgentCard = { name: string; role: string; does: string; agentId: string | null; explorer: string | null; network: string; status: string };
export type AgentEvent = { at: string; agent: string; type: string; summary: string; txHash?: string; jobId?: string; amountU?: number; mode?: string };
export type Activity = { agents: AgentCard[]; events: AgentEvent[]; ledger: { earnedU: number; spentU: number; gasBNB: number; note: string } };
export const activity = (): Activity | null => {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'agents', 'activity.json'), 'utf8')); } catch { return null; }
};
