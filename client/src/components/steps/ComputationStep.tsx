/**
 * ComputationStep — Swiss Financial Design
 * 
 * Step 07: Final tax computation output.
 * Mirrors the format of a CA's computation sheet.
 * Full-width, dense, tabular layout.
 */

import { useTaxForm } from "@/contexts/TaxFormContext";
import SectionHeader from "@/components/SectionHeader";
import { formatINR } from "@/lib/taxEngine";
import { Button } from "@/components/ui/button";
import { FileDown, RotateCcw } from "lucide-react";

function Row({
  label,
  amount,
  indent = 0,
  bold = false,
  accent = false,
  negative = false,
  muted = false,
  border = false,
  doubleBorder = false,
}: {
  label: string;
  amount: number | string;
  indent?: number;
  bold?: boolean;
  accent?: boolean;
  negative?: boolean;
  muted?: boolean;
  border?: boolean;
  doubleBorder?: boolean;
}) {
  const displayAmount = typeof amount === "string" ? amount : formatINR(amount as number);
  return (
    <div
      className={`flex justify-between items-baseline py-1.5 ${
        border ? "border-t border-border" : ""
      } ${doubleBorder ? "border-t-2 border-foreground" : ""}`}
      style={{ paddingLeft: `${indent * 20}px` }}
    >
      <span
        className={`text-sm ${bold ? "font-semibold" : ""} ${
          muted ? "text-muted-foreground" : ""
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono tabular-nums text-sm ${bold ? "font-semibold" : ""} ${
          accent ? "text-primary font-semibold" : ""
        } ${negative ? "text-destructive" : ""}`}
      >
        {negative && typeof amount === "number" && amount > 0 ? `(${displayAmount})` : displayAmount}
      </span>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mt-6 mb-2">
      <h4 className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h4>
    </div>
  );
}

