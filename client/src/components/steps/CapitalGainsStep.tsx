/**
 * CapitalGainsStep — Swiss Financial Design
 * 
 * Step 04: Capital Gains income.
 * Supports STCG and LTCG with different tax rates.
 * Shows FY-specific fields (15% STCG and 10% LTCG only for FY 2024-25).
 */

import { useMemo } from "react";
import { useTaxForm } from "@/contexts/TaxFormContext";
import SectionHeader from "@/components/SectionHeader";
import CurrencyInput from "@/components/CurrencyInput";
import { computeCapitalGains, formatINR } from "@/lib/taxEngine";

export default function CapitalGainsStep() {
  const { state, dispatch } = useTaxForm();
  const { capitalGains, assesseeInfo } = state;
  const fy = assesseeInfo.financialYear;

  const computed = useMemo(() => computeCapitalGains(capitalGains), [capitalGains]);

  const update = (field: string, value: number) => {
    dispatch({ type: "UPDATE_CAPITAL_GAINS", data: { [field]: value } });
  };

  return (
    <div>
      <SectionHeader
        number="04"
        title="Capital Gains"
        subtitle="Enter capital gains from sale of securities, property, and other assets. Amounts should be net gains (sale price minus cost)."
      />

      <div className="space-y-10 max-w-2xl">
        {/* Short Term Capital Gains */}
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
            Short Term Capital Gains
          </h3>
          <div className="space-y-5 pl-4 border-l-2 border-amber-200">
            <CurrencyInput
              label="STCG on Listed Securities @ 20% (u/s 111A, STT paid)"
              hint="Post-23 July 2024"
              value={capitalGains.stcg111A_20 || 0}
              onChange={(v) => update("stcg111A_20", v)}
            />
            {fy === "2024-25" && (
              <CurrencyInput
                label="STCG on Listed Securities @ 15% (u/s 111A, STT paid)"
                hint="Pre-23 July 2024"
                value={capitalGains.stcg111A_15 || 0}
                onChange={(v) => update("stcg111A_15", v)}
              />
            )}
            <CurrencyInput
              label="STCG on Other Assets (at slab rate)"
              hint="Non-STT paid / unlisted"
              value={capitalGains.stcgOther || 0}
              onChange={(v) => update("stcgOther", v)}
            />
            <div className="flex justify-between items-baseline pt-3 border-t border-border/50">
              <span className="text-sm font-medium">Total STCG</span>
              <span className="font-mono tabular-nums font-medium">{formatINR(computed.totalSTCG)}</span>
            </div>
          </div>
        </div>

        {/* Long Term Capital Gains */}
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
            Long Term Capital Gains
          </h3>
          <div className="space-y-5 pl-4 border-l-2 border-emerald-200">
            <CurrencyInput
              label="LTCG on Listed Securities @ 12.5% (u/s 112A, STT paid)"
              hint={`Exemption of ₹1,25,000 applied automatically`}
              value={capitalGains.ltcg112A_125 || 0}
              onChange={(v) => update("ltcg112A_125", v)}
            />
            {fy === "2024-25" && (
              <CurrencyInput
                label="LTCG on Listed Securities @ 10% (u/s 112A)"
                hint="Pre-23 July 2024 / Grandfathered"
                value={capitalGains.ltcg112A_10 || 0}
                onChange={(v) => update("ltcg112A_10", v)}
              />
            )}
            <CurrencyInput
              label="LTCG on Other Assets @ 12.5%"
              hint="Property, unlisted shares, etc."
              value={capitalGains.ltcgOther || 0}
              onChange={(v) => update("ltcgOther", v)}
            />
            <div className="flex justify-between items-baseline pt-3 border-t border-border/50">
              <span className="text-sm font-medium">Total LTCG</span>
              <span className="font-mono tabular-nums font-medium">{formatINR(computed.totalLTCG)}</span>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="pt-6 border-t border-border">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold">Total Capital Gains</span>
            <span className="font-mono tabular-nums text-base font-semibold text-primary">
              {formatINR(computed.totalCapitalGains)}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 bg-muted/50 rounded-sm">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Note:</span> Enter the total net capital gain for each category. 
            You can get these figures from your broker's annual capital gains statement or your CA's working.
            {fy === "2024-25" && (
              <span className="block mt-2">
                For FY 2024-25, gains before 23 July 2024 are taxed at old rates (15% STCG, 10% LTCG) 
                and gains after that date at new rates (20% STCG, 12.5% LTCG).
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
