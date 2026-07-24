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

describe("BUG 5 — house property loss set-off under the new regime", () => {
  // s.115BAC(2)(i) bars inter-head set-off of a house property loss;
  // s.115BAC(2)(ii) bars carrying it forward. Intra-head set-off survives.
  const letOut = (annualRent: number, interestOnLoan: number) =>
    computeHouseProperty({ type: "let-out", annualRent, interestOnLoan });

  it("does not let a house property loss reduce salary income", () => {
    const p = letOut(300000, 900000); // 3,00,000 - 90,000 - 9,00,000 = -6,90,000
    expect(p.taxableIncome).toBe(-690000);

    const r = computeTax(
      makeInputs({
        salary: 2000000,
        houseProperty: { properties: [p], totalIncome: p.taxableIncome },
      })
    );
    expect(r.housePropertyIncomeGross).toBe(-690000);
    expect(r.housePropertyLossDisallowed).toBe(690000);
    expect(r.housePropertyIncome).toBe(0);
    expect(r.grossTotalIncome).toBe(1925000); // salary only
  });

  it("still allows set-off between properties within the head", () => {
    const profitable = letOut(2000000, 0); // 20,00,000 - 6,00,000 = 14,00,000
    const lossy = letOut(300000, 900000); // -6,90,000
    const total = profitable.taxableIncome + lossy.taxableIncome;

    const r = computeTax(
      makeInputs({
        salary: 1000000,
        houseProperty: { properties: [profitable, lossy], totalIncome: total },
      })
    );
    expect(r.housePropertyIncome).toBe(710000); // 14,00,000 - 6,90,000
    expect(r.housePropertyLossDisallowed).toBe(0);
    expect(r.grossTotalIncome).toBe(925000 + 710000);
  });

  it("disallows only the net loss when the head aggregates to negative", () => {
    const small = letOut(400000, 0); // 4,00,000 - 1,20,000 = 2,80,000
    const lossy = letOut(300000, 900000); // -6,90,000
    const total = small.taxableIncome + lossy.taxableIncome; // -4,10,000

    const r = computeTax(
      makeInputs({
        salary: 2000000,
        houseProperty: { properties: [small, lossy], totalIncome: total },
      })
    );
    expect(r.housePropertyIncomeGross).toBe(-410000);
    expect(r.housePropertyLossDisallowed).toBe(410000);
    expect(r.housePropertyIncome).toBe(0);
    expect(r.grossTotalIncome).toBe(1925000);
  });

  it("leaves a positive house property head untouched", () => {
    const r = computeTax(makeInputs({ salary: 1000000, houseProperty: 500000 }));
    expect(r.housePropertyIncome).toBe(500000);
    expect(r.housePropertyLossDisallowed).toBe(0);
    expect(r.grossTotalIncome).toBe(1425000);
  });
});

