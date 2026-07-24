/**
 * Indian Income Tax Computation Engine — New Regime
 * 
 * Design: Swiss Financial — this module is the computational core.
 * Supports FY 2024-25 and FY 2025-26 with correct slab rates,
 * capital gains rates (pre/post Budget 2024), surcharge, cess,
 * marginal relief on surcharge, and marginal relief on rebate 87A.
 * 
 * All amounts in INR (paise not used — whole numbers only).
 */

// ─── Types ───────────────────────────────────────────────────────────

export type FinancialYear = "2024-25" | "2025-26";

export type ResidentialStatus = "resident" | "resident-senior" | "resident-super-senior" | "nri";

export interface AssesseeInfo {
  name: string;
  pan: string;
  fatherName: string;
  dob: string;
  gender: "male" | "female" | "other";
  residentialStatus: ResidentialStatus;
  address: string;
  email: string;
  phone: string;
  financialYear: FinancialYear;
}

export interface SalaryIncome {
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  otherAllowances: number;
  perquisites: number;
  profitsInLieu: number;
  grossSalary: number;
  standardDeduction: number;
  netSalary: number;
}

export interface HousePropertyIncome {
  properties: HouseProperty[];
  totalIncome: number;
}

export interface HouseProperty {
  id: string;
  type: "self-occupied" | "let-out" | "deemed-let-out";
  tenantName?: string;
  tenantPan?: string;
  address?: string;
  annualRent: number;
  municipalTaxes: number;
  annualValue: number;
  standardDeduction: number;
  interestOnLoan: number;
  /** Interest entered but not allowable under the new regime (self-occupied). */
  interestDisallowed: number;
  taxableIncome: number;
}

export interface CapitalGainsIncome {
  stcg111A_20: number;
  stcg111A_15: number;
  /** STCG on non-STT assets — correctly taxed at slab rates. */
  stcgOther: number;
  ltcg112A_125: number;
  ltcg112A_10: number;
  /** LTCG u/s 112 (property, unlisted shares, debt, gold) @ 12.5% without indexation. */
  ltcgOther_125: number;
  /** LTCG u/s 112 on transfers before 23 July 2024 @ 20% with indexation. FY 2024-25 only. */
  ltcgOther_20: number;
  totalSTCG: number;
  totalLTCG: number;
  totalCapitalGains: number;
}

export interface OtherSourcesIncome {
  savingsBankInterest: number;
  fdInterest: number;
  postOfficeInterest: number;
  dividendIncome: number;
  interestOnSecurities: number;
  familyPension: number;
  otherIncome: number;
  totalIncome: number;
}

export interface TDSEntry {
  section: string;
  description: string;
  amount: number;
}

export interface TaxInputs {
  assesseeInfo: AssesseeInfo;
  salary: SalaryIncome;
  houseProperty: HousePropertyIncome;
  capitalGains: CapitalGainsIncome;
  otherSources: OtherSourcesIncome;
  tdsEntries: TDSEntry[];
  advanceTax: number;
  selfAssessmentTax: number;
}

export interface SlabComputation {
  from: number;
  to: number;
  rate: number;
  taxableAmount: number;
  tax: number;
}

export interface TaxComputation {
  // Income Summary
  salaryIncome: number;
  /** Head total before the 115BAC set-off bar — negative if the head is a loss. */
  housePropertyIncomeGross: number;
  /** Loss under the house property head that 115BAC does not allow to be set off. */
  housePropertyLossDisallowed: number;
  housePropertyIncome: number;
  capitalGainsIncome: number;
  otherSourcesIncome: number;
  grossTotalIncome: number;
  
  // Deductions (limited in new regime)
  standardDeductionSalary: number;
  familyPensionDeduction: number;
  totalDeductions: number;
  
  // Total Income
  totalIncome: number;
  totalIncomeRounded: number;
  
  // Normal income (for slab rate)
  normalIncome: number;
  
  // Tax on Normal Income (slab-based)
  slabComputation: SlabComputation[];
  taxOnNormalIncome: number;
  
