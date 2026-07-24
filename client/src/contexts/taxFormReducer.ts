/**
 * Tax form state, actions and reducer.
 *
 * Kept free of React so the state transitions can be tested directly — some of
 * them (like clearing year-specific capital gains buckets) are correctness
 * concerns the tax engine cannot see.
 */

import type {
  AssesseeInfo,
  SalaryIncome,
  HouseProperty,
  CapitalGainsIncome,
  OtherSourcesIncome,
  TDSEntry,
  TaxComputation,
} from "@/lib/taxEngine";

export interface TaxFormState {
  currentStep: number;
  assesseeInfo: AssesseeInfo;
  salary: Partial<SalaryIncome>;
  houseProperties: Partial<HouseProperty>[];
  capitalGains: Partial<CapitalGainsIncome>;
  otherSources: Partial<OtherSourcesIncome>;
  tdsEntries: TDSEntry[];
  advanceTax: number;
  selfAssessmentTax: number;
  computation: TaxComputation | null;
}

const defaultAssesseeInfo: AssesseeInfo = {
  name: "",
  pan: "",
  fatherName: "",
  dob: "",
  gender: "male",
  residentialStatus: "resident",
  address: "",
  email: "",
  phone: "",
  financialYear: "2025-26",
};

export const initialState: TaxFormState = {
  currentStep: 0,
  assesseeInfo: defaultAssesseeInfo,
  salary: {},
  houseProperties: [],
  capitalGains: {},
  otherSources: {},
  tdsEntries: [],
  advanceTax: 0,
  selfAssessmentTax: 0,
  computation: null,
};

// ─── Actions ─────────────────────────────────────────────────────────

export type Action =
  | { type: "SET_STEP"; step: number }
  | { type: "UPDATE_ASSESSEE"; data: Partial<AssesseeInfo> }
  | { type: "UPDATE_SALARY"; data: Partial<SalaryIncome> }
  | { type: "ADD_PROPERTY" }
  | { type: "UPDATE_PROPERTY"; index: number; data: Partial<HouseProperty> }
  | { type: "REMOVE_PROPERTY"; index: number }
  | { type: "UPDATE_CAPITAL_GAINS"; data: Partial<CapitalGainsIncome> }
  | { type: "UPDATE_OTHER_SOURCES"; data: Partial<OtherSourcesIncome> }
  | { type: "ADD_TDS_ENTRY"; entry: TDSEntry }
  | { type: "UPDATE_TDS_ENTRY"; index: number; entry: Partial<TDSEntry> }
  | { type: "REMOVE_TDS_ENTRY"; index: number }
  | { type: "SET_ADVANCE_TAX"; amount: number }
  | { type: "SET_SELF_ASSESSMENT_TAX"; amount: number }
  | { type: "SET_COMPUTATION"; computation: TaxComputation }
  | { type: "RESET" };

/** Capital gains buckets that only exist for FY 2024-25 (pre-23 July 2024). */
const FY_2024_25_ONLY_CG_FIELDS = ["stcg111A_15", "ltcg112A_10", "ltcgOther_20"] as const;

export function reducer(state: TaxFormState, action: Action): TaxFormState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "UPDATE_ASSESSEE": {
      const assesseeInfo = { ...state.assesseeInfo, ...action.data };

      // The pre-23-July-2024 buckets are only rendered for FY 2024-25. Without
      // clearing them on a year change, a figure entered under FY 2024-25 stays
      // in state and keeps being taxed under FY 2025-26 through inputs the user
      // can no longer see.
      const leftFY2024_25 =
        state.assesseeInfo.financialYear === "2024-25" &&
        assesseeInfo.financialYear !== "2024-25";

      if (!leftFY2024_25) return { ...state, assesseeInfo };

      const capitalGains = { ...state.capitalGains };
      for (const field of FY_2024_25_ONLY_CG_FIELDS) delete capitalGains[field];
      return { ...state, assesseeInfo, capitalGains };
    }
    case "UPDATE_SALARY":
      return { ...state, salary: { ...state.salary, ...action.data } };
    case "ADD_PROPERTY":
      return {
        ...state,
        houseProperties: [
          ...state.houseProperties,
          { id: crypto.randomUUID(), type: "let-out" },
        ],
      };
    case "UPDATE_PROPERTY":
      return {
        ...state,
        houseProperties: state.houseProperties.map((p, i) =>
          i === action.index ? { ...p, ...action.data } : p
        ),
      };
    case "REMOVE_PROPERTY":
      return {
        ...state,
        houseProperties: state.houseProperties.filter((_, i) => i !== action.index),
      };
    case "UPDATE_CAPITAL_GAINS":
      return { ...state, capitalGains: { ...state.capitalGains, ...action.data } };
    case "UPDATE_OTHER_SOURCES":
      return { ...state, otherSources: { ...state.otherSources, ...action.data } };
    case "ADD_TDS_ENTRY":
      return { ...state, tdsEntries: [...state.tdsEntries, action.entry] };
    case "UPDATE_TDS_ENTRY":
      return {
        ...state,
        tdsEntries: state.tdsEntries.map((e, i) =>
          i === action.index ? { ...e, ...action.entry } : e
        ),
      };
    case "REMOVE_TDS_ENTRY":
      return {
        ...state,
        tdsEntries: state.tdsEntries.filter((_, i) => i !== action.index),
      };
    case "SET_ADVANCE_TAX":
      return { ...state, advanceTax: action.amount };
    case "SET_SELF_ASSESSMENT_TAX":
      return { ...state, selfAssessmentTax: action.amount };
    case "SET_COMPUTATION":
      return { ...state, computation: action.computation };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}
