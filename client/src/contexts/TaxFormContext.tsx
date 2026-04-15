/**
 * Tax Form Context — Swiss Financial Design
 * 
 * Central state management for the multi-step tax computation form.
 * Handles all income head data, step navigation, and computation trigger.
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo } from "react";
import type {
  AssesseeInfo,
  SalaryIncome,
  HousePropertyIncome,
  HouseProperty,
  CapitalGainsIncome,
  OtherSourcesIncome,
  TDSEntry,
  TaxInputs,
  TaxComputation,
  FinancialYear,
} from "@/lib/taxEngine";
import {
  computeTax,
  computeSalary,
  computeHouseProperty,
  computeCapitalGains,
  computeOtherSources,
} from "@/lib/taxEngine";

// ─── Steps ───────────────────────────────────────────────────────────

export const STEPS = [
  { id: "import", label: "Import Statement", number: "00" },
  { id: "assessee", label: "Assessee Details", number: "01" },
  { id: "salary", label: "Salary Income", number: "02" },
  { id: "house-property", label: "House Property", number: "03" },
  { id: "capital-gains", label: "Capital Gains", number: "04" },
  { id: "other-sources", label: "Other Sources", number: "05" },
  { id: "tds-taxes", label: "TDS & Taxes Paid", number: "06" },
  { id: "computation", label: "Tax Computation", number: "07" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

// ─── State ───────────────────────────────────────────────────────────

interface TaxFormState {
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

const initialState: TaxFormState = {
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

type Action =
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

function reducer(state: TaxFormState, action: Action): TaxFormState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "UPDATE_ASSESSEE":
      return { ...state, assesseeInfo: { ...state.assesseeInfo, ...action.data } };
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

// ─── Context ─────────────────────────────────────────────────────────

interface TaxFormContextValue {
  state: TaxFormState;
  dispatch: React.Dispatch<Action>;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  runComputation: () => void;
}

const TaxFormContext = createContext<TaxFormContextValue | null>(null);

export function TaxFormProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const goToStep = useCallback((step: number) => {
    dispatch({ type: "SET_STEP", step: Math.max(0, Math.min(step, STEPS.length - 1)) });
  }, []);

  const nextStep = useCallback(() => {
    dispatch({ type: "SET_STEP", step: Math.min(state.currentStep + 1, STEPS.length - 1) });
  }, [state.currentStep]);

  const prevStep = useCallback(() => {
    dispatch({ type: "SET_STEP", step: Math.max(state.currentStep - 1, 0) });
  }, [state.currentStep]);

  const runComputation = useCallback(() => {
    const fy = state.assesseeInfo.financialYear;
    
    // Build computed salary
    const salary = computeSalary(state.salary, fy);
    
    // Build computed house properties
    const properties = state.houseProperties.map((p) => computeHouseProperty(p));
    const houseProperty: HousePropertyIncome = {
      properties,
      totalIncome: properties.reduce((sum, p) => sum + p.taxableIncome, 0),
    };
    
    // Build computed capital gains
    const capitalGains = computeCapitalGains(state.capitalGains);
    
    // Build computed other sources
    const otherSources = computeOtherSources(state.otherSources);
    
    const inputs: TaxInputs = {
      assesseeInfo: state.assesseeInfo,
      salary,
      houseProperty,
      capitalGains,
      otherSources,
      tdsEntries: state.tdsEntries,
      advanceTax: state.advanceTax,
      selfAssessmentTax: state.selfAssessmentTax,
    };
    
    const computation = computeTax(inputs);
    dispatch({ type: "SET_COMPUTATION", computation });
    dispatch({ type: "SET_STEP", step: STEPS.length - 1 });
  }, [state]);

  const value = useMemo(
    () => ({ state, dispatch, goToStep, nextStep, prevStep, runComputation }),
    [state, dispatch, goToStep, nextStep, prevStep, runComputation]
  );

  return (
    <TaxFormContext.Provider value={value}>
      {children}
    </TaxFormContext.Provider>
  );
}

export function useTaxForm() {
  const ctx = useContext(TaxFormContext);
  if (!ctx) throw new Error("useTaxForm must be used within TaxFormProvider");
  return ctx;
}