  // Tax on Special Rate Income
  /** Portion of the 1,25,000 s.112A exemption actually absorbed this year. */
  ltcg112AExemptionUsed: number;
  /** Unused basic exemption set off against special-rate gains (resident only). */
  basicExemptionUsedAgainstCG: number;
  taxOnSTCG111A_20: number;
  taxOnSTCG111A_15: number;
  taxOnLTCG112A_125: number;
  taxOnLTCG112A_10: number;
  /** Tax on LTCG u/s 112 @ 12.5% (no indexation). */
  taxOnLTCGOther_125: number;
  /** Tax on LTCG u/s 112 @ 20% with indexation (pre-23 July 2024). */
  taxOnLTCGOther_20: number;
  
  // Totals
  totalTaxBeforeSurcharge: number;
  
  // Rebate u/s 87A
  rebate87A: number;
  rebate87AMarginalRelief: number;  // NEW: marginal relief amount on rebate
  taxAfterRebate: number;
  
  // Surcharge
  surchargeRate: number;
  surchargeRateCG: number;          // NEW: separate CG surcharge rate
  surchargeOnNormal: number;        // NEW: surcharge on normal income
  surchargeOnCG: number;            // NEW: surcharge on CG income
  surchargeBeforeMarginalRelief: number; // NEW
  surchargeMarginalRelief: number;  // NEW: marginal relief amount on surcharge
  surchargeAmount: number;
  taxAfterSurcharge: number;
  
  // Cess
  cessRate: number;
  cessAmount: number;
  grossTaxLiability: number;
  
  // Relief & Credits
  totalTDS: number;
  totalAdvanceTax: number;
  totalSelfAssessmentTax: number;
  totalTaxesPaid: number;
  
  // Net
  netTaxPayable: number;
  refundDue: number;
}

// ─── Tax Slab Configurations ─────────────────────────────────────────

interface TaxSlab {
  from: number;
  to: number;
  rate: number;
}

const NEW_REGIME_SLABS: Record<FinancialYear, TaxSlab[]> = {
  "2024-25": [
    { from: 0, to: 300000, rate: 0 },
    { from: 300000, to: 700000, rate: 0.05 },
    { from: 700000, to: 1000000, rate: 0.10 },
    { from: 1000000, to: 1200000, rate: 0.15 },
    { from: 1200000, to: 1500000, rate: 0.20 },
    { from: 1500000, to: Infinity, rate: 0.30 },
  ],
  "2025-26": [
    { from: 0, to: 400000, rate: 0 },
    { from: 400000, to: 800000, rate: 0.05 },
    { from: 800000, to: 1200000, rate: 0.10 },
    { from: 1200000, to: 1600000, rate: 0.15 },
    { from: 1600000, to: 2000000, rate: 0.20 },
    { from: 2000000, to: 2400000, rate: 0.25 },
    { from: 2400000, to: Infinity, rate: 0.30 },
  ],
};

const REBATE_87A: Record<FinancialYear, { limit: number; maxRebate: number }> = {
  "2024-25": { limit: 700000, maxRebate: 25000 },
  "2025-26": { limit: 1200000, maxRebate: 60000 },
};

// Outer bound of the s.87A marginal relief zone. Relief tapers to nothing well
// before these figures (~7,22,000 and ~12,70,600 respectively, where slab tax
// first exceeds the excess over the threshold); these are simply the points
// past which relief can never be due.
const REBATE_87A_MARGINAL_RELIEF_CEILING: Record<FinancialYear, number> = {
  "2024-25": 750000,
  "2025-26": 1275000,
};

const STANDARD_DEDUCTION_SALARY: Record<FinancialYear, number> = {
  "2024-25": 75000,
  "2025-26": 75000,
};

const LTCG_112A_EXEMPTION: Record<FinancialYear, number> = {
  "2024-25": 125000,
  "2025-26": 125000,
};

// Deduction u/s 57(iia) on family pension. The Finance (No.2) Act 2024 raised
// the cap from 15,000 to 25,000 under the new regime with effect from
// AY 2025-26, so both years this tool supports get 25,000. (15,000 is the
// old-regime figure, and this tool is new-regime only.)
const FAMILY_PENSION_DEDUCTION_CAP: Record<FinancialYear, number> = {
  "2024-25": 25000,
  "2025-26": 25000,
};

