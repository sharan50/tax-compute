/**
 * Regression tests for the six correctness bugs found in review.
 *
 * Each block states the statutory position it is enforcing, so the expected
 * figures can be checked against a CA's treatment one at a time.
 */

import { describe, it, expect } from "vitest";
import { computeTax, computeHouseProperty } from "./taxEngine";
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

describe("BUG 4 — self-occupied house property interest under the new regime", () => {
  // s.115BAC(2)(i) disallows the s.24(b) interest deduction on a self-occupied
  // property. The 2,00,000 cap the engine was applying is an old-regime rule.
  it("allows no interest deduction on a self-occupied property", () => {
    const p = computeHouseProperty({ type: "self-occupied", interestOnLoan: 300000 });
    expect(p.taxableIncome).toBe(0);
    expect(p.interestDisallowed).toBe(300000);
  });

  it("does not reduce total income when a self-occupied loan is entered", () => {
    const p = computeHouseProperty({ type: "self-occupied", interestOnLoan: 300000 });
    const r = computeTax(
      makeInputs({
        salary: 2000000,
        houseProperty: { properties: [p], totalIncome: p.taxableIncome },
      })
    );
    expect(r.grossTotalIncome).toBe(1925000);
    expect(r.housePropertyIncome).toBe(0);
  });

  it("keeps the annual value of a self-occupied property nil", () => {
    const p = computeHouseProperty({ type: "self-occupied", interestOnLoan: 100000 });
    expect(p.annualValue).toBe(0);
    expect(p.standardDeduction).toBe(0);
  });

  it("still allows uncapped interest on a let-out property", () => {
    // NAV 3,00,000 - 30% std deduction 90,000 - interest 5,00,000 = -2,90,000
    const p = computeHouseProperty({
      type: "let-out",
      annualRent: 300000,
      interestOnLoan: 500000,
    });
    expect(p.taxableIncome).toBe(-290000);
    expect(p.interestDisallowed).toBe(0);
  });

  it("deducts municipal taxes before the 30% standard deduction", () => {
    const p = computeHouseProperty({
      type: "let-out",
      annualRent: 1271900,
      municipalTaxes: 196985,
    });
    expect(p.annualValue).toBe(1074915);
    // 30% of 10,74,915 is exactly 3,22,474.50. Math.round takes it up to
    // 3,22,475; the CA's sheet for this same property shows 3,22,474, i.e. it
    // rounded the half down. That leaves a 1 rupee divergence on this property
    // if it is entered through the UI rather than as a pre-aggregated total.
    // Pinned here so the convention is a deliberate choice, not a surprise.
    expect(p.standardDeduction).toBe(322475);
    expect(p.taxableIncome).toBe(752440);
  });
});
