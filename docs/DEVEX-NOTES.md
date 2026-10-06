# DevEx raw log (write the final report yourself, in your own words; AI-written reports are rejected)
Log timestamps for: docs opened, API key approved, first signed 200 with `code` OK, first quote, first simulate, first live swap, first `baw` swap, first Studio deploy.
## Things to verify on day one (built from the SDK types, not yet run live)
- [ ] `getAggregatedQuote` returns an array; we pick `isBest` per issuer token. Is `priceImpactPercent` a fraction or a percent? (code multiplies by 100, conservative)
- [ ] `buildSwapTransaction` for Ondo returns `rfq.typedDataToSign` (sign in wallet) instead of `tx.data`. Wallet signing path for RFQ legs is NOT built yet.
- [ ] `simulateTransactions` success string (code accepts SUCCESS/success).
- [ ] bStocks addresses via `searchRwaToken` (AAPLB, MSFTB, SPYB, QQQB) for cross-issuer comparison. Ondo addresses now come from Ondo official token list (chainId 56).
- [ ] Ondo minimum order ($5 rule) and market-closed behaviour out of NY hours.
- [ ] `baw market-order list` flags and output shape (agent route polls nothing yet).
## Observations
(append below with time, endpoint, exact error, fix)
## Built from SDK types, untested live (verify and log on day one)
- Equity/RWA tokens always return RFQ: quote -> build (approveTransaction=true) -> eth_signTypedData_v4 -> submitRfqOrder (needs a client UUID requestId) -> poll getRfqOrderStatus until FILLED. Is the approve spender per vendor (InchFusion router / PcsXRfq Permit2 / CowSwap VaultRelayer) as documented?
- typedDataToSign is "hex or JSON string": parser handles both. Which does it return in practice?
- Analyst agent (apps/analyst): bnbagent defaults to bsc-testnet. Mainnet path and `bag` deploy not attempted. Pip package is `bnbagent`; blog says `bnbagent-studio`: conflicting docs.
- Sandbox could not reach any BSC RPC or news search, so on-chain steps and headline fetching have not been run.
