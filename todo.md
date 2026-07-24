# Tax Compute — TODO

- [x] Core tax computation engine (New Regime, FY 2024-25 & 2025-26)
- [x] Swiss Financial design system (typography, colors, layout)
- [x] Multi-step form: Assessee Details
- [x] Multi-step form: Salary Income
- [x] Multi-step form: House Property (multiple properties)
- [x] Multi-step form: Capital Gains (STCG/LTCG at all rates)
- [x] Multi-step form: Other Sources (interest, dividends, etc.)
- [x] Multi-step form: TDS & Taxes Paid
- [x] Computation results page with full breakdown
- [x] Print / Save PDF functionality
- [x] Tax engine validated against real CA computation (zero difference)
- [x] Bank statement import — HDFC Excel parser
- [x] Rule-based transaction categorisation
- [x] Upgrade to full-stack (web-db-user) for backend capabilities
- [x] Backend LLM triage endpoint (Forge API)
- [x] Frontend AI triage UI (classify button, review banner, AI tags)
- [x] Write vitest tests for triage endpoint
- [x] End-to-end testing and polish
- [x] Implement marginal relief on surcharge (incomes near 50L/1Cr/2Cr boundaries)
- [x] Implement marginal relief on rebate 87A (FY 2025-26: incomes 12L-12.75L)
- [x] Update computation step UI to display marginal relief details when applied
- [x] Write edge case tests for marginal relief scenarios

## Correctness fixes (new regime)

- [x] Tax LTCG u/s 112 at 12.5% / 20%-with-indexation instead of at slab rates
- [x] Test s.87A eligibility on total income, and deny the rebate to non-residents
- [x] Share the 1,25,000 s.112A exemption across both rate buckets
- [x] Disallow self-occupied house property interest u/s 115BAC
- [x] Stop house property losses being set off against other heads
- [x] Raise the family pension deduction cap to 25,000
- [x] Clear FY 2024-25 only capital gains buckets when the year changes
- [x] Move engine coverage into vitest, importing the real engine

## Open

Correctness:
- [ ] Rounding u/s 288A (total income) and 288B (tax payable) to the nearest 10.
      Deliberately deferred — applying 288B would move the CA-validated
      16,89,066 to 16,89,070, so it needs a decision on which convention to follow.
- [ ] The 30% house property standard deduction rounds a .5 up where the CA's
      sheet rounds it down (1 rupee per property).
- [ ] Interest u/s 234A/234B/234C — without it, "net tax payable" is not the
      amount actually payable at filing.
- [ ] Capital loss set-off and carry-forward.
- [ ] Deemed-let-out is treated identically to let-out; s.23 permits two
      self-occupied properties, so the third onward is where this matters.

Fitness for use:
- [ ] Persistence. All state is in-memory, so a refresh loses everything. The
      DB has only a users table.
- [ ] Old regime + side-by-side comparison — the question most taxpayers
      actually need answered.
- [ ] The triage endpoint is a publicProcedure: unauthenticated and
      unrate-limited, forwarding bank narrations to an LLM. protectedProcedure
      already exists in server/_core/trpc.ts.
- [ ] Bank import is HDFC-Excel only; say so in the UI.
