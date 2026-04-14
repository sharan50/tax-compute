/**
 * TDSStep — Swiss Financial Design
 * 
 * Step 06: TDS deducted and advance tax / self-assessment tax paid.
 * Dynamic list of TDS entries with section codes.
 */

import { useTaxForm } from "@/contexts/TaxFormContext";
import SectionHeader from "@/components/SectionHeader";
import CurrencyInput from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR } from "@/lib/taxEngine";
import type { TDSEntry } from "@/lib/taxEngine";
import { Plus, Trash2 } from "lucide-react";

const TDS_SECTIONS = [
  { value: "192", label: "Sec 192 — Salary" },
  { value: "193", label: "Sec 193 — Interest on Securities" },
  { value: "194", label: "Sec 194 — Dividends" },
  { value: "194A", label: "Sec 194A — Interest (other than securities)" },
  { value: "194DA", label: "Sec 194DA — Life Insurance Policy" },
  { value: "194I(B)", label: "Sec 194I(B) — Rent" },
  { value: "194I(A)", label: "Sec 194I(A) — Rent (P&M)" },
  { value: "194J", label: "Sec 194J — Professional Fees" },
  { value: "194H", label: "Sec 194H — Commission" },
  { value: "194N", label: "Sec 194N — Cash Withdrawal" },
  { value: "206CL", label: "Sec 206CL — TCS" },
  { value: "206C(1H)", label: "Sec 206C(1H) — TCS on Sale" },
  { value: "other", label: "Other Section" },
];

export default function TDSStep() {
  const { state, dispatch } = useTaxForm();
  const { tdsEntries, advanceTax, selfAssessmentTax } = state;

  const totalTDS = tdsEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = totalTDS + advanceTax + selfAssessmentTax;

  const addEntry = () => {
    dispatch({
      type: "ADD_TDS_ENTRY",
      entry: { section: "192", description: "", amount: 0 },
    });
  };

  const updateEntry = (index: number, data: Partial<TDSEntry>) => {
    dispatch({ type: "UPDATE_TDS_ENTRY", index, entry: data });
  };

  return (
    <div>
      <SectionHeader
        number="06"
        title="TDS & Taxes Paid"
        subtitle="Enter TDS deducted at source (from Form 26AS / AIS), advance tax, and self-assessment tax paid."
      />

      <div className="space-y-8 max-w-2xl">
        {/* TDS Entries */}
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
            Tax Deducted at Source (TDS)
          </h3>

          {tdsEntries.length === 0 && (
            <p className="text-sm text-muted-foreground mb-4">
              No TDS entries. Click below to add.
            </p>
          )}

          <div className="space-y-4">
            {tdsEntries.map((entry, index) => (
              <div key={index} className="flex items-end gap-3 pl-4 border-l-2 border-border">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Section</label>
                  <Select
                    value={entry.section}
                    onValueChange={(v) => updateEntry(index, { section: v })}
                  >
                    <SelectTrigger className="mt-0.5 border-0 border-b border-border rounded-none px-0 font-mono text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TDS_SECTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <CurrencyInput
                    label="Amount"
                    value={entry.amount}
                    onChange={(v) => updateEntry(index, { amount: v })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dispatch({ type: "REMOVE_TDS_ENTRY", index })}
                  className="text-destructive hover:text-destructive h-9 px-2 mb-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addEntry}
            className="mt-4 border-dashed"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add TDS Entry
          </Button>

          {tdsEntries.length > 0 && (
            <div className="flex justify-between items-baseline mt-4 pt-3 border-t border-border/50">
              <span className="text-sm font-medium">Total TDS</span>
              <span className="font-mono tabular-nums font-medium">{formatINR(totalTDS)}</span>
            </div>
          )}
        </div>

        {/* Advance Tax */}
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
            Advance Tax & Self-Assessment Tax
          </h3>
          <div className="space-y-5">
            <CurrencyInput
              label="Advance Tax Paid"
              value={advanceTax}
              onChange={(v) => dispatch({ type: "SET_ADVANCE_TAX", amount: v })}
            />
            <CurrencyInput
              label="Self-Assessment Tax Paid"
              value={selfAssessmentTax}
              onChange={(v) => dispatch({ type: "SET_SELF_ASSESSMENT_TAX", amount: v })}
            />
          </div>
        </div>

        {/* Total */}
        <div className="pt-6 border-t border-border">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold">Total Taxes Already Paid</span>
            <span className="font-mono tabular-nums text-base font-semibold text-primary">
              {formatINR(totalPaid)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
