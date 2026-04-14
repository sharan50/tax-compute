/**
 * OtherSourcesStep — Swiss Financial Design
 * 
 * Step 05: Income from Other Sources.
 * Interest, dividends, family pension, etc.
 */

import { useMemo } from "react";
import { useTaxForm } from "@/contexts/TaxFormContext";
import SectionHeader from "@/components/SectionHeader";
import CurrencyInput from "@/components/CurrencyInput";
import { computeOtherSources, formatINR } from "@/lib/taxEngine";

export default function OtherSourcesStep() {
  const { state, dispatch } = useTaxForm();
  const { otherSources } = state;

  const computed = useMemo(() => computeOtherSources(otherSources), [otherSources]);

  const update = (field: string, value: number) => {
    dispatch({ type: "UPDATE_OTHER_SOURCES", data: { [field]: value } });
  };

  return (
    <div>
      <SectionHeader
        number="05"
        title="Income from Other Sources"
        subtitle="Interest income, dividends, family pension, and other miscellaneous income."
      />

      <div className="space-y-5 max-w-2xl">
        <CurrencyInput
          label="Interest from Savings Bank Account"
          value={otherSources.savingsBankInterest || 0}
          onChange={(v) => update("savingsBankInterest", v)}
        />
        <CurrencyInput
          label="Interest from Fixed Deposits"
          value={otherSources.fdInterest || 0}
          onChange={(v) => update("fdInterest", v)}
        />
        <CurrencyInput
          label="Interest from Post Office"
          value={otherSources.postOfficeInterest || 0}
          onChange={(v) => update("postOfficeInterest", v)}
        />
        <CurrencyInput
          label="Dividend Income"
          hint="From shares, mutual funds, etc."
          value={otherSources.dividendIncome || 0}
          onChange={(v) => update("dividendIncome", v)}
        />
        <CurrencyInput
          label="Interest on Securities"
          value={otherSources.interestOnSecurities || 0}
          onChange={(v) => update("interestOnSecurities", v)}
        />
        <CurrencyInput
          label="Family Pension"
          hint="Deduction of 1/3 or ₹15,000 (whichever is less) applied automatically"
          value={otherSources.familyPension || 0}
          onChange={(v) => update("familyPension", v)}
        />
        <CurrencyInput
          label="Other Income"
          hint="Any other taxable income"
          value={otherSources.otherIncome || 0}
          onChange={(v) => update("otherIncome", v)}
        />

        {/* Total */}
        <div className="pt-6 border-t border-border">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold">Total Income from Other Sources</span>
            <span className="font-mono tabular-nums text-base font-semibold text-primary">
              {formatINR(computed.totalIncome)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
