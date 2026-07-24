/**
 * Golden regression tests for the tax engine.
 *
 * These lock in behaviour that was validated to the rupee against a real CA's
 * computation sheet (FY 2024-25) plus the marginal relief scenarios. They import
 * the real engine — the earlier .mjs harnesses hand-reimplemented the logic, so
 * they validated a transcription rather than the shipped code.
 *
 * Nothing here should change when a bug is fixed. If a test in this file breaks,
 * a fix has altered a case a CA already signed off on.
 */

import { describe, it, expect } from "vitest";
import {
  computeTax,
  computeSalary,
  computeCapitalGains,
  computeOtherSources,
} from "./taxEngine";
import type {
  TaxInputs,
  FinancialYear,
  CapitalGainsIncome,
  OtherSourcesIncome,
  TDSEntry,
} from "./taxEngine";

interface Overrides {
  fy?: FinancialYear;
  salary?: number;
  houseProperty?: number;
  capitalGains?: Partial<CapitalGainsIncome>;
  otherSources?: Partial<OtherSourcesIncome>;
  tds?: TDSEntry[];
  advanceTax?: number;
  selfAssessmentTax?: number;
  residentialStatus?: TaxInputs["assesseeInfo"]["residentialStatus"];
}

export function makeInputs(o: Overrides = {}): TaxInputs {
  const fy: FinancialYear = o.fy || "2025-26";
  return {
    assesseeInfo: {
      name: "Test",
      pan: "AAAAA0000A",
      fatherName: "Father",
      dob: "1970-01-01",
      gender: "male",
      residentialStatus: o.residentialStatus || "resident",
      address: "Test",
      email: "test@test.com",
      phone: "9999999999",
      financialYear: fy,
    },
    salary: computeSalary({ basicSalary: o.salary || 0 }, fy),
    houseProperty: { properties: [], totalIncome: o.houseProperty || 0 },
    capitalGains: computeCapitalGains(o.capitalGains || {}),
    otherSources: computeOtherSources(o.otherSources || {}),
    tdsEntries: o.tds || [],
    advanceTax: o.advanceTax || 0,
    selfAssessmentTax: o.selfAssessmentTax || 0,
  };
}

describe("CA computation sheet — FY 2024-25 (validated to the rupee)", () => {
  // House property is passed as a pre-aggregated positive total, exactly as the
  // CA's sheet presents it (two let-out properties, both with positive income).
  const inputs: TaxInputs = {
    assesseeInfo: {
      name: "SUDHANSHU SHEKHAR SHARAN",
      pan: "AICPS3154M",
      fatherName: "LATE SHRI SHANKAR SHARAN",
      dob: "1964-08-11",
      gender: "male",
      residentialStatus: "resident-senior",
      address: "Delhi",
      email: "",
      phone: "",
      financialYear: "2024-25",
    },
    salary: computeSalary({}, "2024-25"),
    houseProperty: { properties: [], totalIncome: 2362043 },
    capitalGains: computeCapitalGains({
      stcg111A_20: 4765879,
      stcg111A_15: 839056,
      ltcg112A_125: 778098,
      ltcg112A_10: 1887778,
    }),
    otherSources: computeOtherSources({
      savingsBankInterest: 79347,
      postOfficeInterest: 672,
      fdInterest: 4024,
      dividendIncome: 94224,
    }),
    tdsEntries: [
      { section: "206CL", description: "TDS u/s 206CL", amount: 30805 },
      { section: "194", description: "TDS on Dividend", amount: 8268 },
      { section: "193", description: "TDS on Interest", amount: 68 },
      { section: "194DA", description: "TDS on Life Insurance", amount: 6303 },
      { section: "194I(B)", description: "TDS on Rent", amount: 357134 },
    ],
    advanceTax: 63000,
    selfAssessmentTax: 0,
  };

  const r = computeTax(inputs);

  it("matches the income summary", () => {
    expect(r.housePropertyIncome).toBe(2362043);
    expect(r.capitalGainsIncome).toBe(8270811);
    expect(r.otherSourcesIncome).toBe(178267);
    expect(r.grossTotalIncome).toBe(10811121);
    expect(r.totalIncome).toBe(10811121);
  });

  it("separates normal income from special-rate income", () => {
    // 1,08,11,121 - (47,65,879 + 8,39,056 + 7,78,098 + 18,87,778)
    expect(r.normalIncome).toBe(2540310);
  });

  it("matches slab tax on normal income", () => {
    expect(r.taxOnNormalIncome).toBe(452093);
  });

  it("matches tax on each special-rate bucket", () => {
    expect(r.taxOnSTCG111A_20).toBe(953176);
    expect(r.taxOnSTCG111A_15).toBe(125858);
    // The CA applied the whole 1,25,000 exemption against the 12.5% bucket and
    // taxed the 10% bucket in full — this pins that allocation order.
    expect(r.taxOnLTCG112A_125).toBe(81637);
    expect(r.taxOnLTCG112A_10).toBe(188778);
    expect(r.totalTaxBeforeSurcharge).toBe(1801542);
  });

  it("grants no 87A rebate at 1.08 crore", () => {
    expect(r.rebate87A).toBe(0);
  });

  it("matches surcharge, cess and gross liability", () => {
    expect(r.surchargeAmount).toBe(270231);
    expect(r.surchargeMarginalRelief).toBe(0);
    expect(r.cessAmount).toBe(82871);
    expect(r.grossTaxLiability).toBe(2154644);
  });

  it("matches taxes paid and the final payable figure", () => {
    expect(r.totalTDS).toBe(402578);
    expect(r.totalAdvanceTax).toBe(63000);
    expect(r.netTaxPayable).toBe(1689066);
  });
});