// Surcharge thresholds for marginal relief computation
// Each entry: [threshold, rate_below, rate_at_or_above]
const SURCHARGE_THRESHOLDS: Array<[number, number, number]> = [
  [5000000,  0,    0.10],  // 50L: 0% → 10%
  [10000000, 0.10, 0.15],  // 1Cr: 10% → 15%
  [20000000, 0.15, 0.25],  // 2Cr: 15% → 25%
];

// ─── Computation Functions ───────────────────────────────────────────

function computeSlabTax(income: number, fy: FinancialYear): { slabs: SlabComputation[]; total: number } {
  const slabs = NEW_REGIME_SLABS[fy];
  const result: SlabComputation[] = [];
  let totalTax = 0;
  let remaining = income;

  for (const slab of slabs) {
    if (remaining <= 0) break;
    
    const slabWidth = slab.to === Infinity ? remaining : slab.to - slab.from;
    const taxableInSlab = Math.min(remaining, slabWidth);
    const taxInSlab = Math.round(taxableInSlab * slab.rate);
    
    result.push({
      from: slab.from,
      to: slab.to === Infinity ? slab.from + taxableInSlab : slab.to,
      rate: slab.rate,
      taxableAmount: taxableInSlab,
      tax: taxInSlab,
    });
    
    totalTax += taxInSlab;
    remaining -= taxableInSlab;
  }

  return { slabs: result, total: totalTax };
}

function computeSurchargeRate(totalIncome: number): number {
  if (totalIncome <= 5000000) return 0;
  if (totalIncome <= 10000000) return 0.10;
  if (totalIncome <= 20000000) return 0.15;
  return 0.25;
}

function computeSurchargeRateForCapitalGains(totalIncome: number): number {
  if (totalIncome <= 5000000) return 0;
  if (totalIncome <= 10000000) return 0.10;
  return 0.15;
}

function roundToTen(amount: number): number {
  return Math.round(amount / 10) * 10;
}

// ─── Main Computation ────────────────────────────────────────────────

