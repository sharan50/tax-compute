/**
 * Regression tests for the six correctness bugs found in review.
 *
 * Each block states the statutory position it is enforcing, so the expected
 * figures can be checked against a CA's treatment one at a time.
 */

import { describe, it, expect } from "vitest";
import { computeTax } from "./taxEngine";
import { makeInputs } from "./taxEngine.fixtures";

describe("BUG 6 — family pension deduction u/s 57(iia)", () => {
  // The Finance (No.2) Act 2024 raised the new-regime cap from 15,000 to
  // 25,000 with effect from AY 2025-26, i.e. both years this tool supports.
  it("caps the deduction at 25,000, not 15,000 (FY 2025-26)", () => {
    const r = computeTax(makeInputs({ otherSources: { familyPension: 300000 } }));
    expect(r.familyPensionDeduction).toBe(25000);
  });

  it("caps the deduction at 25,000 for FY 2024-25 too", () => {
    const r = computeTax(
      makeInputs({ fy: "2024-25", otherSources: { familyPension: 300000 } })
    );
    expect(r.familyPensionDeduction).toBe(25000);
  });

  it("gives one-third when one-third is below the cap", () => {
    const r = computeTax(makeInputs({ otherSources: { familyPension: 60000 } }));
    expect(r.familyPensionDeduction).toBe(20000);
  });

  it("gives nothing when there is no family pension", () => {
    const r = computeTax(makeInputs({ otherSources: { fdInterest: 500000 } }));
    expect(r.familyPensionDeduction).toBe(0);
  });

  it("reduces total income by the deduction", () => {
    const r = computeTax(makeInputs({ otherSources: { familyPension: 300000 } }));
    expect(r.grossTotalIncome).toBe(300000);
    expect(r.totalIncome).toBe(275000);
  });
});
