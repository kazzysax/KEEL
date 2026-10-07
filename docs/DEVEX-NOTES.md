# DevEx raw log (write the final report yourself, in your own words; AI-written reports are rejected)
Log timestamps for: docs opened, API key approved, first signed 200 with `code` OK, first quote, first simulate, first live swap, first Studio deploy, first x402 payment, first agent-to-agent job.
## Things to verify on day one (built from the SDK types, not yet run live)
- [ ] `getAggregatedQuote` returns an array; we pick `isBest` per issuer token. Is `priceImpactPercent` a fraction or a percent? (code multiplies by 100, conservative)
- [ ] `buildSwapTransaction` for Ondo returns `rfq.typedDataToSign` (sign in wallet) instead of `tx.data`. Wallet signing path for RFQ legs is NOT built yet.
- [ ] `simulateTransactions` success string (code accepts SUCCESS/success).
- [ ] bStocks addresses via `searchRwaToken` (AAPLB, MSFTB, SPYB, QQQB) for cross-issuer comparison. Ondo addresses now come from Ondo official token list (chainId 56).
- [ ] Ondo minimum order ($5 rule) and market-closed behaviour out of NY hours.
- [ ] Studio: `bnbagent` 0.5.0 has x402 buyer primitives only (X402Signer, TwakX402Payer); no seller helper. We wrote a self-hosted seller; verify the token's `transferWithAuthorization` signature form and gas cost on testnet.
- [ ] Studio: SDK signing policy caps `validBefore - validAfter` at 600 s, so a buyer must not use `validAfter: 0` (first attempt failed with this; worth a clearer error or doc line).
- [ ] Studio: importing the reference server makes a network call (payment-token lookup) at app creation, so unit tests must not import the app; we split our routes into `paid_routes.py`.
- [ ] Daily refresh: Yahoo chart endpoint and news search from the real host.
## Observations
(append below with time, endpoint, exact error, fix)
## Built from SDK types, untested live (verify and log on day one)
- Equity/RWA tokens always return RFQ: quote -> build (approveTransaction=true) -> eth_signTypedData_v4 -> submitRfqOrder (needs a client UUID requestId) -> poll getRfqOrderStatus until FILLED. Is the approve spender per vendor (InchFusion router / PcsXRfq Permit2 / CowSwap VaultRelayer) as documented?
- typedDataToSign is "hex or JSON string": parser handles both. Which does it return in practice?
- Analyst agent (apps/analyst): bnbagent defaults to bsc-testnet. Mainnet path and `bag` deploy not attempted. Pip package is `bnbagent`; blog says `bnbagent-studio`: conflicting docs.
- Sandbox could not reach any BSC RPC or news search, so on-chain steps and headline fetching have not been run.
