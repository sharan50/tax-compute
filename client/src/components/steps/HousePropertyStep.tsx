/**
 * HousePropertyStep — Swiss Financial Design
 * 
 * Step 03: Income from House Property.
 * Supports multiple properties (let-out, self-occupied).
 * Auto-computes 30% standard deduction and taxable income.
 */

import { useMemo } from "react";
import { useTaxForm } from "@/contexts/TaxFormContext";
import SectionHeader from "@/components/SectionHeader";
import CurrencyInput from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeHouseProperty, formatINR } from "@/lib/taxEngine";
import type { HouseProperty } from "@/lib/taxEngine";
import { Plus, Trash2 } from "lucide-react";

export default function HousePropertyStep() {
  const { state, dispatch } = useTaxForm();
  const { houseProperties } = state;

  const computedProperties = useMemo(
    () => houseProperties.map((p) => computeHouseProperty(p)),
    [houseProperties]
  );

  const totalIncome = computedProperties.reduce((sum, p) => sum + p.taxableIncome, 0);

  const updateProperty = (index: number, data: Partial<HouseProperty>) => {
    dispatch({ type: "UPDATE_PROPERTY", index, data });
  };

  return (
    <div>
      <SectionHeader
        number="03"
        title="Income from House Property"
        subtitle="Add each property you own. Standard deduction of 30% is automatically applied for let-out properties."
      />

      <div className="space-y-8 max-w-2xl">
        {houseProperties.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground text-sm mb-4">
              No properties added. Click below to add a property.
            </p>
          </div>
        )}

        {houseProperties.map((property, index) => {
          const computed = computedProperties[index];
          return (
            <div key={property.id || index} className="relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Property {index + 1}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dispatch({ type: "REMOVE_PROPERTY", index })}
                  className="text-destructive hover:text-destructive h-8"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remove
                </Button>
              </div>

              <div className="space-y-5 pl-4 border-l-2 border-border">
                <div>
                  <label className="text-sm text-muted-foreground">Property Type</label>
                  <Select
                    value={property.type || "let-out"}
                    onValueChange={(v) =>
                      updateProperty(index, { type: v as HouseProperty["type"] })
                    }
                  >
                    <SelectTrigger className="mt-1 border-0 border-b border-border rounded-none px-0 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="let-out">Let Out</SelectItem>
                      <SelectItem value="self-occupied">Self Occupied</SelectItem>
                      <SelectItem value="deemed-let-out">Deemed Let Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {property.type !== "self-occupied" && (
                  <>
                    <div>
                      <label className="text-sm text-muted-foreground">Tenant Name</label>
                      <input
                        type="text"
                        value={property.tenantName || ""}
                        onChange={(e) =>
                          updateProperty(index, { tenantName: e.target.value.toUpperCase() })
                        }
                        placeholder="TENANT NAME"
                        className="swiss-input !text-left !font-sans mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Tenant PAN</label>
                      <input
                        type="text"
                        value={property.tenantPan || ""}
                        onChange={(e) =>
                          updateProperty(index, { tenantPan: e.target.value.toUpperCase() })
                        }
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        className="swiss-input !text-left !font-mono mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Property Address</label>
                      <input
                        type="text"
                        value={property.address || ""}
                        onChange={(e) =>
                          updateProperty(index, { address: e.target.value.toUpperCase() })
                        }
                        placeholder="PROPERTY ADDRESS"
                        className="swiss-input !text-left !font-sans mt-1"
                      />
                    </div>
                    <CurrencyInput
                      label="Annual Rent Received"
                      value={property.annualRent || 0}
                      onChange={(v) => updateProperty(index, { annualRent: v })}
                    />
                    <CurrencyInput
                      label="Municipal Taxes Paid"
                      value={property.municipalTaxes || 0}
                      onChange={(v) => updateProperty(index, { municipalTaxes: v })}
                    />
                  </>
                )}

                <CurrencyInput
                  label="Interest on Home Loan"
                  value={property.interestOnLoan || 0}
                  onChange={(v) => updateProperty(index, { interestOnLoan: v })}
                  hint={property.type === "self-occupied" ? "Max ₹2,00,000" : "No limit"}
                />

                {/* Computed Summary for this property */}
                {computed && (
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                    {property.type !== "self-occupied" && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Annual Value</span>
                          <span className="font-mono tabular-nums">{formatINR(computed.annualValue)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Less: Std. Deduction (30%)</span>
                          <span className="font-mono tabular-nums">({formatINR(computed.standardDeduction)})</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-sm font-medium pt-1">
                      <span>Taxable Income</span>
                      <span className="font-mono tabular-nums text-primary">
                        {formatINR(computed.taxableIncome)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <Button
          variant="outline"
          onClick={() => dispatch({ type: "ADD_PROPERTY" })}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Property
        </Button>

        {houseProperties.length > 0 && (
          <div className="pt-6 border-t border-border">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold">Total Income from House Property</span>
              <span className="font-mono tabular-nums text-base font-semibold text-primary">
                {formatINR(totalIncome)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