export function computeTax(inputs: TaxInputs): TaxComputation {
  const fy = inputs.assesseeInfo.financialYear;
  
  // ── Income Summary ──
  const salaryIncome = inputs.salary.netSalary;

  // s.115BAC(2)(i) bars a loss under the head "Income from house property" from
  // being set off against income under any other head, and s.115BAC(2)(ii) bars
  // carrying it forward — so an unabsorbed loss is simply lost. Set-off *within*
  // the head is still allowed under s.70, so the floor applies to the aggregate
  // of all properties, not to each property individually.
  const housePropertyIncomeGross = inputs.houseProperty.totalIncome;
  const housePropertyIncome = Math.max(0, housePropertyIncomeGross);
  const housePropertyLossDisallowed = Math.max(0, -housePropertyIncomeGross);

  const capitalGainsIncome = inputs.capitalGains.totalCapitalGains;
  const otherSourcesIncome = inputs.otherSources.totalIncome;
  
  const grossTotalIncome = salaryIncome + housePropertyIncome + capitalGainsIncome + otherSourcesIncome;
  
  // ── Deductions (New Regime — very limited) ──
  const familyPensionDeduction = Math.min(
    Math.round(inputs.otherSources.familyPension / 3),
    FAMILY_PENSION_DEDUCTION_CAP[fy]
  );
  const totalDeductions = familyPensionDeduction;
  
  const totalIncome = Math.max(0, grossTotalIncome - totalDeductions);
  const totalIncomeRounded = roundToTen(totalIncome);
  
  // ── Separate Normal Income from Special Rate Income ──
  // Everything charged at its own rate rather than at slab rates. stcgOther is
  // deliberately absent: STCG on non-STT assets really is taxed at slab rates.
  const specialRateIncome =
    inputs.capitalGains.stcg111A_20 +
    inputs.capitalGains.stcg111A_15 +
    inputs.capitalGains.ltcg112A_125 +
    inputs.capitalGains.ltcg112A_10 +
    inputs.capitalGains.ltcgOther_125 +
    inputs.capitalGains.ltcgOther_20;
  
  const normalIncome = Math.max(0, totalIncome - specialRateIncome);
  
  // ── Tax on Normal Income (Slab Rates) ──
  const { slabs: slabComputation, total: taxOnNormalIncome } = computeSlabTax(normalIncome, fy);
  
  // s.87A and the basic-exemption provisos to ss.111A/112/112A are all confined
  // to residents, so this gates several things below.
  const isResidentIndividual = inputs.assesseeInfo.residentialStatus !== "nri";

  // ── Tax on Special Rate Capital Gains ──
  //
  // The 1,25,000 exemption u/s 112A is a single annual allowance across all
  // 112A long-term gains, not one allowance per rate bucket. Where FY 2024-25
  // splits those gains either side of 23 July 2024, allocate the exemption
  // against the higher-taxed (12.5%) bucket first: that is the most beneficial
  // order for the assessee, and it reproduces the allocation in the CA
  // computation this engine was validated against.
  //
  // It does not extend to LTCG u/s 112 (ltcgOther) — that is a different
  // section with no such exemption.
  const exemption112A = LTCG_112A_EXEMPTION[fy];
  const exemptionAgainst125 = Math.min(inputs.capitalGains.ltcg112A_125, exemption112A);
  const exemptionAgainst10 = Math.min(
    inputs.capitalGains.ltcg112A_10,
    exemption112A - exemptionAgainst125
  );
  const ltcg112AExemptionUsed = exemptionAgainst125 + exemptionAgainst10;

  const ltcg112A_taxable_125 = inputs.capitalGains.ltcg112A_125 - exemptionAgainst125;
  const ltcg112A_taxable_10 = inputs.capitalGains.ltcg112A_10 - exemptionAgainst10;

  // The specially-taxed buckets, richest rate first.
  //
  // LTCG u/s 112 — property, unlisted shares, debt, gold — is charged at its own
  // rate rather than at slab rates, and gets no 1,25,000 exemption (that lives
  // in s.112A). The Finance (No.2) Act 2024 moved it to 12.5% without indexation
  // for transfers on or after 23 July 2024; earlier transfers stay at 20% with
  // indexation.
  const specialRateBuckets = [
    { key: "stcg111A_20", amount: inputs.capitalGains.stcg111A_20, rate: 0.2 },
    { key: "ltcgOther_20", amount: inputs.capitalGains.ltcgOther_20, rate: 0.2 },
    { key: "stcg111A_15", amount: inputs.capitalGains.stcg111A_15, rate: 0.15 },
    { key: "ltcg112A_125", amount: ltcg112A_taxable_125, rate: 0.125 },
    { key: "ltcgOther_125", amount: inputs.capitalGains.ltcgOther_125, rate: 0.125 },
    { key: "ltcg112A_10", amount: ltcg112A_taxable_10, rate: 0.1 },
  ];

  // The provisos to s.111A(1), s.112(1)(a) and s.112A(2) all say the same thing:
  // for a RESIDENT individual or HUF, where total income as reduced by these
  // specially-taxed gains falls short of the maximum amount not chargeable to
  // tax, the gains are reduced by that shortfall before their rate is applied.
  // In other words the basic exemption is not forfeited just because someone's
  // income happens to be capital gains — which is exactly the position of a
  // retiree living off a property sale.
  //
  // Non-residents get no such relief: s.112(1)(c) and the corresponding limbs
  // carry no equivalent proviso.
  //
  // The shortfall is absorbed against the highest-taxed bucket first, the
  // allocation most favourable to the assessee.
  const basicExemptionLimit = NEW_REGIME_SLABS[fy].find(s => s.rate === 0)?.to ?? 0;
  let unusedBasicExemption = isResidentIndividual
    ? Math.max(0, basicExemptionLimit - normalIncome)
    : 0;

  const taxByBucket: Record<string, number> = {};
  let basicExemptionUsedAgainstCG = 0;

  for (const bucket of specialRateBuckets) {
    const chargeable = Math.max(0, bucket.amount);
    const absorbed = Math.min(chargeable, unusedBasicExemption);
    unusedBasicExemption -= absorbed;
    basicExemptionUsedAgainstCG += absorbed;
    taxByBucket[bucket.key] = Math.round((chargeable - absorbed) * bucket.rate);
  }

  const taxOnSTCG111A_20 = taxByBucket.stcg111A_20;
  const taxOnSTCG111A_15 = taxByBucket.stcg111A_15;
  const taxOnLTCG112A_125 = taxByBucket.ltcg112A_125;
  const taxOnLTCG112A_10 = taxByBucket.ltcg112A_10;
  const taxOnLTCGOther_125 = taxByBucket.ltcgOther_125;
  const taxOnLTCGOther_20 = taxByBucket.ltcgOther_20;

  const totalTaxBeforeSurcharge =
    taxOnNormalIncome +
    taxOnSTCG111A_20 +
    taxOnSTCG111A_15 +
    taxOnLTCG112A_125 +
    taxOnLTCG112A_10 +
    taxOnLTCGOther_125 +
    taxOnLTCGOther_20;
  
  // ── Rebate u/s 87A with Marginal Relief ──
  //
  // Two separate questions, and the engine previously conflated them:
  //
  //   Eligibility is on TOTAL income. s.87A applies where "the total income of
  //   an assessee, being an individual resident in India" does not exceed the
  //   limit. Testing it against income net of special-rate capital gains handed
  //   a rebate to people well over the threshold.
  //
  //   The rebate AMOUNT is computed only against tax on non-special-rate
  //   income. s.112A(6) bars it against 112A gains outright, and the e-filing
  //   utility has disallowed it against 111A gains since July 2024 — a position
  //   the Finance Act 2025 wrote into the first proviso to s.87A from
  //   AY 2026-27. Keeping the base as taxOnNormalIncome is the position the
  //   department's own utility takes for both years this tool supports.
  //
  // Non-residents are outside s.87A entirely.
  const rebateConfig = REBATE_87A[fy];
  let rebate87A = 0;
  let rebate87AMarginalRelief = 0;

  if (isResidentIndividual) {
    if (totalIncome <= rebateConfig.limit) {
      rebate87A = Math.min(taxOnNormalIncome, rebateConfig.maxRebate);
    } else if (totalIncome <= REBATE_87A_MARGINAL_RELIEF_CEILING[fy]) {
      // Inside the marginal relief zone the tax must not exceed the amount by
      // which total income overshoots the threshold. The ceiling below is a
      // loose outer bound — the comparison itself decides whether relief is
      // actually due, so no relief is granted once tax has grown past the
      // excess.
      const excessOverLimit = totalIncome - rebateConfig.limit;
      if (taxOnNormalIncome > excessOverLimit) {
        rebate87A = taxOnNormalIncome - excessOverLimit;
        rebate87AMarginalRelief = rebate87A; // here the whole rebate IS the relief
      }
    }
  }
  
  const taxAfterRebate = totalTaxBeforeSurcharge - rebate87A;
  
  // ── Surcharge ──
  const surchargeRate = computeSurchargeRate(totalIncome);
  const surchargeRateCG = computeSurchargeRateForCapitalGains(totalIncome);
  
  const taxOnNormalAfterRebate = Math.max(0, taxOnNormalIncome - rebate87A);
  // Surcharge on capital gains is capped at 15%. That cap covers s.111A and
  // s.112A, and the Finance Act 2022 extended it to long-term gains under
  // s.112 as well — so the s.112 buckets belong in this base, not the normal
  // one. Above 2 crore the difference is 25% vs 15%.
  const taxOnCG =
    taxOnSTCG111A_20 +
    taxOnSTCG111A_15 +
    taxOnLTCG112A_125 +
    taxOnLTCG112A_10 +
    taxOnLTCGOther_125 +
    taxOnLTCGOther_20;
  
  // Surcharge on normal income tax (after rebate)
  const surchargeOnNormal = Math.round(taxOnNormalAfterRebate * surchargeRate);
  // Surcharge on CG tax (capped at 15%)
  const surchargeOnCG = Math.round(taxOnCG * surchargeRateCG);
  
  const surchargeBeforeMarginalRelief = Math.max(0, surchargeOnNormal + surchargeOnCG);
  
  // ── Surcharge Marginal Relief ──
  // At each threshold (50L, 1Cr, 2Cr), ensure tax+surcharge doesn't exceed
  // tax+surcharge at threshold + excess income over threshold
  let surchargeMarginalRelief = 0;
  
  if (surchargeBeforeMarginalRelief > 0) {
    // Find the highest threshold that was just crossed
    // We iterate in reverse to find the most relevant threshold first
    const reversedThresholds = [...SURCHARGE_THRESHOLDS].reverse();
    
    for (const [threshold, lowerRate, _higherRate] of reversedThresholds) {
      if (totalIncome <= threshold) continue; // Haven't crossed this threshold
      
      // Check if the surcharge rate actually changes at this threshold
      const rateAbove = computeSurchargeRate(threshold + 1);
      const rateAtOrBelow = computeSurchargeRate(threshold);
      if (rateAbove <= rateAtOrBelow) continue; // No rate change here
      
      // This is the relevant threshold — compute marginal relief
      const actualTaxPlusSurcharge = taxOnNormalAfterRebate + taxOnCG + surchargeBeforeMarginalRelief;

      // Reconstruct the position at exactly the threshold. The excess over the
      // threshold comes off normal income first; whatever it cannot absorb has
      // to come off the special-rate income, otherwise the notional taxpayer at
      // the threshold is credited with more capital gains than they could have
      // had — which understates the ceiling and overstates the relief.
      const excessIncome = totalIncome - threshold;
      const normalIncomeAtThreshold = Math.max(0, normalIncome - excessIncome);
      const { total: taxOnNormalAtThreshold } = computeSlabTax(normalIncomeAtThreshold, fy);

      const cgReduction = Math.max(0, excessIncome - normalIncome);
      const cgAtThreshold = Math.max(0, specialRateIncome - cgReduction);
      const taxOnCGAtThreshold =
        specialRateIncome > 0
          ? Math.round(taxOnCG * (cgAtThreshold / specialRateIncome))
          : 0;

      // Eligibility for the 87A rebate at the threshold is on TOTAL income at
      // the threshold — which is the threshold itself, 50,00,000 or more, so no
      // rebate can ever be due here. Gating this on normalIncomeAtThreshold, as
      // it used to, granted a phantom rebate whenever slab income happened to
      // sit under the 87A limit, and made tax fall as income rose.
      const rebateAtThreshold =
        isResidentIndividual && threshold <= rebateConfig.limit
          ? Math.min(taxOnNormalAtThreshold, rebateConfig.maxRebate)
          : 0;
      const taxOnNormalAfterRebateAtThreshold = Math.max(0, taxOnNormalAtThreshold - rebateAtThreshold);

      // Surcharge at threshold uses the lower rate
      const surchargeOnNormalAtThreshold = Math.round(taxOnNormalAfterRebateAtThreshold * lowerRate);
      const cgSurchargeRateAtThreshold = Math.min(lowerRate, 0.15);
      const surchargeOnCGAtThreshold = Math.round(taxOnCGAtThreshold * cgSurchargeRateAtThreshold);

      const taxPlusSurchargeAtThreshold =
        taxOnNormalAfterRebateAtThreshold +
        taxOnCGAtThreshold +
        surchargeOnNormalAtThreshold +
        surchargeOnCGAtThreshold;

      const ceiling = taxPlusSurchargeAtThreshold + excessIncome;

      if (actualTaxPlusSurcharge > ceiling) {
        // Relief is a reduction OF the surcharge, so it can never exceed it.
        surchargeMarginalRelief = Math.min(
          actualTaxPlusSurcharge - ceiling,
          surchargeBeforeMarginalRelief
        );
      }

      break; // Only the highest relevant threshold matters
    }
  }
  
  const surchargeAmount = Math.max(0, surchargeBeforeMarginalRelief - surchargeMarginalRelief);
  const taxAfterSurcharge = taxAfterRebate + surchargeAmount;
  
  // ── Health & Education Cess ──
  const cessRate = 0.04;
  const cessAmount = Math.round(taxAfterSurcharge * cessRate);
  const grossTaxLiability = taxAfterSurcharge + cessAmount;
  
  // ── TDS & Advance Tax ──
  const totalTDS = inputs.tdsEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalAdvanceTax = inputs.advanceTax;
  const totalSelfAssessmentTax = inputs.selfAssessmentTax;
  const totalTaxesPaid = totalTDS + totalAdvanceTax + totalSelfAssessmentTax;
  
  // ── Net Tax Payable / Refund ──
  const netAmount = grossTaxLiability - totalTaxesPaid;
  const netTaxPayable = Math.max(0, netAmount);
  const refundDue = Math.max(0, -netAmount);
  
  return {
    salaryIncome,
    housePropertyIncomeGross,
    housePropertyLossDisallowed,
    housePropertyIncome,
    capitalGainsIncome,
    otherSourcesIncome,
    grossTotalIncome,
    standardDeductionSalary: inputs.salary.standardDeduction,
    familyPensionDeduction,
    totalDeductions,
    totalIncome,
    totalIncomeRounded,
    normalIncome,
    slabComputation,
    taxOnNormalIncome,
    ltcg112AExemptionUsed,
    basicExemptionUsedAgainstCG,
    taxOnSTCG111A_20,
    taxOnSTCG111A_15,
    taxOnLTCG112A_125,
    taxOnLTCG112A_10,
    taxOnLTCGOther_125,
    taxOnLTCGOther_20,
    totalTaxBeforeSurcharge,
    rebate87A,
    rebate87AMarginalRelief,
    taxAfterRebate,
    surchargeRate,
    surchargeRateCG,
    surchargeOnNormal,
    surchargeOnCG,
    surchargeBeforeMarginalRelief,
    surchargeMarginalRelief,
    surchargeAmount,
    taxAfterSurcharge,
    cessRate,
    cessAmount,
    grossTaxLiability,
    totalTDS,
    totalAdvanceTax,
    totalSelfAssessmentTax,
    totalTaxesPaid,
    netTaxPayable,
    refundDue,
  };
}

