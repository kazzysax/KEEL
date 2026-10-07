"""Keel Outlook Analyst: an ERC-8183 provider agent (BNB Agent Studio / bnbagent-sdk).

A buyer (the Keel app's agent) opens a job whose task is a comma-separated list of tickers, e.g. "AAPL,WMT,GLD".
When the job is funded the agent builds a cited outlook per ticker (src/outlook.py), the SDK stores the deliverable,
and its hash is committed on-chain via commerce.submit. Settlement is optimistic (dispute window, then settle).
Identity: registered on the ERC-8004 registry with scripts/register.py.

HTTP + funded-job poll loop come from erc8183_server.py (copied from the SDK's agent-server example, MIT).
"""
import json, logging, os, sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / os.path.basename(os.environ.get("ENV_FILE", ".env")))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from erc8183_server import create_erc8183_app  # noqa: E402
from bnbagent.erc8183.config import ERC8183Config  # noqa: E402
from bnbagent.storage import LocalStorageProvider  # noqa: E402
import outlook, community, daily, x402_seller  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger("offset_analyst")

# Local storage by default; switch to IPFSStorageProvider.from_env() (set STORAGE_API_KEY) for a public ipfs:// deliverable.
_storage = LocalStorageProvider.from_env()
config = ERC8183Config.from_env(storage=_storage)
PORT = int(os.getenv("PORT", "8003")); HOST = os.getenv("HOST", "127.0.0.1")
MAX_TICKERS = 6
ROLE = os.getenv("AGENT_ROLE", "analyst")          # "analyst" (outlooks, daily briefing, paid API) or "grader" (scores proposed pools)
AGENT = os.getenv("AGENT_NAME", "keel-grader" if ROLE == "grader" else "keel-analyst")


def parse_tickers(task: str) -> list[str]:
    ts = [t.strip().upper() for t in task.replace(";", ",").replace(" ", ",").split(",") if t.strip()]
    ok = [t for t in dict.fromkeys(ts) if t in outlook.NAMES]
    if not ok: raise ValueError(f"No supported tickers in job. Supported: {', '.join(outlook.NAMES)}")
    return ok[:MAX_TICKERS]


def _task(job: dict) -> str:
    from bnbagent.erc8183 import JobDescription
    raw = job.get("description", ""); parsed = JobDescription.from_str(raw); return parsed.task if parsed else raw


def process_outlook(job: dict) -> tuple[str, dict]:
    tickers = parse_tickers(_task(job))
    log.info("job %s -> outlook for %s", job.get("jobId", "?"), tickers)
    report = {"agent": AGENT, "schema": 1, "outlooks": [outlook.build(t) for t in tickers]}
    daily.log_event({"agent": AGENT, "type": "job", "summary": f"Outlook job {job.get('jobId', '?')} delivered for {', '.join(tickers)}", "jobId": str(job.get("jobId", ""))})
    return json.dumps(report, indent=1), {"agent": AGENT, "tickers": tickers, "content_type": "application/json"}


def process_proposal(job: dict) -> tuple[str, dict]:
    """Job text: {"legs": ["WMT","GLD"], "rationale": "...", "proposer": {"agent": "...", "agentId": "..."}}  (JSON) or "propose WMT,GLD"."""
    task = _task(job).strip()
    try: p = json.loads(task)
    except ValueError: p = {"legs": parse_tickers(task.replace("propose", "", 1)), "rationale": ""}
    proposer = {"agent": (p.get("proposer") or {}).get("agent", "unknown"), "agentId": (p.get("proposer") or {}).get("agentId"),
                "mode": "on-chain", "jobId": str(job.get("jobId", "")), "client": job.get("client")}
    res = community.submit(p.get("legs", []), p.get("rationale", ""), proposer)
    daily.log_event({"agent": AGENT, "type": "grade", "jobId": proposer["jobId"], "summary": f"Graded {'+'.join(p.get('legs', []))}: " + (f"listed as {res['id']}" if res["listed"] else "rejected, " + res["reasons"][0])})
    return json.dumps({"agent": AGENT, "schema": 1, **res}, indent=1), {"agent": AGENT, "content_type": "application/json"}


process_task = process_proposal if ROLE == "grader" else process_outlook


app = create_erc8183_app(config=config, on_job=process_task)

if ROLE == "analyst":
    import paid_routes
    _wallet_key = os.getenv("X402_SELLER_KEY") or os.getenv("PRIVATE_KEY") or ""
    _seller = x402_seller.from_env(_wallet_key, os.environ["X402_PAY_TO"]) if os.getenv("X402") == "1" and _wallet_key else None
    paid_routes.install(app, _seller, AGENT)
    if os.getenv("DAILY", "1") == "1": daily.start_background()      # the Analyst works without being asked

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
