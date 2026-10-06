"""Offset Outlook Analyst: an ERC-8183 provider agent (BNB Agent Studio / bnbagent-sdk).

A buyer (the Offset app's agent) opens a job whose task is a comma-separated list of tickers, e.g. "AAPL,WMT,GLD".
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
import outlook  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger("offset_analyst")

# Local storage by default; switch to IPFSStorageProvider.from_env() (set STORAGE_API_KEY) for a public ipfs:// deliverable.
_storage = LocalStorageProvider.from_env()
config = ERC8183Config.from_env(storage=_storage)
PORT = int(os.getenv("PORT", "8003")); HOST = os.getenv("HOST", "127.0.0.1")
MAX_TICKERS = 6


def parse_tickers(task: str) -> list[str]:
    ts = [t.strip().upper() for t in task.replace(";", ",").replace(" ", ",").split(",") if t.strip()]
    ok = [t for t in dict.fromkeys(ts) if t in outlook.NAMES]
    if not ok: raise ValueError(f"No supported tickers in job. Supported: {', '.join(outlook.NAMES)}")
    return ok[:MAX_TICKERS]


def process_task(job: dict) -> tuple[str, dict]:
    from bnbagent.erc8183 import JobDescription
    raw = job.get("description", "")
    parsed = JobDescription.from_str(raw); task = parsed.task if parsed else raw
    tickers = parse_tickers(task)
    log.info("job %s -> outlook for %s", job.get("jobId", "?"), tickers)
    report = {"agent": "offset-analyst", "schema": 1, "outlooks": [outlook.build(t) for t in tickers]}
    return json.dumps(report, indent=1), {"agent": "offset-analyst", "tickers": tickers, "content_type": "application/json"}


app = create_erc8183_app(config=config, on_job=process_task)
print(f"\n  Offset Outlook Analyst  ·  port {PORT}  ·  price {int(config.service_price) / 10**18} U  ·  commerce {config.effective_commerce_address}\n")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
