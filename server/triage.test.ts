import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
const mockInvokeLLM = vi.mocked(invokeLLM);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("triage.classify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty classifications for empty input", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.triage.classify({
      transactions: [],
      accountHolder: "Test User",
      bankName: "HDFC Bank",
    });

    expect(result.classifications).toEqual([]);
    expect(mockInvokeLLM).not.toHaveBeenCalled();
  });

  it("calls LLM and returns classifications for transactions", async () => {
    const mockClassifications = [
      {
        id: "txn-001",
        category: "salary",
        taxRelevant: true,
        confidence: "high",
        notes: "ACH credit from employer",
      },
      {
        id: "txn-002",
        category: "bank_interest",
        taxRelevant: true,
        confidence: "high",
        notes: "Quarterly interest credit",
      },
    ];

    mockInvokeLLM.mockResolvedValueOnce({
      id: "test-id",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ classifications: mockClassifications }),
          },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.triage.classify({
      transactions: [
        {
          id: "txn-001",
          date: "01/04/2025",
          narration: "ACH-BOSTON CONSULTING GROUP",
          withdrawal: 0,
          deposit: 400000,
        },
        {
          id: "txn-002",
          date: "30/06/2025",
          narration: "INT.PAID:01042025TO30062025",
          withdrawal: 0,
          deposit: 1200,
        },
      ],
      accountHolder: "DHRUV SHARAN",
      bankName: "HDFC Bank",
    });

    expect(mockInvokeLLM).toHaveBeenCalledOnce();
    expect(result.classifications).toHaveLength(2);
    expect(result.classifications[0]).toMatchObject({
      id: "txn-001",
      category: "salary",
      taxRelevant: true,
    });
    expect(result.classifications[1]).toMatchObject({
      id: "txn-002",
      category: "bank_interest",
    });
  });

  it("returns empty classifications with error on LLM failure", async () => {
    mockInvokeLLM.mockRejectedValueOnce(new Error("API timeout"));

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.triage.classify({
      transactions: [
        {
          id: "txn-001",
          date: "01/04/2025",
          narration: "SOME TRANSACTION",
          withdrawal: 0,
          deposit: 5000,
        },
      ],
      accountHolder: "Test",
      bankName: "HDFC",
    });

    expect(result.classifications).toEqual([]);
    expect(result.error).toBe("API timeout");
  });

  it("handles LLM returning empty content gracefully", async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: "test-id",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "",
          },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.triage.classify({
      transactions: [
        {
          id: "txn-001",
          date: "01/04/2025",
          narration: "SOME TRANSACTION",
          withdrawal: 0,
          deposit: 5000,
        },
      ],
    });

    // Should gracefully handle empty content
    expect(result.classifications).toEqual([]);
    expect(result.error).toBeDefined();
  });

  it("sends correct prompt structure to LLM", async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: "test-id",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ classifications: [] }),
          },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.triage.classify({
      transactions: [
        {
          id: "txn-001",
          date: "15/07/2025",
          narration: "NEFT-RENT FROM TENANT",
          withdrawal: 0,
          deposit: 25000,
        },
      ],
      accountHolder: "SUDHANSHU SHARAN",
      bankName: "HDFC Bank",
    });

    const callArgs = mockInvokeLLM.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[1].role).toBe("user");

    // Verify the user prompt includes the transaction details
    const userContent = callArgs.messages[1].content as string;
    expect(userContent).toContain("SUDHANSHU SHARAN");
    expect(userContent).toContain("HDFC Bank");
    expect(userContent).toContain("NEFT-RENT FROM TENANT");
    expect(userContent).toContain("txn-001");

    // Verify response_format is set for structured output
    expect(callArgs.response_format).toBeDefined();
    expect(callArgs.response_format?.type).toBe("json_schema");
  });
});
