import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";

// ─── Transaction Triage Schema ───────────────────────────────────────

const transactionSchema = z.object({
  id: z.string().max(64),
  date: z.string().max(32),
  narration: z.string().max(500),
  withdrawal: z.number().finite(),
  deposit: z.number().finite(),
});

const triageInputSchema = z.object({
  // Cap the batch so a single request can't force an unbounded prompt or tie
  // up the server. 500 covers a typical multi-year statement comfortably.
  transactions: z.array(transactionSchema).max(500),
  accountHolder: z.string().max(200).optional(),
  bankName: z.string().max(200).optional(),
});

const TRIAGE_SYSTEM_PROMPT = `You are an Indian tax expert assistant. Your job is to classify bank transactions into tax-relevant categories.

For each transaction, assign one of these categories:
- "salary" — Salary, wages, bonus credits from employer
- "bank_interest" — Savings account interest (quarterly credits from bank)
- "fd_interest" — Fixed deposit interest or recurring deposit interest
- "dividend" — Dividend income from stocks, mutual funds, or companies
- "rent_received" — Rental income received from tenants
- "tds" — Tax Deducted at Source or advance tax payments (withdrawals)
- "tax_refund" — Income tax refund from ITD
- "self_transfer" — Transfer between own accounts (same person, different banks)
- "family_transfer" — Transfer from/to family members (gifts, support)
- "expense" — Regular spending, bills, subscriptions, purchases
- "refund_reversal" — Merchant refunds, cashbacks, payment reversals
- "emi_loan" — EMI payments, loan disbursements or repayments
- "investment" — Mutual fund SIPs, stock purchases, demat transfers
- "cash" — ATM withdrawals or cash deposits
- "other_income" — Any other taxable income not fitting above categories
- "uncategorised" — Cannot determine with reasonable confidence

Also indicate:
- "taxRelevant": true if the transaction affects income tax computation (income or TDS)
- "confidence": "high", "medium", or "low"
- "notes": Brief explanation of your classification reasoning

Context: These are Indian bank statement transactions. Common patterns:
- ACH/NEFT/RTGS/IMPS are transfer methods, not categories
- UPI transactions are usually expenses unless they're refunds
- "INT.PAID" or "INTEREST PAID" = bank interest
- Salary often comes via ACH with employer abbreviation
- Self-transfers have the account holder's own name in the narration

Respond with a JSON array matching the input transaction IDs.`;

// ─── Router ──────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  triage: router({
    classify: publicProcedure
      .input(triageInputSchema)
      .mutation(async ({ input }) => {
        const { transactions, accountHolder, bankName } = input;

        if (transactions.length === 0) {
          return { classifications: [] };
        }

        // Build the user prompt with transaction data
        const txnList = transactions.map(t => {
          const type = t.deposit > 0 ? "DEPOSIT" : "WITHDRAWAL";
          const amount = t.deposit > 0 ? t.deposit : t.withdrawal;
          return `ID: ${t.id} | Date: ${t.date} | ${type}: ₹${amount.toLocaleString("en-IN")} | Narration: ${t.narration}`;
        }).join("\n");

        const userPrompt = `Account holder: ${accountHolder || "Unknown"}
Bank: ${bankName || "Unknown"}

Classify each of these ${transactions.length} transactions:

${txnList}

Respond with a JSON array where each element has: { "id": string, "category": string, "taxRelevant": boolean, "confidence": "high"|"medium"|"low", "notes": string }`;

        try {
          const result = await invokeLLM({
            messages: [
              { role: "system", content: TRIAGE_SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "transaction_classifications",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    classifications: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", description: "Transaction ID" },
                          category: {
                            type: "string",
                            enum: [
                              "salary", "bank_interest", "fd_interest", "dividend",
                              "rent_received", "tds", "tax_refund", "self_transfer",
                              "family_transfer", "expense", "refund_reversal",
                              "emi_loan", "investment", "cash", "other_income", "uncategorised"
                            ],
                          },
                          taxRelevant: { type: "boolean" },
                          confidence: { type: "string", enum: ["high", "medium", "low"] },
                          notes: { type: "string", description: "Brief reasoning" },
                        },
                        required: ["id", "category", "taxRelevant", "confidence", "notes"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["classifications"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = result.choices[0]?.message?.content;
          if (!content || typeof content !== "string") {
            throw new Error("Empty LLM response");
          }

          const parsed = JSON.parse(content);
          return { classifications: parsed.classifications || [] };
        } catch (error) {
          console.error("[Triage] LLM classification failed:", error);
          // Return empty classifications on failure — frontend falls back to rule-based
          return {
            classifications: [],
            error: error instanceof Error ? error.message : "Classification failed",
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
