/**
 * Bank Statement Parser — Swiss Financial Design
 * 
 * Client-side Excel parsing for Indian bank statements.
 * Currently supports: HDFC Bank
 * Extensible architecture for adding more banks.
 * 
 * All processing runs in the browser — no data leaves the client.
 */

import * as XLSX from "xlsx";

// ─── Types ───────────────────────────────────────────────────────────

export type TransactionCategory =
  | "salary"
  | "bank_interest"
  | "fd_interest"
  | "dividend"
  | "rent_received"
  | "tds"
  | "tax_refund"
  | "self_transfer"
  | "family_transfer"
  | "expense"
  | "refund_reversal"
  | "emi_loan"
  | "investment"
  | "cash"
  | "other_income"
  | "uncategorised";

export interface ParsedTransaction {
  id: string;
  date: string;
  narration: string;
  reference: string;
  withdrawal: number;
  deposit: number;
  balance: number;
  category: TransactionCategory;
  confidence: "high" | "medium" | "low";
  taxRelevant: boolean;
  notes: string;
}

export interface StatementSummary {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  statementPeriod: { from: string; to: string };
  transactions: ParsedTransaction[];
  taxSummary: TaxSummary;
}

export interface TaxSummary {
  totalSalary: number;
  salaryTransactions: ParsedTransaction[];
  totalBankInterest: number;
  interestTransactions: ParsedTransaction[];
  totalFDInterest: number;
  fdInterestTransactions: ParsedTransaction[];
  totalDividends: number;
  dividendTransactions: ParsedTransaction[];
  totalRentReceived: number;
  rentTransactions: ParsedTransaction[];
  totalTDS: number;
  tdsTransactions: ParsedTransaction[];
  totalTaxRefund: number;
  taxRefundTransactions: ParsedTransaction[];
  totalOtherIncome: number;
  otherIncomeTransactions: ParsedTransaction[];
}

export type BankFormat = "hdfc" | "sbi" | "icici" | "kotak" | "axis" | "unknown";

// ─── Bank Detection ──────────────────────────────────────────────────

function detectBankFormat(rawData: string[][]): BankFormat {
  const flatText = rawData.slice(0, 25).flat().join(" ").toUpperCase();
  
  if (flatText.includes("HDFC BANK")) return "hdfc";
  if (flatText.includes("STATE BANK OF INDIA") || flatText.includes("SBI")) return "sbi";
  if (flatText.includes("ICICI BANK")) return "icici";
  if (flatText.includes("KOTAK MAHINDRA")) return "kotak";
  if (flatText.includes("AXIS BANK")) return "axis";
  
  return "unknown";
}

// ─── HDFC Parser ─────────────────────────────────────────────────────

