"""Buyer side: the Keel app's agent hires the Analyst before a purchase.
createJob -> registerJob -> setBudget -> fund -> (provider delivers) -> settle after the dispute window.
Writes the job record to ../../public/data/outlook/jobs.json so the UI can link "verify on-chain".

Usage: python client/hire.py AAPL,WMT,GLD      (env: PRIVATE_KEY, PROVIDER_ADDRESS, NETWORK=bsc-testnet)
"""
import json, sys, time
from pathlib import Path
from _helpers import banner, expiry_for, load_settings, make_primary_client

OUT = Path(__file__).resolve().parents[3] / "public" / "data" / "outlook" / "jobs.json"


def main() -> None:
    tickers = sys.argv[1] if len(sys.argv) > 1 else "AAPL,WMT,GLD"
    s = load_settings(); client = make_primary_client(s)
    banner(f"HIRE ANALYST for {tickers}")
    budget = 2 * 10 ** (client.token_decimals() - 2)  # 0.02 U; match the provider's ERC8183_SERVICE_PRICE
    res = client.create_job(provider=s.provider_address, expired_at=expiry_for(client, slack_minutes=60), description=f"outlook {tickers}")
    job_id = res["jobId"]; print("createJob", job_id)
    client.register_job(job_id); client.set_budget(job_id, budget); client.fund(job_id, budget)
    print("funded; the provider's poll loop will deliver within ~30s")
    rec = {"jobId": job_id, "tickers": tickers, "network": s.network, "provider": s.provider_address, "createdAt": int(time.time())}
    jobs = json.loads(OUT.read_text()) if OUT.exists() else []
    OUT.parent.mkdir(parents=True, exist_ok=True); OUT.write_text(json.dumps(jobs + [rec], indent=1))
    print("saved", OUT, "\nAfter the dispute window run: python scripts/settle.py", job_id)


if __name__ == "__main__":
    main()
