/**
 * Tax Form Context — Swiss Financial Design
 * 
 * Central state management for the multi-step tax computation form.
 * Handles all income head data, step navigation, and computation trigger.
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo } from "react";
import type { HousePropertyIncome, TaxInputs } from "@/lib/taxEngine";
import type { TaxFormState, Action } from "./taxFormReducer";
import { reducer, initialState } from "./taxFormReducer";
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

export type { TaxFormState, Action } from "./taxFormReducer";
export { reducer, initialState } from "./taxFormReducer";

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