// ─── Helper: Compute House Property ──────────────────────────────────

export function computeHouseProperty(property: Partial<HouseProperty>): HouseProperty {
  const annualRent = property.annualRent || 0;
  const municipalTaxes = property.municipalTaxes || 0;
  const interestOnLoan = property.interestOnLoan || 0;
  
  let annualValue: number;
  let standardDeduction: number;
  let interestDisallowed: number;
  let taxableIncome: number;

  if (property.type === "self-occupied") {
    // Annual value of a self-occupied property is nil u/s 23(2). Under the new
    // regime s.115BAC(2)(i) disallows the s.24(b) interest deduction on a
    // self-occupied property outright — the 2,00,000 cap is an old-regime rule
    // and does not apply here. The property contributes nothing to the head.
    annualValue = 0;
    standardDeduction = 0;
    interestDisallowed = interestOnLoan;
    taxableIncome = 0;
  } else {
    // Let-out and deemed let-out: municipal taxes come off the gross annual
    // value to give the net annual value, then the 30% standard deduction and
    // s.24(b) interest. Interest on a let-out property remains fully allowable
    // under the new regime, with no monetary cap.
    annualValue = annualRent - municipalTaxes;
    standardDeduction = Math.round(annualValue * 0.30);
    interestDisallowed = 0;
    taxableIncome = annualValue - standardDeduction - interestOnLoan;
  }

  return {
    id: property.id || crypto.randomUUID(),
    type: property.type || "let-out",
    tenantName: property.tenantName,
    tenantPan: property.tenantPan,
    address: property.address,
    annualRent,
    municipalTaxes,
    annualValue,
    standardDeduction,
    interestOnLoan,
    interestDisallowed,
    taxableIncome,
  };
}