function parseHDFC(rawData: string[][]): StatementSummary {
  // Extract account info from header rows
  let accountHolder = "";
  let accountNumber = "";
  let statementFrom = "";
  let statementTo = "";
  
  for (let i = 0; i < Math.min(25, rawData.length); i++) {
    const rowText = rawData[i].join(" ");
    
    // Account holder is typically in row 5-6 (column 0 only)
    const firstCell = String(rawData[i][0] || "").trim();
    if (!accountHolder && (firstCell.startsWith("MR ") || firstCell.startsWith("MS ") || firstCell.startsWith("MRS "))) {
      accountHolder = firstCell.replace(/\s+/g, " ").trim();
    }
    
    // Account number
    if (rowText.includes("Account No")) {
      const match = rowText.match(/Account No\s*:\s*(\d+)/);
      if (match) accountNumber = match[1];
    }
    
    // Statement period
    if (rowText.includes("Statement From")) {
      const match = rowText.match(/Statement From\s*:\s*(\S+)\s+To\s*:\s*(\S+)/);
      if (match) {
        statementFrom = match[1];
        statementTo = match[2];
      }
    }
  }
  
  // Find the header row (Date, Narration, ...)
  let headerRowIdx = -1;
  for (let i = 0; i < rawData.length; i++) {
    const firstCell = String(rawData[i][0] || "").trim();
    if (firstCell === "Date" && String(rawData[i][1] || "").includes("Narration")) {
      headerRowIdx = i;
      break;
    }
  }
  
  if (headerRowIdx === -1) {
    throw new Error("Could not find transaction header row in HDFC statement. Expected columns: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance");
  }
  
  // Parse transactions (skip header and separator row)
  const transactions: ParsedTransaction[] = [];
  let txnId = 0;
  
  for (let i = headerRowIdx + 2; i < rawData.length; i++) {
    const row = rawData[i];
    const dateStr = String(row[0] || "").trim();
    
    // Skip empty rows, separator rows, and footer rows
    if (!dateStr || dateStr.startsWith("*") || dateStr.includes("Contents") || 
        dateStr.includes("State account") || dateStr.includes("HDFC Bank") ||
        dateStr.includes("Registered") || dateStr.includes("End Of")) {
      continue;
    }
    
    // Validate date format (DD/MM/YY)
    if (!/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) continue;
    
    const narration = String(row[1] || "").trim();
    const reference = String(row[2] || "").trim();
    const withdrawal = parseAmount(row[4]);
    const deposit = parseAmount(row[5]);
    const balance = parseAmount(row[6]);
    
    if (narration && (withdrawal > 0 || deposit > 0)) {
      const { category, confidence, taxRelevant, notes } = categoriseTransaction(
        narration, withdrawal, deposit, accountHolder
      );
      
      transactions.push({
        id: `txn-${++txnId}`,
        date: dateStr,
        narration,
        reference,
        withdrawal,
        deposit,
        balance,
        category,
        confidence,
        taxRelevant,
        notes,
      });
    }
  }
  
  const taxSummary = buildTaxSummary(transactions);
  
  return {
    bankName: "HDFC Bank",
    accountNumber,
    accountHolder,
    statementPeriod: { from: statementFrom, to: statementTo },
    transactions,
    taxSummary,
  };
}

// ─── Amount Parsing ──────────────────────────────────────────────────