describe("BUG 3 — the 1,25,000 exemption u/s 112A across rate buckets", () => {
  // A single annual allowance across all 112A gains, applied to the
  // higher-taxed bucket first.
  it("applies the exemption to the 10% bucket when there is no 12.5% gain", () => {
    const r = computeTax(
      makeInputs({ fy: "2024-25", capitalGains: { ltcg112A_10: 500000 } })
    );
    // (5,00,000 - 1,25,000) @ 10%
    expect(r.taxOnLTCG112A_10).toBe(37500);
    expect(r.ltcg112AExemptionUsed).toBe(125000);
  });

  it("spills the unused remainder from the 12.5% bucket into the 10% bucket", () => {
    const r = computeTax(
      makeInputs({
        fy: "2024-25",
        capitalGains: { ltcg112A_125: 50000, ltcg112A_10: 500000 },
      })
    );
    // 50,000 absorbed at 12.5% (nil taxable), remaining 75,000 against the 10%
    // bucket: (5,00,000 - 75,000) @ 10% = 42,500
    expect(r.taxOnLTCG112A_125).toBe(0);
    expect(r.taxOnLTCG112A_10).toBe(42500);
    expect(r.ltcg112AExemptionUsed).toBe(125000);
  });

  it("never grants more than one 1,25,000 allowance in total", () => {
    const r = computeTax(
      makeInputs({
        fy: "2024-25",
        capitalGains: { ltcg112A_125: 1000000, ltcg112A_10: 1000000 },
      })
    );
    expect(r.ltcg112AExemptionUsed).toBe(125000);
    // Whole exemption goes to the 12.5% bucket; the 10% bucket is taxed in full
    expect(r.taxOnLTCG112A_125).toBe(109375); // (10,00,000 - 1,25,000) @ 12.5%
    expect(r.taxOnLTCG112A_10).toBe(100000); // 10,00,000 @ 10%
  });

  it("absorbs only what the gain can bear", () => {
    const r = computeTax(makeInputs({ capitalGains: { ltcg112A_125: 40000 } }));
    expect(r.ltcg112AExemptionUsed).toBe(40000);
    expect(r.taxOnLTCG112A_125).toBe(0);
  });

  it("applies the exemption in FY 2025-26 too", () => {
    const r = computeTax(makeInputs({ capitalGains: { ltcg112A_125: 300000 } }));
    expect(r.taxOnLTCG112A_125).toBe(21875); // (3,00,000 - 1,25,000) @ 12.5%
  });
});

describe("BUG 2 — s.87A rebate eligibility turns on total income", () => {
  it("denies the rebate when capital gains push total income over the limit", () => {
    const r = computeTax(
      makeInputs({ salary: 1100000, capitalGains: { ltcg112A_125: 5000000 } })
    );
    expect(r.totalIncome).toBe(6025000);
    expect(r.normalIncome).toBe(1025000);
    expect(r.rebate87A).toBe(0); // previously granted 42,500
  });

  it("denies the rebate when a small STCG crosses the threshold", () => {
    const r = computeTax(
      makeInputs({ salary: 1275000, capitalGains: { stcg111A_20: 100000 } })
    );
    expect(r.totalIncome).toBe(1300000);
    expect(r.rebate87A).toBe(0);
  });

  it("still gives the full rebate to a resident at exactly the limit", () => {
    const r = computeTax(makeInputs({ salary: 1275000 }));
    expect(r.totalIncome).toBe(1200000);
    expect(r.rebate87A).toBe(60000);
    expect(r.grossTaxLiability).toBe(0);
  });

  it("denies the rebate to a non-resident who would otherwise qualify", () => {
    const resident = computeTax(makeInputs({ salary: 1275000 }));
    const nri = computeTax(makeInputs({ salary: 1275000, residentialStatus: "nri" }));

    expect(resident.rebate87A).toBe(60000);
    expect(nri.rebate87A).toBe(0);
    expect(nri.grossTaxLiability).toBe(62400); // 60,000 + 4% cess
  });

  it("keeps the rebate for resident senior citizens", () => {
    const r = computeTax(
      makeInputs({ salary: 1275000, residentialStatus: "resident-senior" })
    );
    expect(r.rebate87A).toBe(60000);
  });

  it("applies the total income gate for FY 2024-25 as well", () => {
    const within = computeTax(makeInputs({ fy: "2024-25", salary: 775000 }));
    expect(within.totalIncome).toBe(700000);
    expect(within.rebate87A).toBe(20000);
    expect(within.grossTaxLiability).toBe(0);

    const over = computeTax(
      makeInputs({
        fy: "2024-25",
        salary: 775000,
        otherSources: { fdInterest: 100000 },
      })
    );
    expect(over.totalIncome).toBe(800000);
    expect(over.rebate87A).toBe(0);
  });

  it("measures marginal relief against total income, not normal income", () => {
    // Normal income 12.05L, plus 10,000 of STCG => total income 12.15L.
    // Excess over 12L is 15,000; slab tax on 12.05L is 60,750, so relief
    // brings the slab tax down to the 15,000 excess.
    const r = computeTax(
      makeInputs({ salary: 1280000, capitalGains: { stcg111A_20: 10000 } })
    );
    expect(r.totalIncome).toBe(1215000);
    expect(r.taxOnNormalIncome).toBe(60750);
    expect(r.rebate87A).toBe(45750);
    expect(r.rebate87AMarginalRelief).toBe(45750);
  });
});

