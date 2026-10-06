Alternative analyst implementation (Finnhub headlines + signed negotiation, with 35 offline tests), written earlier in the build.
Not the primary path: the maintained agent is `../src` (based on BNB Chain's reference agent-server). Kept for reference; not yet reviewed against the primary one.
Run its tests: `cd apps/analyst/alt-finnhub && python -m pytest tests`.