function parseAmount(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ─── Transaction Categorisation ──────────────────────────────────────

function categoriseTransaction(
  narration: string,
  withdrawal: number,
  deposit: number,
  accountHolder: string
): { category: TransactionCategory; confidence: "high" | "medium" | "low"; taxRelevant: boolean; notes: string } {
  const n = narration.toUpperCase();
  const holderParts = accountHolder.toUpperCase().replace(/^(MR|MS|MRS)\s+/, "").trim().split(/\s+/);
  const holderLastName = holderParts[holderParts.length - 1] || "";
  
  // ── Deposits (income side) ──
  if (deposit > 0) {
    // Salary
    if (n.includes("ACH C- SAL") || n.includes("ACH C-SAL") || 
        n.includes("SALARY") || n.includes("SAL-")) {
      return { category: "salary", confidence: "high", taxRelevant: true, notes: extractEmployer(n) };
    }
    
    // Bank Interest
    if (n.includes("INTEREST PAID") || n.includes("INT.PAID") || n.includes("INT PAID") ||
        (n.includes("INTEREST") && n.includes("TILL"))) {
      return { category: "bank_interest", confidence: "high", taxRelevant: true, notes: "Savings account interest" };
    }
    
    // FD Interest
    if (n.includes("FD INT") || n.includes("FDR INT") || n.includes("FIXED DEPOSIT") ||
        n.includes("FD INTEREST") || n.includes("TDR INT")) {
      return { category: "fd_interest", confidence: "high", taxRelevant: true, notes: "Fixed deposit interest" };
    }
    
    // Dividend
    if (n.includes("DIVIDEND") || n.includes("DIV-")) {
      return { category: "dividend", confidence: "high", taxRelevant: true, notes: "Dividend income" };
    }
    
    // Rent received
    if (n.includes("RENT") && !n.includes("RENTAL") && deposit >= 5000) {
      return { category: "rent_received", confidence: "medium", taxRelevant: true, notes: "Possible rent received" };
    }
    
    // Tax refund
    if (n.includes("TAX REFUND") || n.includes("ITDTAX") || n.includes("ITD REFUND") ||
        n.includes("INCOME TAX")) {
      return { category: "tax_refund", confidence: "high", taxRelevant: false, notes: "Income tax refund" };
    }
    
    // Self-transfer detection
    if (isSelfTransfer(n, accountHolder)) {
      return { category: "self_transfer", confidence: "high", taxRelevant: false, notes: "Transfer from own account" };
    }
    
    // Family transfer (same last name, large amount)
    if (holderLastName && n.includes(holderLastName) && !isSelfTransfer(n, accountHolder) && deposit >= 10000) {
      return { category: "family_transfer", confidence: "medium", taxRelevant: false, notes: "Transfer from family member" };
    }
    
    // Refund/reversal
    if (n.includes("REFUND") || n.includes("REVERSAL") || n.includes("REV-") || n.includes("CASHBACK")) {
      return { category: "refund_reversal", confidence: "high", taxRelevant: false, notes: "Refund or reversal" };
    }
    
    // Small UPI deposits are likely refunds or P2P
    if (n.includes("UPI") && deposit < 5000) {
      return { category: "refund_reversal", confidence: "low", taxRelevant: false, notes: "Small UPI deposit — likely refund or P2P" };
    }
    
    // Larger unclassified deposits
    if (deposit >= 50000) {
      return { category: "other_income", confidence: "low", taxRelevant: true, notes: "Large deposit — needs review" };
    }
    
    return { category: "uncategorised", confidence: "low", taxRelevant: false, notes: "" };
  }
  
  // ── Withdrawals (expense side) ──
  if (withdrawal > 0) {
    // TDS
    if (n.includes("TDS") || n.includes("TAX DEDUCTED")) {
      return { category: "tds", confidence: "high", taxRelevant: true, notes: "TDS deducted" };
    }
    
    // Advance tax / Self-assessment tax
    if (n.includes("ADVANCE TAX") || n.includes("SELF ASSESSMENT") || 
        (n.includes("NSDL") && n.includes("TAX"))) {
      return { category: "tds", confidence: "high", taxRelevant: true, notes: "Tax payment" };
    }
    
    // Investment
    if (n.includes("MUTUAL FUND") || n.includes("MF-") || n.includes("SIP") ||
        n.includes("ZERODHA") || n.includes("GROWW") || n.includes("KUVERA") ||
        n.includes("COIN") || n.includes("DEMAT")) {
      return { category: "investment", confidence: "medium", taxRelevant: false, notes: "Investment" };
    }
    
    // EMI / Loan
    if (n.includes("EMI") || n.includes("LOAN") || n.includes("MANDATE")) {
      return { category: "emi_loan", confidence: "medium", taxRelevant: false, notes: "EMI or loan payment" };
    }
    
    // Self-transfer
    if (isSelfTransfer(n, accountHolder)) {
      return { category: "self_transfer", confidence: "high", taxRelevant: false, notes: "Transfer to own account" };
    }
    
    // Cash withdrawal
    if (n.includes("ATM") || n.includes("CASH WDL") || n.includes("CASH WITHDRAWAL")) {
      return { category: "cash", confidence: "high", taxRelevant: false, notes: "Cash withdrawal" };
    }
    
    return { category: "expense", confidence: "high", taxRelevant: false, notes: "" };
  }
  
  return { category: "uncategorised", confidence: "low", taxRelevant: false, notes: "" };
}

function isSelfTransfer(narration: string, accountHolder: string): boolean {
  const n = narration.toUpperCase();
  const holderName = accountHolder.toUpperCase().replace(/^(MR|MS|MRS)\s+/, "").trim();
  const nameParts = holderName.split(/\s+/).filter(p => p.length > 2);
  const firstName = nameParts[0] || "";
  const lastName = nameParts[nameParts.length - 1] || "";
  
  const isTransfer = n.includes("IMPS") || n.includes("NEFT") || n.includes("RTGS");
  if (!isTransfer) return false;
  
  // Explicit self-transfer keywords
  if (n.includes("TRANSFER TO SELF") || n.includes("OWN ACCOUNT") || n.includes("SELF TRANSFER")) {
    return true;
  }
  
  // Full name match in narration
  if (holderName && n.includes(holderName)) {
    return true;
  }
  
  // First + last name both appear (handles cases like "DHRUV SHARAN" in IMPS narration)
  if (firstName && lastName && firstName !== lastName && n.includes(firstName) && n.includes(lastName)) {
    return true;
  }
  
  return false;
}

function extractEmployer(narration: string): string {
  // Try to extract employer name from salary narrations
  // ACH C- SAL-THEBOSTONCONSTGR-SAL300425072
  const achMatch = narration.match(/ACH C-\s*SAL-([A-Z0-9]+)/i);
  if (achMatch) return `Salary from ${achMatch[1]}`;
  
  const salMatch = narration.match(/SALARY.*?-([A-Z\s]+)/i);
  if (salMatch) return `Salary from ${salMatch[1].trim()}`;
  
  return "Salary credit";
}

// ─── Tax Summary Builder ─────────────────────────────────────────────

function buildTaxSummary(transactions: ParsedTransaction[]): TaxSummary {
  const byCategory = (cat: TransactionCategory) => transactions.filter(t => t.category === cat);
  const sumDeposits = (txns: ParsedTransaction[]) => txns.reduce((s, t) => s + t.deposit, 0);
  const sumWithdrawals = (txns: ParsedTransaction[]) => txns.reduce((s, t) => s + t.withdrawal, 0);
  
  const salaryTxns = byCategory("salary");
  const interestTxns = byCategory("bank_interest");
  const fdInterestTxns = byCategory("fd_interest");
  const dividendTxns = byCategory("dividend");
  const rentTxns = byCategory("rent_received");
  const tdsTxns = byCategory("tds");
  const taxRefundTxns = byCategory("tax_refund");
  const otherIncomeTxns = byCategory("other_income");
  
  return {
    totalSalary: sumDeposits(salaryTxns),
    salaryTransactions: salaryTxns,
    totalBankInterest: sumDeposits(interestTxns),
    interestTransactions: interestTxns,
    totalFDInterest: sumDeposits(fdInterestTxns),
    fdInterestTransactions: fdInterestTxns,
    totalDividends: sumDeposits(dividendTxns),
    dividendTransactions: dividendTxns,
    totalRentReceived: sumDeposits(rentTxns),
    rentTransactions: rentTxns,
    totalTDS: sumWithdrawals(tdsTxns),
    tdsTransactions: tdsTxns,
    totalTaxRefund: sumDeposits(taxRefundTxns),
    taxRefundTransactions: taxRefundTxns,
    totalOtherIncome: sumDeposits(otherIncomeTxns),
    otherIncomeTransactions: otherIncomeTxns,
  };
}

// ─── Main Parse Function ─────────────────────────────────────────────

export async function parseStatement(file: File): Promise<StatementSummary> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Failed to read file");
        
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData: string[][] = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          raw: false,
          defval: "",
        });
        
        const bankFormat = detectBankFormat(rawData);
        
        switch (bankFormat) {
          case "hdfc":
            resolve(parseHDFC(rawData));
            break;
          default:
            // Try generic parsing
            reject(new Error(
              `Bank format not yet supported. Detected: ${bankFormat}. Currently supported: HDFC Bank. ` +
              `More banks will be added soon.`
            ));
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Category Labels ─────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  salary: "Salary Income",
  bank_interest: "Bank Interest",
  fd_interest: "FD Interest",
  dividend: "Dividend",
  rent_received: "Rent Received",
  tds: "TDS / Tax Payment",
  tax_refund: "Tax Refund",
  self_transfer: "Self Transfer",
  family_transfer: "Family Transfer",
  expense: "Expense",
  refund_reversal: "Refund / Reversal",
  emi_loan: "EMI / Loan",
  investment: "Investment",
  cash: "Cash",
  other_income: "Other Income",
  uncategorised: "Uncategorised",
};

export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  salary: "bg-emerald-100 text-emerald-800",
  bank_interest: "bg-blue-100 text-blue-800",
  fd_interest: "bg-blue-100 text-blue-800",
  dividend: "bg-purple-100 text-purple-800",
  rent_received: "bg-amber-100 text-amber-800",
  tds: "bg-red-100 text-red-800",
  tax_refund: "bg-teal-100 text-teal-800",
  self_transfer: "bg-gray-100 text-gray-600",
  family_transfer: "bg-gray-100 text-gray-600",
  expense: "bg-gray-100 text-gray-500",
  refund_reversal: "bg-gray-100 text-gray-500",
  emi_loan: "bg-orange-100 text-orange-800",
  investment: "bg-indigo-100 text-indigo-800",
  cash: "bg-gray-100 text-gray-600",
  other_income: "bg-yellow-100 text-yellow-800",
  uncategorised: "bg-gray-50 text-gray-400",
};