describe("rebate 87A marginal relief — FY 2025-26", () => {
  it("gives a full rebate at exactly 12L of normal income", () => {
    const r = computeTax(makeInputs({ salary: 1275000 }));
    expect(r.normalIncome).toBe(1200000);
    expect(r.taxAfterRebate).toBe(0);
    expect(r.grossTaxLiability).toBe(0);
  });

  it("caps tax at the excess over 12L inside the relief zone (12.10L)", () => {
    const r = computeTax(makeInputs({ salary: 1285000 }));
    expect(r.taxOnNormalIncome).toBe(61500);
    expect(r.rebate87A).toBe(51500);
    expect(r.taxAfterRebate).toBe(10000);
    expect(r.grossTaxLiability).toBe(10400);
  });

  it("tapers the rebate at 12.50L", () => {
    const r = computeTax(makeInputs({ salary: 1325000 }));
    expect(r.taxOnNormalIncome).toBe(67500);
    expect(r.rebate87A).toBe(17500);
    expect(r.taxAfterRebate).toBe(50000);
  });

  it("needs no relief at 12.75L, where tax is already below the excess", () => {
    const r = computeTax(makeInputs({ salary: 1350000 }));
    expect(r.taxOnNormalIncome).toBe(71250);
    expect(r.taxAfterRebate).toBe(71250);
  });

  it("gives no rebate above the relief zone (13L)", () => {
    const r = computeTax(makeInputs({ salary: 1375000 }));
    expect(r.rebate87A).toBe(0);
  });
});

describe("surcharge marginal relief", () => {
  it("caps tax + surcharge at the 50L threshold ceiling", () => {
    const r = computeTax(makeInputs({ salary: 5175000 }));
    const at50L = computeTax(makeInputs({ salary: 5075000 }));
    const ceiling = at50L.taxOnNormalIncome + 100000;

    expect(r.taxAfterSurcharge).toBe(ceiling);
    expect(r.surchargeMarginalRelief).toBe(
      r.taxOnNormalIncome + Math.round(r.taxOnNormalIncome * 0.1) - ceiling
    );
  });

  it("stays within the ceiling just above 1 crore", () => {
    const r = computeTax(makeInputs({ salary: 10175000 }));
    const at1Cr = computeTax(makeInputs({ salary: 10075000 }));
    const ceiling =
      at1Cr.taxOnNormalIncome + Math.round(at1Cr.taxOnNormalIncome * 0.1) + 100000;

    expect(r.taxAfterSurcharge).toBeLessThanOrEqual(ceiling);
    expect(r.surchargeMarginalRelief).toBeGreaterThan(0);
  });

  it("stays within the ceiling just above 2 crore", () => {
    const r = computeTax(makeInputs({ salary: 20175000 }));
    const at2Cr = computeTax(makeInputs({ salary: 20075000 }));
    const ceiling =
      at2Cr.taxOnNormalIncome + Math.round(at2Cr.taxOnNormalIncome * 0.15) + 100000;

    expect(r.taxAfterSurcharge).toBeLessThanOrEqual(ceiling);
    expect(r.surchargeMarginalRelief).toBeGreaterThan(0);
  });

  it("applies no relief well above a threshold (80L)", () => {
    const r = computeTax(makeInputs({ salary: 8075000 }));
    expect(r.surchargeMarginalRelief).toBe(0);
  });
});

describe("basics that must not regress", () => {
  it("returns zero tax on zero income", () => {
    const r = computeTax(makeInputs({}));
    expect(r.grossTaxLiability).toBe(0);
    expect(r.netTaxPayable).toBe(0);
  });

  it("applies the 75,000 salary standard deduction in both years", () => {
    expect(computeSalary({ basicSalary: 1000000 }, "2024-25").netSalary).toBe(925000);
    expect(computeSalary({ basicSalary: 1000000 }, "2025-26").netSalary).toBe(925000);
  });

  it("claims no standard deduction when there is no salary", () => {
    expect(computeSalary({}, "2025-26").standardDeduction).toBe(0);
  });

  it("reports a refund when taxes paid exceed the liability", () => {
    const r = computeTax(
      makeInputs({
        salary: 1500000,
        tds: [{ section: "192", description: "TDS on salary", amount: 500000 }],
      })
    );
    expect(r.netTaxPayable).toBe(0);
    expect(r.refundDue).toBe(500000 - r.grossTaxLiability);
  });
});
