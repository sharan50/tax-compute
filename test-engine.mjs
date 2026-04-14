/**
 * Test: Validate tax engine against Sudhanshu Shekhar Sharan's computation
 * FY 2024-25, New Regime, Senior Citizen
 * 
 * Expected values from the PDF:
 * - House Property Income: 23,62,043
 * - Capital Gains: 82,70,811
 * - Other Sources: 1,78,267
 * - Gross Total Income: 1,08,11,121
 * - Tax on Normal Income (25,40,309): 4,52,093
 * - STCG @ 20%: 9,53,176
 * - STCG @ 15%: 1,25,858
 * - LTCG @ 12.5%: 81,637
 * - LTCG @ 10%: 1,88,778
 * - Total Tax: 18,01,542
 * - Surcharge @ 15%: 2,70,231
 * - Cess @ 4%: 82,871
 * - Gross Tax: 21,54,644
 * - TDS: 4,02,578
 * - Advance Tax: 63,000
 * - Tax Payable: 16,89,066
 */

// We can't import TS directly, so let's replicate the core computation logic
function computeSlabTax_FY2024_25(income) {
  const slabs = [
    { from: 0, to: 300000, rate: 0 },
    { from: 300000, to: 700000, rate: 0.05 },
    { from: 700000, to: 1000000, rate: 0.10 },
    { from: 1000000, to: 1200000, rate: 0.15 },
    { from: 1200000, to: 1500000, rate: 0.20 },
    { from: 1500000, to: Infinity, rate: 0.30 },
  ];
  
  let totalTax = 0;
  let remaining = income;
  
  for (const slab of slabs) {
    if (remaining <= 0) break;
    const slabWidth = slab.to === Infinity ? remaining : slab.to - slab.from;
    const taxableInSlab = Math.min(remaining, slabWidth);
    const taxInSlab = Math.round(taxableInSlab * slab.rate);
    totalTax += taxInSlab;
    remaining -= taxableInSlab;
    console.log(`  Slab ${slab.from}-${slab.to === Infinity ? '∞' : slab.to} @ ${slab.rate*100}%: taxable=${taxableInSlab}, tax=${taxInSlab}`);
  }
  
  return totalTax;
}

console.log("=== Tax Engine Validation ===\n");

// Income inputs from PDF
const housePropertyIncome = 752441 + 1609602; // Two let-out properties
const stcg_20 = 4765879;
const stcg_15 = 839056;
const ltcg_125 = 778098;
const ltcg_10 = 1887778;
const stcgOther = 0;
const ltcgOther = 0;
const otherSources = 178267;

const capitalGains = stcg_20 + stcg_15 + ltcg_125 + ltcg_10 + stcgOther + ltcgOther;
const grossTotalIncome = housePropertyIncome + capitalGains + otherSources;

console.log(`House Property: ${housePropertyIncome} (expected: 2362043)`);
console.log(`Capital Gains: ${capitalGains} (expected: 8270811)`);
console.log(`Other Sources: ${otherSources} (expected: 178267)`);
console.log(`Gross Total Income: ${grossTotalIncome} (expected: 10811121)`);
console.log();

// Normal income = total - special rate CG
const specialRateCG = stcg_20 + stcg_15 + ltcg_125 + ltcg_10;
const normalIncome = grossTotalIncome - specialRateCG;
console.log(`Normal Income: ${normalIncome} (expected: 2540310 ~ 2540309)`);
console.log();

// Slab tax
console.log("Slab computation:");
const taxOnNormal = computeSlabTax_FY2024_25(normalIncome);
console.log(`Tax on Normal Income: ${taxOnNormal} (expected: 452093)`);
console.log();

// Special rate taxes
const taxSTCG_20 = Math.round(stcg_20 * 0.20);
const taxSTCG_15 = Math.round(stcg_15 * 0.15);
const ltcg_125_taxable = Math.max(0, ltcg_125 - 125000);
const taxLTCG_125 = Math.round(ltcg_125_taxable * 0.125);
const taxLTCG_10 = Math.round(ltcg_10 * 0.10);

console.log(`STCG @ 20%: ${taxSTCG_20} (expected: 953176)`);
console.log(`STCG @ 15%: ${taxSTCG_15} (expected: 125858)`);
console.log(`LTCG @ 12.5% (taxable ${ltcg_125_taxable}): ${taxLTCG_125} (expected: 81637)`);
console.log(`LTCG @ 10%: ${taxLTCG_10} (expected: 188778)`);
console.log();

const totalTax = taxOnNormal + taxSTCG_20 + taxSTCG_15 + taxLTCG_125 + taxLTCG_10;
console.log(`Total Tax: ${totalTax} (expected: 1801542)`);

// Surcharge @ 15%
const surcharge = Math.round(totalTax * 0.15);
console.log(`Surcharge @ 15%: ${surcharge} (expected: 270231)`);

const afterSurcharge = totalTax + surcharge;
console.log(`After Surcharge: ${afterSurcharge} (expected: 2071773)`);

// Cess @ 4%
const cess = Math.round(afterSurcharge * 0.04);
console.log(`Cess @ 4%: ${cess} (expected: 82871)`);

const grossTax = afterSurcharge + cess;
console.log(`Gross Tax: ${grossTax} (expected: 2154644)`);
console.log();

// TDS & Advance Tax
const tds = 30805 + 8268 + 68 + 6303 + 357134;
const advanceTax = 63000;
console.log(`Total TDS: ${tds} (expected: 402578)`);
console.log(`Advance Tax: ${advanceTax}`);

const taxPayable = grossTax - tds - advanceTax;
console.log(`Tax Payable: ${taxPayable} (expected: 1689066)`);

console.log("\n=== Validation Complete ===");

// Check differences
const checks = [
  ["House Property", housePropertyIncome, 2362043],
  ["Capital Gains", capitalGains, 8270811],
  ["Gross Total Income", grossTotalIncome, 10811121],
  ["Normal Income", normalIncome, 2540310],
  ["Tax on Normal", taxOnNormal, 452093],
  ["STCG 20%", taxSTCG_20, 953176],
  ["STCG 15%", taxSTCG_15, 125858],
  ["LTCG 12.5%", taxLTCG_125, 81637],
  ["LTCG 10%", taxLTCG_10, 188778],
  ["Total Tax", totalTax, 1801542],
  ["Surcharge", surcharge, 270231],
  ["Cess", cess, 82871],
  ["Gross Tax", grossTax, 2154644],
  ["TDS", tds, 402578],
  ["Tax Payable", taxPayable, 1689066],
];

console.log("\n=== Difference Report ===");
let allPass = true;
for (const [name, actual, expected] of checks) {
  const diff = actual - expected;
  const status = Math.abs(diff) <= 5 ? "✓" : "✗";
  if (Math.abs(diff) > 5) allPass = false;
  console.log(`${status} ${name}: actual=${actual}, expected=${expected}, diff=${diff}`);
}
console.log(allPass ? "\n✓ ALL CHECKS PASSED" : "\n✗ SOME CHECKS FAILED");