export default function ComputationStep() {
  const { state, runComputation, goToStep, dispatch } = useTaxForm();
  const { computation, assesseeInfo } = state;

  if (!computation) {
    return (
      <div>
        <SectionHeader
          number="07"
          title="Tax Computation"
          subtitle="Review your entries and compute your tax liability."
        />
        <div className="max-w-2xl text-center py-16">
          <p className="text-muted-foreground mb-6">
            Click the button below to compute your tax liability based on the information you've entered.
          </p>
          <Button onClick={runComputation} size="lg" className="font-display">
            Compute Tax
          </Button>
        </div>
      </div>
    );
  }

  const c = computation;
  const fy = assesseeInfo.financialYear;
  const ay = fy === "2025-26" ? "2026-27" : "2025-26";

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    dispatch({ type: "RESET" });
  };

  return (
    <div>
      <SectionHeader
        number="07"
        title="Tax Computation"
        subtitle={`Final computation for FY ${fy} (AY ${ay}) under the New Tax Regime (Section 115BAC)`}
      />

      {/* Action Buttons */}
      <div className="flex gap-3 mb-8 print:hidden">
        <Button onClick={handlePrint} variant="outline" size="sm">
          <FileDown className="w-3.5 h-3.5 mr-1.5" />
          Print / Save PDF
        </Button>
        <Button onClick={runComputation} variant="outline" size="sm">
          Recompute
        </Button>
        <Button onClick={handleReset} variant="ghost" size="sm" className="text-destructive">
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Start Over
        </Button>
      </div>

      {/* Computation Sheet */}
      <div className="max-w-3xl" id="computation-sheet">
        {/* Header */}
        <div className="text-center mb-8 pb-6 border-b-2 border-foreground print:mb-4">
          <h3 className="font-display text-lg font-bold tracking-tight uppercase">
            Computation of Total Income
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {assesseeInfo.name && `${assesseeInfo.name} · `}
            {assesseeInfo.pan && `PAN: ${assesseeInfo.pan} · `}
            FY {fy} (AY {ay}) · New Regime u/s 115BAC
          </p>
        </div>

        {/* Income Summary */}
        <SectionTitle title="Computation of Total Income" />
        
        {c.salaryIncome > 0 && (
          <Row label="Income from Salary (after Std. Deduction)" amount={c.salaryIncome} />
        )}
        {c.housePropertyIncome !== 0 && (
          <Row label="Income from House Property" amount={c.housePropertyIncome} />
        )}
        {c.capitalGainsIncome > 0 && (
          <Row label="Capital Gains" amount={c.capitalGainsIncome} />
        )}
        {c.otherSourcesIncome > 0 && (
          <Row label="Income from Other Sources" amount={c.otherSourcesIncome} />
        )}
        
        <Row label="Gross Total Income" amount={c.grossTotalIncome} bold border />
        
        {c.totalDeductions > 0 && (
          <>
            <Row label="Less: Deductions" amount={c.totalDeductions} negative indent={1} />
          </>
        )}
        
        <Row label="Total Income" amount={c.totalIncome} bold accent border />
        <Row label="Total Income (Rounded off u/s 288A)" amount={c.totalIncomeRounded} muted />

        {/* Tax Computation */}
        <SectionTitle title="Computation of Tax on Total Income" />
        
        <div className="mb-1">
          <span className="text-xs text-muted-foreground font-mono">
            Tax on Normal Income (₹{formatINR(c.normalIncome)})
          </span>
        </div>
        
        {c.slabComputation.map((slab, i) => (
          <Row
            key={i}
            label={`₹${formatINR(slab.from)} – ₹${formatINR(slab.to)} @ ${(slab.rate * 100).toFixed(0)}%`}
            amount={slab.tax}
            indent={1}
            muted={slab.rate === 0}
          />
        ))}
        
        <Row label="Tax on Normal Income" amount={c.taxOnNormalIncome} bold border />

        {/* Special Rate Taxes */}
        {(c.taxOnSTCG111A_20 > 0 || c.taxOnSTCG111A_15 > 0 || c.taxOnLTCG112A_125 > 0 || c.taxOnLTCG112A_10 > 0) && (
          <>
            <SectionTitle title="Tax on Special Rate Income" />
            {c.taxOnSTCG111A_20 > 0 && (
              <Row label="STCG u/s 111A @ 20%" amount={c.taxOnSTCG111A_20} indent={1} />
            )}
            {c.taxOnSTCG111A_15 > 0 && (
              <Row label="STCG u/s 111A @ 15%" amount={c.taxOnSTCG111A_15} indent={1} />
            )}
            {c.taxOnLTCG112A_125 > 0 && (
              <Row label="LTCG u/s 112A @ 12.5%" amount={c.taxOnLTCG112A_125} indent={1} />
            )}
            {c.taxOnLTCG112A_10 > 0 && (
              <Row label="LTCG u/s 112A @ 10%" amount={c.taxOnLTCG112A_10} indent={1} />
            )}
          </>
        )}

        <Row label="Total Tax before Rebate" amount={c.totalTaxBeforeSurcharge} bold border />

        {/* Rebate */}
        {c.rebate87A > 0 && (
          <Row label="Less: Rebate u/s 87A" amount={c.rebate87A} negative indent={1} />
        )}
        
        {c.rebate87A > 0 && (
          <Row label="Tax after Rebate" amount={c.taxAfterRebate} border />
        )}

        {/* Surcharge */}
        {c.surchargeAmount > 0 && (
          <Row
            label={`Add: Surcharge @ ${(c.surchargeRate * 100).toFixed(0)}%`}
            amount={c.surchargeAmount}
            indent={1}
          />
        )}
        
        {c.surchargeAmount > 0 && (
          <Row label="Tax after Surcharge" amount={c.taxAfterSurcharge} border />
        )}

        {/* Cess */}
        <Row
          label="Add: Health & Education Cess @ 4%"
          amount={c.cessAmount}
          indent={1}
        />
        
        <Row label="Gross Tax Liability" amount={c.grossTaxLiability} bold accent doubleBorder />

        {/* TDS & Taxes Paid */}
        <SectionTitle title="Less: Taxes Already Paid" />
        
        {c.totalTDS > 0 && (
          <Row label="TDS Deducted at Source" amount={c.totalTDS} negative indent={1} />
        )}
        {c.totalAdvanceTax > 0 && (
          <Row label="Advance Tax Paid" amount={c.totalAdvanceTax} negative indent={1} />
        )}
        {c.totalSelfAssessmentTax > 0 && (
          <Row label="Self-Assessment Tax Paid" amount={c.totalSelfAssessmentTax} negative indent={1} />
        )}
        
        <Row label="Total Taxes Paid" amount={c.totalTaxesPaid} bold negative border />

        {/* Final Result */}
        <div className="mt-6 pt-4 border-t-2 border-foreground">
          {c.netTaxPayable > 0 ? (
            <div className="flex justify-between items-baseline">
              <span className="font-display text-base font-bold">Tax Payable</span>
              <span className="font-mono tabular-nums text-xl font-bold text-destructive">
                ₹{formatINR(c.netTaxPayable)}
              </span>
            </div>
          ) : c.refundDue > 0 ? (
            <div className="flex justify-between items-baseline">
              <span className="font-display text-base font-bold">Refund Due</span>
              <span className="font-mono tabular-nums text-xl font-bold text-success">
                ₹{formatINR(c.refundDue)}
              </span>
            </div>
          ) : (
            <div className="flex justify-between items-baseline">
              <span className="font-display text-base font-bold">Tax Payable</span>
              <span className="font-mono tabular-nums text-xl font-bold">NIL</span>
            </div>
          )}
          <div className="mt-1">
            <span className="text-xs text-muted-foreground font-mono">
              (Rounded off u/s 288B)
            </span>
          </div>
        </div>

        {/* Edit Links */}
        <div className="mt-10 pt-6 border-t border-border print:hidden">
          <p className="text-sm text-muted-foreground mb-3">
            Need to make changes? Click on any section in the sidebar to edit.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Assessee", "Salary", "House Property", "Capital Gains", "Other Sources", "TDS"].map(
              (label, i) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  onClick={() => goToStep(i + 1)}
                  className="text-xs"
                >
                  Edit {label}
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
