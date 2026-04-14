/**
 * Indian Income Tax Computation Engine — New Regime
 * 
 * Design: Swiss Financial — this module is the computational core.
 * Supports FY 2024-25 and FY 2025-26 with correct slab rates,
 * capital gains rates (pre/post Budget 2024), surcharge, cess.
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
  standardDeduction: number; // 75000 for FY 2025-26, 75000 for FY 2024-25
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
  standardDeduction: number; // 30% of annual value
  interestOnLoan: number;
  taxableIncome: number;
}

export interface CapitalGainsIncome {
  // Short Term Capital Gains
  stcg111A_20: number;  // STCG u/s 111A @ 20% (listed equity, STT paid) — post July 2024
  stcg111A_15: number;  // STCG u/s 111A @ 15% (listed equity, STT paid) — pre July 2024 (only for FY 2024-25)
  stcgOther: number;    // STCG on other assets (taxed at slab rate)
  
  // Long Term Capital Gains
  ltcg112A_125: number; // LTCG u/s 112A @ 12.5% (listed equity, STT paid) — post July 2024
  ltcg112A_10: number;  // LTCG u/s 112A @ 10% (listed equity) — pre July 2024 (grandfathered, only FY 2024-25)
  ltcgOther: number;    // LTCG on other assets @ 12.5%
  
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
  taxOnSTCG111A_20: number;
  taxOnSTCG111A_15: number;
  taxOnLTCG112A_125: number;
  taxOnLTCG112A_10: number;
  
  // Totals
  totalTaxBeforeSurcharge: number;
  
  // Rebate u/s 87A
  rebate87A: number;
  taxAfterRebate: number;
  
  // Surcharge
  surchargeRate: number;
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

const STANDARD_DEDUCTION_SALARY: Record<FinancialYear, number> = {
  "2024-25": 75000,
  "2025-26": 75000,
};

const LTCG_112A_EXEMPTION: Record<FinancialYear, number> = {
  "2024-25": 125000,
  "2025-26": 125000,
};

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
  // New Regime surcharge rates
  // Max surcharge capped at 25% for new regime
  // But for capital gains (111A, 112A), max surcharge is 15%
  if (totalIncome <= 5000000) return 0;
  if (totalIncome <= 10000000) return 0.10;
  if (totalIncome <= 20000000) return 0.15;
  return 0.25; // Capped at 25% for new regime
}

function computeSurchargeRateForCapitalGains(totalIncome: number): number {
  // For STCG u/s 111A and LTCG u/s 112A, max surcharge is 15%
  if (totalIncome <= 5000000) return 0;
  if (totalIncome <= 10000000) return 0.10;
  return 0.15; // Capped at 15% for capital gains
}

function roundToTen(amount: number): number {
  return Math.round(amount / 10) * 10;
}

// ─── Main Computation ────────────────────────────────────────────────

export function computeTax(inputs: TaxInputs): TaxComputation {
  const fy = inputs.assesseeInfo.financialYear;
  
  // ── Income Summary ──
  const salaryIncome = inputs.salary.netSalary;
  const housePropertyIncome = inputs.houseProperty.totalIncome;
  const capitalGainsIncome = inputs.capitalGains.totalCapitalGains;
  const otherSourcesIncome = inputs.otherSources.totalIncome;
  
  const grossTotalIncome = salaryIncome + housePropertyIncome + capitalGainsIncome + otherSourcesIncome;
  
  // ── Deductions (New Regime — very limited) ──
  // Standard deduction is already applied in salary computation
  // Family pension deduction (1/3 of pension or 15000, whichever is less)
  const familyPensionDeduction = Math.min(
    Math.round(inputs.otherSources.familyPension / 3),
    15000
  );
  const totalDeductions = familyPensionDeduction;
  
  const totalIncome = Math.max(0, grossTotalIncome - totalDeductions);
  const totalIncomeRounded = roundToTen(totalIncome);
  
  // ── Separate Normal Income from Special Rate Income ──
  // Normal income = Total income - all special rate capital gains
  const specialRateIncome = 
    inputs.capitalGains.stcg111A_20 +
    inputs.capitalGains.stcg111A_15 +
    inputs.capitalGains.ltcg112A_125 +
    inputs.capitalGains.ltcg112A_10;
  
  const normalIncome = Math.max(0, totalIncome - specialRateIncome);
  
  // ── Tax on Normal Income (Slab Rates) ──
  const { slabs: slabComputation, total: taxOnNormalIncome } = computeSlabTax(normalIncome, fy);
  
  // ── Tax on Special Rate Capital Gains ──
  const taxOnSTCG111A_20 = Math.round(inputs.capitalGains.stcg111A_20 * 0.20);
  const taxOnSTCG111A_15 = Math.round(inputs.capitalGains.stcg111A_15 * 0.15);
  
  // LTCG u/s 112A — exemption of ₹1.25L (FY 2024-25 onwards)
  const ltcg112A_taxable_125 = Math.max(0, inputs.capitalGains.ltcg112A_125 - LTCG_112A_EXEMPTION[fy]);
  const taxOnLTCG112A_125 = Math.round(ltcg112A_taxable_125 * 0.125);
  
  // LTCG @ 10% (grandfathered, pre-July 2024)
  const taxOnLTCG112A_10 = Math.round(inputs.capitalGains.ltcg112A_10 * 0.10);
  
  const totalTaxBeforeSurcharge = taxOnNormalIncome + taxOnSTCG111A_20 + taxOnSTCG111A_15 + taxOnLTCG112A_125 + taxOnLTCG112A_10;
  
  // ── Rebate u/s 87A ──
  // Available only if total income (excluding special rate income) <= limit
  // Rebate does NOT apply to special rate income
  const rebateConfig = REBATE_87A[fy];
  let rebate87A = 0;
  if (normalIncome <= rebateConfig.limit) {
    rebate87A = Math.min(taxOnNormalIncome, rebateConfig.maxRebate);
  }
  
  const taxAfterRebate = totalTaxBeforeSurcharge - rebate87A;
  
  // ── Surcharge ──
  // For simplicity, we apply a blended surcharge approach
  // In practice, surcharge on CG income is capped at 15%
  const surchargeRate = computeSurchargeRate(totalIncome);
  const surchargeRateCG = computeSurchargeRateForCapitalGains(totalIncome);
  
  // Surcharge on normal income tax
  const surchargeOnNormal = Math.round((taxOnNormalIncome - rebate87A) * surchargeRate);
  // Surcharge on CG tax (capped at 15%)
  const surchargeOnCG = Math.round(
    (taxOnSTCG111A_20 + taxOnSTCG111A_15 + taxOnLTCG112A_125 + taxOnLTCG112A_10) * surchargeRateCG
  );
  
  const surchargeAmount = Math.max(0, surchargeOnNormal + surchargeOnCG);
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
    taxOnSTCG111A_20,
    taxOnSTCG111A_15,
    taxOnLTCG112A_125,
    taxOnLTCG112A_10,
    totalTaxBeforeSurcharge,
    rebate87A,
    taxAfterRebate,
    surchargeRate: Math.max(surchargeRate, surchargeRateCG),
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
  let taxableIncome: number;
  
  if (property.type === "self-occupied") {
    annualValue = 0;
    standardDeduction = 0;
    // For self-occupied, only interest on loan is deductible (max 2L in old regime, no limit in new regime for let-out)
    // In new regime, self-occupied: interest deduction up to 2L
    taxableIncome = -Math.min(interestOnLoan, 200000);
  } else {
    // Let out or deemed let out
    annualValue = annualRent - municipalTaxes;
    standardDeduction = Math.round(annualValue * 0.30);
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
  const ltcgOther = inputs.ltcgOther || 0;
  
  const totalSTCG = stcg111A_20 + stcg111A_15 + stcgOther;
  const totalLTCG = ltcg112A_125 + ltcg112A_10 + ltcgOther;
  const totalCapitalGains = totalSTCG + totalLTCG;
  
  return {
    stcg111A_20,
    stcg111A_15,
    stcgOther,
    ltcg112A_125,
    ltcg112A_10,
    ltcgOther,
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
  
  // Indian number formatting (lakhs/crores)
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
