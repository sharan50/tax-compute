/**
 * Marginal Relief Tests
 * 
 * Tests the two marginal relief mechanisms:
 * 1. Surcharge marginal relief (at 50L, 1Cr, 2Cr thresholds)
 * 2. Rebate 87A marginal relief (FY 2025-26: 12L-12.75L zone)
 * 
 * Cross-validated against ClearTax examples and the PDF computation.
 */

import { computeTax, computeSalary, computeCapitalGains, computeOtherSources, formatINR } from './client/src/lib/taxEngine.ts';

function makeInputs(overrides) {
  const fy = overrides.fy || "2025-26";
  return {
    assesseeInfo: {
      name: "Test", pan: "AAAAA0000A", fatherName: "Father",
      dob: "1970-01-01", gender: "male", residentialStatus: "resident",
      address: "Test", email: "test@test.com", phone: "9999999999",
      financialYear: fy,
    },
    salary: computeSalary({
      basicSalary: overrides.salary || 0,
    }, fy),
    houseProperty: { properties: [], totalIncome: overrides.houseProperty || 0 },
    capitalGains: computeCapitalGains({
      stcg111A_20: overrides.stcg20 || 0,
      stcg111A_15: overrides.stcg15 || 0,
      ltcg112A_125: overrides.ltcg125 || 0,
      ltcg112A_10: overrides.ltcg10 || 0,
      stcgOther: overrides.stcgOther || 0,
      ltcgOther: overrides.ltcgOther || 0,
    }),
    otherSources: computeOtherSources({
      savingsBankInterest: overrides.interest || 0,
      fdInterest: overrides.fdInterest || 0,
      dividendIncome: overrides.dividend || 0,
      familyPension: overrides.familyPension || 0,
      otherIncome: overrides.otherIncome || 0,
    }),
    tdsEntries: overrides.tds || [],
    advanceTax: overrides.advanceTax || 0,
    selfAssessmentTax: overrides.selfAssessmentTax || 0,
  };
}

let passed = 0;
let failed = 0;

