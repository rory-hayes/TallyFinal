import { describe, expect, it } from "vitest";

import { buildReconciliationCheckRecord } from "../../lib/reconciliation/service";

describe("buildReconciliationCheckRecord", () => {
  it("marks exact matches as matched", () => {
    expect(
      buildReconciliationCheckRecord({
        comparisonAmount: "6025.54",
        kind: "payroll_to_payment",
        payrollAmount: "6025.54",
        sourceFileId: "source_payment_123",
        toleranceAmount: "5.00",
      }),
    ).toMatchObject({
      comparisonAmount: "6025.54",
      kind: "payroll_to_payment",
      payrollAmount: "6025.54",
      sourceFileId: "source_payment_123",
      status: "matched",
      toleranceAmount: "5.00",
      varianceAmount: "0.00",
    });
  });

  it("marks small differences inside tolerance as within_tolerance", () => {
    expect(
      buildReconciliationCheckRecord({
        comparisonAmount: "6027.04",
        kind: "payroll_to_payment",
        payrollAmount: "6025.54",
        sourceFileId: "source_payment_123",
        toleranceAmount: "2.00",
      }),
    ).toMatchObject({
      status: "within_tolerance",
      varianceAmount: "1.50",
    });
  });

  it("marks larger differences as mismatch", () => {
    expect(
      buildReconciliationCheckRecord({
        comparisonAmount: "4270.15",
        kind: "payroll_to_journal",
        payrollAmount: "4250.15",
        sourceFileId: "source_journal_123",
        toleranceAmount: "5.00",
      }),
    ).toMatchObject({
      kind: "payroll_to_journal",
      status: "mismatch",
      varianceAmount: "20.00",
    });
  });
});
