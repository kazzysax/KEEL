"""On-chain Scout: pay the Analyst for today's briefing over x402, pick pool ideas, send each to the Grader as a paid ERC-8183 job.

Usage: python client/propose.py [N]
Env:   PRIVATE_KEY (scout wallet, needs tBNB + U), GRADER_ADDRESS (grader provider wallet), GRADER_URL (the Grader's public URL), OUTLOOK_URL (optional),
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
    # The Analyst agent is retired: the outlook is a free public file built by the daily-outlook job.
    import httpx
    briefing = httpx.get(os.getenv("OUTLOOK_URL", "https://keel-io.vercel.app/data/outlook/daily.json"), timeout=30).json()
    print("outlook", briefing["date"], briefing["counts"])
    by = {o["ticker"]: o for o in briefing["outlooks"]}
    grader = os.environ["GRADER_ADDRESS"]; price = int(float(os.getenv("GRADE_PRICE_U", "0.02")) * 10 ** client.token_decimals())
    me = {"agent": "keel-scout", "agentId": os.getenv("SCOUT_AGENT_ID")}
    for idea in scout.plan(n, get_outlook=lambda t: by[t]):
        task = json.dumps({**idea, "legs": ",".join(idea["legs"]), "proposer": me})  # no [ ]: the SDK rewrites them to ( ) on-chain
        # The production Grader only takes jobs whose description carries its signed quote: negotiate first (free, off-chain).
        import httpx
        from bnbagent.erc8183.negotiation import build_job_description
        nres = httpx.post(os.environ["GRADER_URL"].rstrip("/") + "/erc8183/negotiate", timeout=30, json={
            "task_description": task,
            "terms": {"deliverables": "A pass or fail grade with every check and its reason", "quality_standards": "Same rules and code as the curated Keel pools"}})
        nres.raise_for_status(); nbody = nres.json()
        if not nbody.get("response", {}).get("accepted"): print("grader declined to quote:", nbody.get("response")); continue
        price = int(nbody["response"]["terms"]["price"])
        desc = build_job_description(nbody)
        res = client.create_job(provider=grader, expired_at=expiry_for(client, slack_minutes=60), description=desc)
        jid = res["jobId"]; client.register_job(jid); client.set_budget(jid, price); client.fund(jid, price)
        print("proposed", idea["legs"], "job", jid)
        daily.log_event({"agent": "keel-scout", "type": "proposal", "jobId": str(jid), "summary": f"Proposed {' + '.join(idea['legs'])} to the Grader (job {jid})"})
        time.sleep(1)
    print("The Grader's poll loop (~30 s) scores each job and lists passing pools. Settle after the dispute window: python scripts/settle.py <jobId>")


if __name__ == "__main__":
    main()
