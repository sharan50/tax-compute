/**
 * Reducer tests — state hazards that the engine cannot see.
 */

import { describe, it, expect } from "vitest";
import { reducer, initialState } from "./taxFormReducer";

describe("switching financial year clears FY 2024-25 only capital gains buckets", () => {
  const with2024Buckets = {
    ...initialState,
    assesseeInfo: { ...initialState.assesseeInfo, financialYear: "2024-25" as const },
    capitalGains: {
      stcg111A_20: 100000,
      stcg111A_15: 500000,
      ltcg112A_125: 200000,
      ltcg112A_10: 400000,
      ltcgOther_125: 150000,
      ltcgOther_20: 300000,
    },
  };

  it("drops the pre-23-July-2024 buckets when moving to FY 2025-26", () => {
    const next = reducer(with2024Buckets, {
      type: "UPDATE_ASSESSEE",
      data: { financialYear: "2025-26" },
    });

    expect(next.capitalGains.stcg111A_15).toBeUndefined();
    expect(next.capitalGains.ltcg112A_10).toBeUndefined();
    expect(next.capitalGains.ltcgOther_20).toBeUndefined();

    // Buckets that exist in both years survive untouched.
    expect(next.capitalGains.stcg111A_20).toBe(100000);
    expect(next.capitalGains.ltcg112A_125).toBe(200000);
    expect(next.capitalGains.ltcgOther_125).toBe(150000);
  });

  it("keeps them when the year is unchanged", () => {
    const next = reducer(with2024Buckets, {
      type: "UPDATE_ASSESSEE",
      data: { name: "SOMEONE" },
    });
    expect(next.capitalGains.stcg111A_15).toBe(500000);
    expect(next.capitalGains.ltcgOther_20).toBe(300000);
  });

  it("keeps them when staying on FY 2024-25", () => {
    const next = reducer(with2024Buckets, {
      type: "UPDATE_ASSESSEE",
      data: { financialYear: "2024-25" },
    });
    expect(next.capitalGains.ltcg112A_10).toBe(400000);
  });

  it("does not resurrect them when moving back to FY 2024-25", () => {
    const moved = reducer(with2024Buckets, {
      type: "UPDATE_ASSESSEE",
      data: { financialYear: "2025-26" },
    });
    const back = reducer(moved, {
      type: "UPDATE_ASSESSEE",
      data: { financialYear: "2024-25" },
    });
    expect(back.capitalGains.stcg111A_15).toBeUndefined();
  });
});