function check(label, actual, expected, tolerance = 0) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`  ✅ ${label}: ${formatINR(actual)} (expected ${formatINR(expected)})`);
    passed++;
  } else {
    console.log(`  ❌ ${label}: ${formatINR(actual)} (expected ${formatINR(expected)}, diff ${diff})`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// REBATE 87A MARGINAL RELIEF TESTS (FY 2025-26)
// ═══════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════════");
console.log("TEST 1: Rebate 87A — Income exactly at 12L (full rebate)");
console.log("══════════════════════════════════════════════════════════");

{
  const inputs = makeInputs({ salary: 1275000, fy: "2025-26" });
  const r = computeTax(inputs);
  check("Normal income", r.normalIncome, 1200000);
  check("Tax after rebate", r.taxAfterRebate, 0);
  check("Gross tax liability", r.grossTaxLiability, 0);
}

console.log("\n══════════════════════════════════════════════════════════");
console.log("TEST 2: Rebate 87A Marginal Relief — Income 12.10L");
console.log("══════════════════════════════════════════════════════════");

{
  const inputs = makeInputs({ salary: 1285000, fy: "2025-26" });
  const r = computeTax(inputs);
  check("Tax on normal income", r.taxOnNormalIncome, 61500);
  check("Rebate 87A", r.rebate87A, 51500);
  check("Tax after rebate", r.taxAfterRebate, 10000);
  check("Gross tax liability (with cess)", r.grossTaxLiability, 10400);
}

console.log("\n══════════════════════════════════════════════════════════");
console.log("TEST 3: Rebate 87A Marginal Relief — Income 12.50L");
console.log("══════════════════════════════════════════════════════════");

{
  const inputs = makeInputs({ salary: 1325000, fy: "2025-26" });
  const r = computeTax(inputs);
  check("Tax on normal income", r.taxOnNormalIncome, 67500);
  check("Rebate 87A", r.rebate87A, 17500);
  check("Tax after rebate", r.taxAfterRebate, 50000);
}

console.log("\n══════════════════════════════════════════════════════════");
console.log("TEST 4: Rebate 87A — Income 12.75L (boundary, no relief needed)");
console.log("══════════════════════════════════════════════════════════");

{
  const inputs = makeInputs({ salary: 1350000, fy: "2025-26" });
  const r = computeTax(inputs);
  check("Tax on normal income", r.taxOnNormalIncome, 71250);
  // 71,250 < 75,000 (excess over 12L), so no marginal relief needed
  check("Tax after rebate", r.taxAfterRebate, 71250);
}

console.log("\n══════════════════════════════════════════════════════════");
console.log("TEST 5: Rebate 87A — Income 13L (no rebate at all)");
console.log("══════════════════════════════════════════════════════════");

{
  const inputs = makeInputs({ salary: 1375000, fy: "2025-26" });
  const r = computeTax(inputs);
  check("Rebate 87A", r.rebate87A, 0);
}

// ═══════════════════════════════════════════════════════════════════════
// SURCHARGE MARGINAL RELIEF TESTS
// ═══════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════════");
console.log("TEST 6: Surcharge MR — Income 51L (just above 50L)");
console.log("══════════════════════════════════════════════════════════");

{
  // salary - 75000 = 51,00,000 → salary = 51,75,000
  const inputs = makeInputs({ salary: 5175000, fy: "2025-26" });
  const r = computeTax(inputs);
  
  // Verify with independent computation
  const inputs50L = makeInputs({ salary: 5075000, fy: "2025-26" });
  const r50L = computeTax(inputs50L);
  const taxAt50L = r50L.taxOnNormalIncome; // No surcharge at 50L
  const ceiling = taxAt50L + 100000; // tax@threshold + excess
  
  console.log(`  Tax at 51L: ${formatINR(r.taxOnNormalIncome)}`);
  console.log(`  Tax at 50L: ${formatINR(taxAt50L)}`);
  console.log(`  Ceiling: ${formatINR(ceiling)}`);
  console.log(`  Tax+surcharge after MR: ${formatINR(r.taxAfterSurcharge)}`);
  
  check("Tax+surcharge capped at ceiling", r.taxAfterSurcharge, ceiling, 1);
  const mrExpected = (r.taxOnNormalIncome + Math.round(r.taxOnNormalIncome * 0.10)) - ceiling;
  check("Surcharge marginal relief", r.surchargeMarginalRelief, mrExpected, 1);
}

console.log("\n══════════════════════════════════════════════════════════");
console.log("TEST 7: Surcharge MR — Income 1.01Cr (just above 1Cr)");
console.log("══════════════════════════════════════════════════════════");

{
  const inputs = makeInputs({ salary: 10175000, fy: "2025-26" });
  const r = computeTax(inputs);
  
  // Tax at 1Cr with 10% surcharge
  const inputs1Cr = makeInputs({ salary: 10075000, fy: "2025-26" });
  const r1Cr = computeTax(inputs1Cr);
  const taxPlusSurchargeAt1Cr = r1Cr.taxOnNormalIncome + Math.round(r1Cr.taxOnNormalIncome * 0.10);
  const ceiling = taxPlusSurchargeAt1Cr + 100000;
  
  console.log(`  Tax at 1.01Cr: ${formatINR(r.taxOnNormalIncome)}`);
  console.log(`  Tax+surcharge at 1Cr: ${formatINR(taxPlusSurchargeAt1Cr)}`);
  console.log(`  Ceiling: ${formatINR(ceiling)}`);
  console.log(`  Tax+surcharge after MR: ${formatINR(r.taxAfterSurcharge)}`);
  console.log(`  Marginal relief: ${formatINR(r.surchargeMarginalRelief)}`);
  
  // Tax+surcharge should not exceed ceiling
  const withinCeiling = r.taxAfterSurcharge <= ceiling + 1;
  if (withinCeiling) {
    console.log(`  ✅ Within ceiling`);
    passed++;
  } else {
    console.log(`  ❌ Exceeds ceiling by ${r.taxAfterSurcharge - ceiling}`);
    failed++;
  }
}

console.log("\n══════════════════════════════════════════════════════════");
console.log("TEST 8: No MR — Income 80L (well above 50L)");
console.log("══════════════════════════════════════════════════════════");

{
  const inputs = makeInputs({ salary: 8075000, fy: "2025-26" });
  const r = computeTax(inputs);
  check("Surcharge marginal relief", r.surchargeMarginalRelief, 0);
}

console.log("\n══════════════════════════════════════════════════════════");
console.log("TEST 9: Surcharge MR — Income 2.01Cr (just above 2Cr)");
console.log("══════════════════════════════════════════════════════════");

{
  const inputs = makeInputs({ salary: 20175000, fy: "2025-26" });
  const r = computeTax(inputs);
  
  const inputs2Cr = makeInputs({ salary: 20075000, fy: "2025-26" });
  const r2Cr = computeTax(inputs2Cr);
  const taxPlusSurchargeAt2Cr = r2Cr.taxOnNormalIncome + Math.round(r2Cr.taxOnNormalIncome * 0.15);
  const ceiling = taxPlusSurchargeAt2Cr + 100000;
  
  console.log(`  Tax+surcharge at 2Cr: ${formatINR(taxPlusSurchargeAt2Cr)}`);
  console.log(`  Ceiling: ${formatINR(ceiling)}`);
  console.log(`  Tax+surcharge after MR: ${formatINR(r.taxAfterSurcharge)}`);
  console.log(`  Marginal relief: ${formatINR(r.surchargeMarginalRelief)}`);
  
  const withinCeiling = r.taxAfterSurcharge <= ceiling + 1;
  if (withinCeiling) {
    console.log(`  ✅ Within ceiling`);
    passed++;
  } else {
    console.log(`  ❌ Exceeds ceiling by ${r.taxAfterSurcharge - ceiling}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PDF VALIDATION (with correct data from the PDF)
// ═══════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════════");
console.log("TEST 10: PDF Validation — Father's FY 2024-25 computation");
console.log("══════════════════════════════════════════════════════════");

{
  const inputs = {
    assesseeInfo: {
      name: "SUDHANSHU SHEKHAR SHARAN", pan: "AICPS3154M",
      fatherName: "LATE SHRI SHANKAR SHARAN", dob: "1964-08-11",
      gender: "male", residentialStatus: "resident-senior",
      address: "Delhi", email: "", phone: "",
      financialYear: "2024-25",
    },
    salary: { basicSalary: 0, hra: 0, specialAllowance: 0, otherAllowances: 0,
      perquisites: 0, profitsInLieu: 0, grossSalary: 0, standardDeduction: 0, netSalary: 0 },
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
  
  // From PDF:
  check("House property income", r.housePropertyIncome, 2362043);
  check("Capital gains income", r.capitalGainsIncome, 8270811);
  check("Other sources income", r.otherSourcesIncome, 178267);
  check("Gross total income", r.grossTotalIncome, 10811121);
  check("Total income", r.totalIncome, 10811121);
  
  // Normal income = total - special rate CG
  // Special rate = 4765879 + 839056 + 778098 + 1887778 = 8270811
  // Normal = 10811121 - 8270811 = 2540310
  check("Normal income", r.normalIncome, 2540310);
  
  // Tax on normal income (FY 2024-25 slabs on 25,40,310):
  // 0-3L: 0, 3-7L: 20000, 7-10L: 30000, 10-12L: 30000, 12-15L: 60000, 15-25.4L: 312093
  // Total: 452,093
  check("Tax on normal income", r.taxOnNormalIncome, 452093);
  
  // Special rate taxes
  check("STCG @20%", r.taxOnSTCG111A_20, 953176);
  check("STCG @15%", r.taxOnSTCG111A_15, 125858);
  check("LTCG @12.5%", r.taxOnLTCG112A_125, 81637, 1);
  check("LTCG @10%", r.taxOnLTCG112A_10, 188778);
  
  // Total tax = 452093 + 953176 + 125858 + 81637 + 188778 = 1801542
  check("Total tax before surcharge", r.totalTaxBeforeSurcharge, 1801542, 1);
  
  // Rebate
  check("Rebate 87A", r.rebate87A, 0);
  
  // Surcharge: 15% on all (income > 1Cr)
  // PDF says surcharge = 2,70,231
  check("Total surcharge", r.surchargeAmount, 270231, 2);
  
  // No marginal relief expected (well above 1Cr)
  check("Surcharge marginal relief", r.surchargeMarginalRelief, 0);
  
  // Cess: 4% of (18,01,542 + 2,70,231) = 4% of 20,71,773 = 82,871
  check("Cess", r.cessAmount, 82871, 1);
  
  // Gross tax = 20,71,773 + 82,871 = 21,54,644
  check("Gross tax liability", r.grossTaxLiability, 2154644, 2);
  
  // TDS = 30805 + 8268 + 68 + 6303 + 357134 = 402578
  check("Total TDS", r.totalTDS, 402578);
  
  // Advance tax
  check("Advance tax", r.totalAdvanceTax, 63000);
  
  // Net payable = 21,54,644 - 402578 - 63000 = 16,89,066
  check("Net tax payable", r.netTaxPayable, 1689066, 2);
}

// ═══════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════════");
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log("══════════════════════════════════════════════════════════\n");

process.exit(failed > 0 ? 1 : 0);
