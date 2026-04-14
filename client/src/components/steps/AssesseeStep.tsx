/**
 * AssesseeStep — Swiss Financial Design
 * 
 * Step 01: Assessee personal details and FY selection.
 * Clean form with bottom-border inputs.
 */

import { useTaxForm } from "@/contexts/TaxFormContext";
import SectionHeader from "@/components/SectionHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FinancialYear, ResidentialStatus } from "@/lib/taxEngine";

export default function AssesseeStep() {
  const { state, dispatch } = useTaxForm();
  const { assesseeInfo } = state;

  const update = (data: Record<string, string>) => {
    dispatch({ type: "UPDATE_ASSESSEE", data });
  };

  return (
    <div>
      <SectionHeader
        number="01"
        title="Assessee Details"
        subtitle="Personal information and assessment year selection. All fields are optional except Financial Year."
      />

      <div className="space-y-8 max-w-2xl">
        {/* Financial Year Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-muted-foreground">Financial Year</label>
            <Select
              value={assesseeInfo.financialYear}
              onValueChange={(v) => update({ financialYear: v as FinancialYear })}
            >
              <SelectTrigger className="mt-1 border-0 border-b border-border rounded-none px-0 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025-26">FY 2025-26 (AY 2026-27)</SelectItem>
                <SelectItem value="2024-25">FY 2024-25 (AY 2025-26)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Residential Status</label>
            <Select
              value={assesseeInfo.residentialStatus}
              onValueChange={(v) => update({ residentialStatus: v as ResidentialStatus })}
            >
              <SelectTrigger className="mt-1 border-0 border-b border-border rounded-none px-0 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resident">Resident Individual</SelectItem>
                <SelectItem value="resident-senior">Resident Senior Citizen (60-80)</SelectItem>
                <SelectItem value="resident-super-senior">Resident Super Senior (80+)</SelectItem>
                <SelectItem value="nri">Non-Resident</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Personal Details */}
        <div className="space-y-5">
          <div>
            <label className="text-sm text-muted-foreground">Name of Assessee</label>
            <input
              type="text"
              value={assesseeInfo.name}
              onChange={(e) => update({ name: e.target.value.toUpperCase() })}
              placeholder="FULL NAME AS PER PAN"
              className="swiss-input !text-left !font-sans mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-muted-foreground">PAN</label>
              <input
                type="text"
                value={assesseeInfo.pan}
                onChange={(e) => update({ pan: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                maxLength={10}
                className="swiss-input !text-left !font-mono mt-1 uppercase"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Date of Birth</label>
              <input
                type="date"
                value={assesseeInfo.dob}
                onChange={(e) => update({ dob: e.target.value })}
                className="swiss-input !text-left !font-mono mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-muted-foreground">Father's Name</label>
              <input
                type="text"
                value={assesseeInfo.fatherName}
                onChange={(e) => update({ fatherName: e.target.value.toUpperCase() })}
                placeholder="FATHER'S NAME"
                className="swiss-input !text-left !font-sans mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Gender</label>
              <Select
                value={assesseeInfo.gender}
                onValueChange={(v) => update({ gender: v })}
              >
                <SelectTrigger className="mt-1 border-0 border-b border-border rounded-none px-0 font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Address</label>
            <input
              type="text"
              value={assesseeInfo.address}
              onChange={(e) => update({ address: e.target.value.toUpperCase() })}
              placeholder="FULL ADDRESS"
              className="swiss-input !text-left !font-sans mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-muted-foreground">Email</label>
              <input
                type="email"
                value={assesseeInfo.email}
                onChange={(e) => update({ email: e.target.value })}
                placeholder="email@example.com"
                className="swiss-input !text-left !font-sans mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Phone</label>
              <input
                type="tel"
                value={assesseeInfo.phone}
                onChange={(e) => update({ phone: e.target.value })}
                placeholder="+91 XXXXXXXXXX"
                className="swiss-input !text-left !font-mono mt-1"
              />
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-teal-light/30 border border-teal/10 rounded-sm">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">New Tax Regime (Section 115BAC)</span> — 
            This tool computes tax under the New Regime which is the default regime from FY 2023-24 onwards. 
            Most deductions under Chapter VI-A are not available under this regime.
          </p>
        </div>
      </div>
    </div>
  );
}
