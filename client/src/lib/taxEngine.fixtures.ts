/**
 * Shared input builder for the tax engine test suites.
 *
 * Lives outside the .test.ts files so importing it does not re-register
 * another suite's describe blocks.
 */

import { computeSalary, computeCapitalGains, computeOtherSources } from "./taxEngine";
import type {
  TaxInputs,
  FinancialYear,
  CapitalGainsIncome,
  OtherSourcesIncome,
  TDSEntry,
  HousePropertyIncome,
} from "./taxEngine";

export interface Overrides {
  fy?: FinancialYear;
  salary?: number;
  houseProperty?: number | HousePropertyIncome;
  capitalGains?: Partial<CapitalGainsIncome>;
  otherSources?: Partial<OtherSourcesIncome>;
  tds?: TDSEntry[];
  advanceTax?: number;
  selfAssessmentTax?: number;
  residentialStatus?: TaxInputs["assesseeInfo"]["residentialStatus"];
}

export function makeInputs(o: Overrides = {}): TaxInputs {
  const fy: FinancialYear = o.fy || "2025-26";
  const houseProperty: HousePropertyIncome =
    typeof o.houseProperty === "object"
      ? o.houseProperty
      : { properties: [], totalIncome: o.houseProperty || 0 };

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
    houseProperty,
    capitalGains: computeCapitalGains(o.capitalGains || {}),
    otherSources: computeOtherSources(o.otherSources || {}),
    tdsEntries: o.tds || [],
    advanceTax: o.advanceTax || 0,
    selfAssessmentTax: o.selfAssessmentTax || 0,
  };
}
