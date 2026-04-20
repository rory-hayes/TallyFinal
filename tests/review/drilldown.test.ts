import { describe, expect, it } from "vitest";

import {
  buildEmployeeComparisonRows,
  buildPayComponentComparisonRows,
} from "../../lib/review/drilldown";

describe("employee drilldown comparison helpers", () => {
  it("marks changed current-vs-previous employee fields clearly", () => {
    const rows = buildEmployeeComparisonRows({
      currentRecord: {
        employeeDisplayName: "Aoife Murphy",
        employeeExternalId: "EMP-001",
        employeeNumber: "1001",
        grossPay: "4250.15",
        netPay: "3110.44",
      },
      previousRecord: {
        employeeDisplayName: "Aoife Murphy",
        employeeExternalId: "EMP-001",
        employeeNumber: "1001",
        grossPay: "4050.15",
        netPay: "3010.44",
      },
    });

    expect(rows).toEqual([
      expect.objectContaining({
        changed: false,
        fieldKey: "employeeDisplayName",
      }),
      expect.objectContaining({
        changed: false,
        fieldKey: "employeeExternalId",
      }),
      expect.objectContaining({
        changed: false,
        fieldKey: "employeeNumber",
      }),
      expect.objectContaining({
        changed: true,
        currentValue: "4250.15",
        fieldKey: "grossPay",
        previousValue: "4050.15",
      }),
      expect.objectContaining({
        changed: true,
        currentValue: "3110.44",
        fieldKey: "netPay",
        previousValue: "3010.44",
      }),
    ]);
  });

  it("builds normalized pay component deltas including added and removed rows", () => {
    const rows = buildPayComponentComparisonRows({
      currentComponents: [
        {
          amount: "2500.00",
          category: "earning",
          componentCode: "BASIC",
          componentLabel: "Basic salary",
        },
        {
          amount: "200.00",
          category: "earning",
          componentCode: "BONUS",
          componentLabel: "Bonus",
        },
      ],
      previousComponents: [
        {
          amount: "2400.00",
          category: "earning",
          componentCode: "BASIC",
          componentLabel: "Basic salary",
        },
        {
          amount: "100.00",
          category: "deduction",
          componentCode: "PENSION",
          componentLabel: "Pension",
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        changeType: "changed",
        componentCode: "BASIC",
        currentAmount: "2500.00",
        deltaAmount: "100.00",
        previousAmount: "2400.00",
      }),
      expect.objectContaining({
        changeType: "added",
        componentCode: "BONUS",
        currentAmount: "200.00",
        previousAmount: null,
      }),
      expect.objectContaining({
        changeType: "removed",
        componentCode: "PENSION",
        currentAmount: null,
        previousAmount: "100.00",
      }),
    ]);
  });
});
