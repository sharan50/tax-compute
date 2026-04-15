/**
 * ImportStep — Swiss Financial Design
 * 
 * Step 00 (optional): Import bank statement Excel file.
 * Parses the file, shows categorised summary, lets user
 * confirm/reclassify, then auto-populates the form.
 */

import { useState, useCallback, useRef } from "react";
import { useTaxForm } from "@/contexts/TaxFormContext";
import SectionHeader from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import {
  parseStatement,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type StatementSummary,
  type ParsedTransaction,
  type TransactionCategory,
} from "@/lib/statementParser";
import { formatINR } from "@/lib/taxEngine";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Loader2,
  X,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

type ImportPhase = "upload" | "parsing" | "review" | "done";

export default function ImportStep() {
  const { dispatch, nextStep } = useTaxForm();
  const [phase, setPhase] = useState<ImportPhase>("upload");
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setPhase("parsing");

    try {
      const result = await parseStatement(file);
      setSummary(result);
      setPhase("review");
      toast.success(`Parsed ${result.transactions.length} transactions from ${result.bankName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setPhase("upload");
      toast.error("Failed to parse statement");
    }
  }, []);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleApply = useCallback(() => {
    if (!summary) return;
    const ts = summary.taxSummary;

    // Auto-populate salary
    if (ts.totalSalary > 0) {
      dispatch({
        type: "UPDATE_SALARY",
        data: {
          basicSalary: Math.round(ts.totalSalary),
          hra: 0,
          specialAllowance: 0,
          otherAllowances: 0,
          perquisites: 0,
          profitsInLieu: 0,
        },
      });
    }

    // Auto-populate other sources — bank interest
    if (ts.totalBankInterest > 0 || ts.totalFDInterest > 0 || ts.totalDividends > 0) {
      dispatch({
        type: "UPDATE_OTHER_SOURCES",
        data: {
          savingsBankInterest: Math.round(ts.totalBankInterest),
          fdInterest: Math.round(ts.totalFDInterest),
          dividendIncome: Math.round(ts.totalDividends),
        },
      });
    }

    // Auto-populate TDS entries
    if (ts.tdsTransactions.length > 0) {
      ts.tdsTransactions.forEach((txn) => {
        dispatch({
          type: "ADD_TDS_ENTRY",
          entry: {
            section: "194A",
            description: extractDeductorName(txn.narration),
            amount: Math.round(txn.withdrawal),
          },
        });
      });
    }

    setPhase("done");
    toast.success("Form fields populated from statement data");
  }, [summary, dispatch]);

  const handleContinue = () => {
    nextStep();
  };

  const handleReset = () => {
    setSummary(null);
    setPhase("upload");
    setError(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <SectionHeader
        number="00"
        title="Import Statement"
        subtitle="Upload a bank statement (Excel) to auto-extract income, interest, and TDS data."
      />

      {/* Privacy Notice */}
      <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-md mb-8 max-w-2xl">
        <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          All processing happens locally in your browser. No data is uploaded to any server.
          Your financial information never leaves this device.
        </p>
      </div>

      {/* Upload Phase */}
      {phase === "upload" && (
        <div className="max-w-2xl">
          <div
            className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="font-display text-sm font-semibold mb-1">
              Drop your bank statement here
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Supports .xls and .xlsx files · Currently: HDFC Bank
            </p>
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Choose File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-md flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="mt-6">
            <Button variant="ghost" onClick={handleContinue} className="text-muted-foreground text-sm">
              Skip — I'll enter data manually
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Parsing Phase */}
      {phase === "parsing" && (
        <div className="max-w-2xl text-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="font-display text-sm font-semibold">Parsing {fileName}...</p>
          <p className="text-xs text-muted-foreground mt-1">
            Detecting bank format and categorising transactions
          </p>
        </div>
      )}

      {/* Review Phase */}
      {phase === "review" && summary && (
        <div className="max-w-3xl">
          {/* Statement Info */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <div>
              <p className="font-display text-sm font-semibold">{summary.bankName}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {summary.accountHolder && `${summary.accountHolder} · `}
                {summary.accountNumber && `A/C: ···${summary.accountNumber.slice(-4)} · `}
                {summary.statementPeriod.from} to {summary.statementPeriod.to}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{summary.transactions.length} transactions</p>
              <button onClick={handleReset} className="text-xs text-destructive hover:underline mt-1">
                Upload different file
              </button>
            </div>
          </div>

          {/* Tax-Relevant Summary */}
          <h3 className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Tax-Relevant Items Detected
          </h3>

          <div className="space-y-3 mb-8">
            <SummaryRow
              label="Salary Income"
              amount={summary.taxSummary.totalSalary}
              transactions={summary.taxSummary.salaryTransactions}
              expanded={expandedCategories.has("salary")}
              onToggle={() => toggleCategory("salary")}
              category="salary"
            />
            <SummaryRow
              label="Bank Interest"
              amount={summary.taxSummary.totalBankInterest}
              transactions={summary.taxSummary.interestTransactions}
              expanded={expandedCategories.has("bank_interest")}
              onToggle={() => toggleCategory("bank_interest")}
              category="bank_interest"
            />
            <SummaryRow
              label="FD Interest"
              amount={summary.taxSummary.totalFDInterest}
              transactions={summary.taxSummary.fdInterestTransactions}
              expanded={expandedCategories.has("fd_interest")}
              onToggle={() => toggleCategory("fd_interest")}
              category="fd_interest"
            />
            <SummaryRow
              label="Dividends"
              amount={summary.taxSummary.totalDividends}
              transactions={summary.taxSummary.dividendTransactions}
              expanded={expandedCategories.has("dividend")}
              onToggle={() => toggleCategory("dividend")}
              category="dividend"
            />
            <SummaryRow
              label="Rent Received"
              amount={summary.taxSummary.totalRentReceived}
              transactions={summary.taxSummary.rentTransactions}
              expanded={expandedCategories.has("rent_received")}
              onToggle={() => toggleCategory("rent_received")}
              category="rent_received"
            />
            <SummaryRow
              label="TDS / Tax Payments"
              amount={summary.taxSummary.totalTDS}
              transactions={summary.taxSummary.tdsTransactions}
              expanded={expandedCategories.has("tds")}
              onToggle={() => toggleCategory("tds")}
              category="tds"
              isWithdrawal
            />
            <SummaryRow
              label="Other Income"
              amount={summary.taxSummary.totalOtherIncome}
              transactions={summary.taxSummary.otherIncomeTransactions}
              expanded={expandedCategories.has("other_income")}
              onToggle={() => toggleCategory("other_income")}
              category="other_income"
            />
          </div>

          {/* Info about tax refund */}
          {summary.taxSummary.totalTaxRefund > 0 && (
            <div className="p-3 bg-teal-50 rounded-md mb-6 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
              <p className="text-xs text-teal-800">
                Tax refund of ₹{formatINR(summary.taxSummary.totalTaxRefund)} detected. 
                This is informational and does not affect your current year computation.
              </p>
            </div>
          )}

          {/* Non-tax items summary */}
          <div className="p-3 bg-secondary/50 rounded-md mb-8">
            <p className="text-xs text-muted-foreground">
              <strong>{summary.transactions.filter(t => !t.taxRelevant).length}</strong> transactions 
              identified as non-taxable (expenses, self-transfers, refunds, etc.) and excluded.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <Button onClick={handleApply} className="font-display">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Apply to Form
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            You can review and edit all auto-populated values in the subsequent steps.
          </p>
        </div>
      )}

      {/* Done Phase */}
      {phase === "done" && summary && (
        <div className="max-w-2xl">
          <div className="p-6 bg-secondary/30 rounded-lg text-center">
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
            <p className="font-display text-sm font-semibold mb-1">
              Statement data applied successfully
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              {summary.bankName} · {summary.transactions.length} transactions processed · 
              {summary.transactions.filter(t => t.taxRelevant).length} tax-relevant items extracted
            </p>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-6 text-left">
              {summary.taxSummary.totalSalary > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Salary</p>
                  <p className="font-mono tabular-nums text-sm font-semibold">
                    ₹{formatINR(summary.taxSummary.totalSalary)}
                  </p>
                </div>
              )}
              {summary.taxSummary.totalBankInterest > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Bank Interest</p>
                  <p className="font-mono tabular-nums text-sm font-semibold">
                    ₹{formatINR(summary.taxSummary.totalBankInterest)}
                  </p>
                </div>
              )}
              {summary.taxSummary.totalFDInterest > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">FD Interest</p>
                  <p className="font-mono tabular-nums text-sm font-semibold">
                    ₹{formatINR(summary.taxSummary.totalFDInterest)}
                  </p>
                </div>
              )}
              {summary.taxSummary.totalDividends > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Dividends</p>
                  <p className="font-mono tabular-nums text-sm font-semibold">
                    ₹{formatINR(summary.taxSummary.totalDividends)}
                  </p>
                </div>
              )}
              {summary.taxSummary.totalTDS > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">TDS</p>
                  <p className="font-mono tabular-nums text-sm font-semibold text-destructive">
                    ₹{formatINR(summary.taxSummary.totalTDS)}
                  </p>
                </div>
              )}
            </div>

            <Button onClick={handleContinue} className="font-display">
              Continue to Review
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="mt-4 text-center">
            <button onClick={handleReset} className="text-xs text-muted-foreground hover:underline">
              Import another statement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Row Component ───────────────────────────────────────────

function SummaryRow({
  label,
  amount,
  transactions,
  expanded,
  onToggle,
  category,
  isWithdrawal = false,
}: {
  label: string;
  amount: number;
  transactions: ParsedTransaction[];
  expanded: boolean;
  onToggle: () => void;
  category: TransactionCategory;
  isWithdrawal?: boolean;
}) {
  if (amount === 0 && transactions.length === 0) return null;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${CATEGORY_COLORS[category]}`}>
            {transactions.length}
          </span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono tabular-nums text-sm font-semibold ${isWithdrawal ? "text-destructive" : ""}`}>
            {isWithdrawal ? "-" : ""}₹{formatINR(amount)}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-secondary/20 px-4 py-2">
          <div className="space-y-1.5">
            {transactions.map((txn) => (
              <div key={txn.id} className="flex items-baseline justify-between text-xs">
                <div className="flex items-baseline gap-2 min-w-0 flex-1">
                  <span className="text-muted-foreground font-mono shrink-0">{txn.date}</span>
                  <span className="truncate text-foreground">{txn.narration}</span>
                </div>
                <span className="font-mono tabular-nums shrink-0 ml-3">
                  ₹{formatINR(isWithdrawal ? txn.withdrawal : txn.deposit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function extractDeductorName(narration: string): string {
  // Try to extract a meaningful name from the narration
  if (narration.includes("NSDL")) return "Income Tax Department";
  const parts = narration.split("-");
  if (parts.length > 1) return parts[1].trim().substring(0, 40);
  return narration.substring(0, 40);
}