// ─── Helper: Compute Salary ──────────────────────────────────────────

export function computeSalary(
  inputs: Partial<SalaryIncome>,
  fy: FinancialYear
): SalaryIncome {
  const basicSalary = inputs.basicSalary || 0;
  const hra = inputs.hra || 0;
  const specialAllowance = inputs.specialAllowance || 0;
  const otherAllowances = inputs.otherAllowances || 0;
  const perquisites = inputs.perquisites || 0;
  const profitsInLieu = inputs.profitsInLieu || 0;
  
  const grossSalary = basicSalary + hra + specialAllowance + otherAllowances + perquisites + profitsInLieu;
  const standardDeduction = grossSalary > 0 ? STANDARD_DEDUCTION_SALARY[fy] : 0;
  const netSalary = Math.max(0, grossSalary - standardDeduction);
  
  return {
    basicSalary,
    hra,
    specialAllowance,
    otherAllowances,
    perquisites,
    profitsInLieu,
    grossSalary,
    standardDeduction,
    netSalary,
  };
}

// ─── Helper: Compute Other Sources ───────────────────────────────────

export function computeOtherSources(inputs: Partial<OtherSourcesIncome>): OtherSourcesIncome {
  const savingsBankInterest = inputs.savingsBankInterest || 0;
  const fdInterest = inputs.fdInterest || 0;
  const postOfficeInterest = inputs.postOfficeInterest || 0;
  const dividendIncome = inputs.dividendIncome || 0;
  const interestOnSecurities = inputs.interestOnSecurities || 0;
  const familyPension = inputs.familyPension || 0;
  const otherIncome = inputs.otherIncome || 0;
  
  const totalIncome = savingsBankInterest + fdInterest + postOfficeInterest + 
    dividendIncome + interestOnSecurities + familyPension + otherIncome;
  
  return {
    savingsBankInterest,
    fdInterest,
    postOfficeInterest,
    dividendIncome,
    interestOnSecurities,
    familyPension,
    otherIncome,
    totalIncome,
  };
}

