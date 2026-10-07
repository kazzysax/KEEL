"""HTTP routes the Analyst adds on top of the ERC-8183 app: GET /daily, optionally paid via x402."""
from __future__ import annotations
import asyncio, base64, json

import daily, x402_seller
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def _b64(o) -> str: return base64.b64encode(json.dumps(o).encode()).decode()


def install(app: FastAPI, seller: "x402_seller.Seller | None", agent: str) -> None:
    @app.get("/daily")
    async def daily_briefing(request: Request):
        """Today's briefing for other agents. With a seller configured it costs the seller's price per call; otherwise it is free (demo)."""
        f = daily.OUT / "daily.json"
        if not f.exists(): return JSONResponse({"error": "no briefing yet"}, status_code=503)
        if seller is None: return json.loads(f.read_text())
        hdr = request.headers.get("payment-signature") or request.headers.get("x-payment")
        if not hdr:
            ch = seller.challenge(str(request.url), "Keel Analyst daily briefing")
            return JSONResponse(ch, status_code=402, headers={"PAYMENT-REQUIRED": _b64(ch)})
        try: rc = await asyncio.to_thread(seller.charge, hdr)
        except x402_seller.PaymentError as e: return JSONResponse({"error": str(e)}, status_code=402)
        daily.log_event({"agent": agent, "type": "x402-payment", "summary": f"Daily briefing sold for {int(rc['amount']) / 1e18:g} U to {rc['payer'][:8]}…",
                         "txHash": rc["txHash"], "amountU": int(rc["amount"]) / 1e18})
        return JSONResponse(json.loads(f.read_text()), headers={"PAYMENT-RESPONSE": _b64(rc)})
