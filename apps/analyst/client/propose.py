"""On-chain Scout: pay the Analyst for today's briefing over x402, pick pool ideas, send each to the Grader as a paid ERC-8183 job.

Usage: python client/propose.py [N]
Env:   PRIVATE_KEY (scout wallet, needs tBNB + U), GRADER_ADDRESS (grader provider wallet), ANALYST_URL (e.g. http://localhost:8003),
       SCOUT_AGENT_ID (optional ERC-8004 id to show on the listing), NETWORK=bsc-testnet, GRADE_PRICE_U (default 1)
"""
import json, os, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from _helpers import banner, expiry_for, load_settings, make_primary_client, make_wallet  # noqa: E402
import daily, scout, x402_buyer  # noqa: E402


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    s = load_settings(); client = make_primary_client(s)
    banner("SCOUT: buy today's briefing, then propose pools")
    url = os.getenv("ANALYST_URL", "http://localhost:8003").rstrip("/") + "/daily"
    briefing, paid = x402_buyer.Payer(make_wallet(s.client_pk)).fetch(url)
    print("briefing", briefing["date"], "paid" if paid else "free", paid or "")
    if paid: daily.log_event({"agent": "keel-scout", "type": "x402-payment", "summary": f"Bought the daily briefing for {int(paid['amount']) / 1e18:g} U (x402)", "amountU": -int(paid["amount"]) / 1e18})
    by = {o["ticker"]: o for o in briefing["outlooks"]}
    grader = os.environ["GRADER_ADDRESS"]; price = int(float(os.getenv("GRADE_PRICE_U", "1")) * 10 ** client.token_decimals())
    me = {"agent": "keel-scout", "agentId": os.getenv("SCOUT_AGENT_ID")}
    for idea in scout.plan(n, get_outlook=lambda t: by[t]):
        task = json.dumps({**idea, "proposer": me})
        res = client.create_job(provider=grader, expired_at=expiry_for(client, slack_minutes=60), description=task)
        jid = res["jobId"]; client.register_job(jid); client.set_budget(jid, price); client.fund(jid, price)
        print("proposed", idea["legs"], "job", jid)
        daily.log_event({"agent": "keel-scout", "type": "proposal", "jobId": str(jid), "summary": f"Proposed {' + '.join(idea['legs'])} to the Grader (job {jid})"})
        time.sleep(1)
    print("The Grader's poll loop (~30 s) scores each job and lists passing pools. Settle after the dispute window: python scripts/settle.py <jobId>")


if __name__ == "__main__":
    main()
