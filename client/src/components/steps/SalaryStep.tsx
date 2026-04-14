/**
 * SalaryStep — Swiss Financial Design
 * 
 * Step 02: Salary income breakdown.
 * Auto-computes gross salary and standard deduction.
 */

import { useMemo } from "react";
import { useTaxForm } from "@/contexts/TaxFormContext";
import SectionHeader from "@/components/SectionHeader";
import CurrencyInput from "@/components/CurrencyInput";
import { computeSalary, formatINR } from "@/lib/taxEngine";

export default function SalaryStep() {
  const { state, dispatch } = useTaxForm();
  const { salary, assesseeInfo } = state;

  const computed = useMemo(
    () => computeSalary(salary, assesseeInfo.financialYear),
    [salary, assesseeInfo.financialYear]
  );

  const update = (field: string, value: number) => {
    dispatch({ type: "UPDATE_SALARY", data: { [field]: value } });
  };

  return (
    <div>
      <SectionHeader
        number="02"
        title="Income from Salary"
        subtitle="Enter salary components as per Form 16. Leave blank if not applicable."
      />

      <div className="space-y-5 max-w-2xl">
        <CurrencyInput
          label="Basic Salary"
          value={salary.basicSalary || 0}
          onChange={(v) => update("basicSalary", v)}
        />
        <CurrencyInput
          label="House Rent Allowance (HRA)"
          hint="Not deductible in New Regime"
          value={salary.hra || 0}
          onChange={(v) => update("hra", v)}
        />
        <CurrencyInput
          label="Special Allowance"
          value={salary.specialAllowance || 0}
          onChange={(v) => update("specialAllowance", v)}
        />
        <CurrencyInput
          label="Other Allowances"
          value={salary.otherAllowances || 0}
          onChange={(v) => update("otherAllowances", v)}
        />
        <CurrencyInput
          label="Perquisites (u/s 17(2))"
          value={salary.perquisites || 0}
          onChange={(v) => update("perquisites", v)}
        />
        <CurrencyInput
          label="Profits in lieu of Salary (u/s 17(3))"
          value={salary.profitsInLieu || 0}
          onChange={(v) => update("profitsInLieu", v)}
        />

        {/* Computed Summary */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-medium">Gross Salary</span>
              <span className="font-mono tabular-nums text-base">
                {formatINR(computed.grossSalary)}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-muted-foreground">
              <span className="text-sm">Less: Standard Deduction (u/s 16)</span>
              <span className="font-mono tabular-nums text-sm">
                ({formatINR(computed.standardDeduction)})
              </span>
            </div>
            <div className="hairline-dark" />
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold">Net Salary Income</span>
              <span className="font-mono tabular-nums text-base font-semibold text-primary">
                {formatINR(computed.netSalary)}
              </span>
            </div>
          </div>
        </div>

        {computed.grossSalary === 0 && (
          <div className="mt-4 p-4 bg-muted/50 rounded-sm">
            <p className="text-sm text-muted-foreground">
              No salary income? Skip this section and proceed to the next step.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