// ─── Helper: Compute Capital Gains ───────────────────────────────────

export function computeCapitalGains(inputs: Partial<CapitalGainsIncome>): CapitalGainsIncome {
  const stcg111A_20 = inputs.stcg111A_20 || 0;
  const stcg111A_15 = inputs.stcg111A_15 || 0;
  const stcgOther = inputs.stcgOther || 0;
  const ltcg112A_125 = inputs.ltcg112A_125 || 0;
  const ltcg112A_10 = inputs.ltcg112A_10 || 0;
  const ltcgOther_125 = inputs.ltcgOther_125 || 0;
  const ltcgOther_20 = inputs.ltcgOther_20 || 0;
  
  const totalSTCG = stcg111A_20 + stcg111A_15 + stcgOther;
  const totalLTCG = ltcg112A_125 + ltcg112A_10 + ltcgOther_125 + ltcgOther_20;
  const totalCapitalGains = totalSTCG + totalLTCG;
  
  return {
    stcg111A_20,
    stcg111A_15,
    stcgOther,
    ltcg112A_125,
    ltcg112A_10,
    ltcgOther_125,
    ltcgOther_20,
    totalSTCG,
    totalLTCG,
    totalCapitalGains,
  };
}

// ─── Formatting Helpers ──────────────────────────────────────────────

export function formatINR(amount: number): string {
  if (amount === 0) return "—";
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  
  const str = abs.toString();
  let result = "";
  
  if (str.length <= 3) {
    result = str;
  } else {
    result = str.slice(-3);
    let remaining = str.slice(0, -3);
    while (remaining.length > 2) {
      result = remaining.slice(-2) + "," + result;
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) {
      result = remaining + "," + result;
    }
  }
  
  return (isNegative ? "-" : "") + result;
}

export function formatINRWithSymbol(amount: number): string {
  if (amount === 0) return "—";
  return "\u20B9" + formatINR(amount);
}