describe("BUG 1 — LTCG u/s 112 must not be taxed at slab rates", () => {
  it("charges s.112 LTCG at 12.5%, not at the slab rate", () => {
    const r = computeTax(
      makeInputs({ salary: 2000000, capitalGains: { ltcgOther_125: 5000000 } })
    );

    // Slab base is salary only: 20,00,000 - 75,000 = 19,25,000
    expect(r.normalIncome).toBe(1925000);
    // 0-4L nil, 4-8L 20,000, 8-12L 40,000, 12-16L 60,000, 16-19.25L 65,000
    expect(r.taxOnNormalIncome).toBe(185000);
    expect(r.taxOnLTCGOther_125).toBe(625000); // 50,00,000 @ 12.5%

    // Surcharge: total income 69,25,000 is over 50L, so 10% on both bases
    expect(r.surchargeOnNormal).toBe(18500);
    expect(r.surchargeOnCG).toBe(62500);
    expect(r.cessAmount).toBe(35640);
    expect(r.grossTaxLiability).toBe(926640); // was 18,96,180 at slab rates
  });

  it("charges the pre-23-July-2024 bucket at 20% with indexation", () => {
    const r = computeTax(
      makeInputs({ fy: "2024-25", capitalGains: { ltcgOther_20: 1000000 } })
    );
    expect(r.taxOnLTCGOther_20).toBe(200000);
    expect(r.normalIncome).toBe(0);
    expect(r.taxOnNormalIncome).toBe(0);
  });

  it("gives s.112 LTCG no 1,25,000 exemption — that belongs to s.112A", () => {
    const r = computeTax(makeInputs({ capitalGains: { ltcgOther_125: 1000000 } }));
    expect(r.taxOnLTCGOther_125).toBe(125000); // full amount @ 12.5%
    expect(r.ltcg112AExemptionUsed).toBe(0);
  });

  it("caps surcharge on s.112 LTCG at 15% above 2 crore", () => {
    const r = computeTax(
      makeInputs({ salary: 5000000, capitalGains: { ltcgOther_125: 20000000 } })
    );
    expect(r.totalIncome).toBe(24925000); // over 2 crore
    expect(r.surchargeRate).toBe(0.25);
    expect(r.surchargeRateCG).toBe(0.15);
    // 2,00,00,000 @ 12.5% = 25,00,000, surcharge capped at 15% not 25%
    expect(r.taxOnLTCGOther_125).toBe(2500000);
    expect(r.surchargeOnCG).toBe(375000);
  });

  it("excludes s.112 LTCG from the 87A rebate base", () => {
    // Normal income 4,25,000 (nil tax), plus 20,00,000 of s.112 LTCG.
    // Total income is over 12L so no rebate is due at all.
    const r = computeTax(
      makeInputs({ salary: 500000, capitalGains: { ltcgOther_125: 2000000 } })
    );
    expect(r.totalIncome).toBe(2425000);
    expect(r.rebate87A).toBe(0);
    expect(r.taxOnLTCGOther_125).toBe(250000);
  });

  it("still taxes STCG on non-STT assets at slab rates", () => {
    const r = computeTax(
      makeInputs({ salary: 1000000, capitalGains: { stcgOther: 500000 } })
    );
    // stcgOther stays in the slab base: 9,25,000 + 5,00,000 = 14,25,000
    expect(r.normalIncome).toBe(1425000);
    expect(r.taxOnNormalIncome).toBe(93750);
  });

  it("counts both s.112 buckets in total capital gains", () => {
    const r = computeTax(
      makeInputs({
        fy: "2024-25",
        capitalGains: { ltcgOther_125: 100000, ltcgOther_20: 200000 },
      })
    );
    expect(r.capitalGainsIncome).toBe(300000);
    expect(r.totalTaxBeforeSurcharge).toBe(12500 + 40000);
  });
});
