import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  normalizeMappedJournalCsv,
  normalizeMappedPaymentCsv,
} from "../../lib/imports/reconciliation-normalization";

function readFixture(name: string) {
  return readFileSync(
    new URL(`../../fixtures/reconciliation/${name}`, import.meta.url),
    "utf8",
  );
}

describe("secondary reconciliation normalization", () => {
  it("normalizes a mapped journal CSV into deterministic journal entries with row lineage", () => {
    const result = normalizeMappedJournalCsv({
      clientId: "client_123",
      csvText: readFixture("generic-journal.csv"),
      mapping: {
        account_code: "Account Code",
        amount: "Amount",
        entry_date: "Entry Date",
        entry_description: "Description",
      },
      organizationId: "org_123",
      payRunId: "run_123",
      sourceFileId: "source_journal_123",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected successful journal normalization.");
    }

    expect(result.entries).toEqual([
      expect.objectContaining({
        accountCode: "7001",
        amount: "4250.15",
        entryDate: "2026-04-30",
        entryDescription: "Gross payroll",
        rowNumber: 2,
        sourceFileId: "source_journal_123",
      }),
      expect.objectContaining({
        accountCode: "2210",
        amount: "-700.00",
        rowNumber: 3,
      }),
      expect.objectContaining({
        accountCode: "2220",
        amount: "-120.50",
        rowNumber: 4,
      }),
    ]);
  });

  it("normalizes a mapped payment CSV into deterministic payment records", () => {
    const result = normalizeMappedPaymentCsv({
      clientId: "client_123",
      csvText: readFixture("generic-payment.csv"),
      mapping: {
        employee_external_id: "Employee ID",
        employee_name: "Employee Name",
        payment_amount: "Payment Amount",
        payment_date: "Payment Date",
        payment_reference: "Payment Reference",
      },
      organizationId: "org_123",
      payRunId: "run_123",
      sourceFileId: "source_payment_123",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected successful payment normalization.");
    }

    expect(result.records).toEqual([
      expect.objectContaining({
        employeeExternalId: "EMP-001",
        employeeName: "Aoife Murphy",
        paymentAmount: "3110.44",
        paymentDate: "2026-04-30",
        paymentReference: "PAY-001",
        rowNumber: 2,
      }),
      expect.objectContaining({
        employeeExternalId: "EMP-002",
        employeeName: "Conor Walsh",
        paymentAmount: "2845.10",
        rowNumber: 3,
      }),
    ]);
  });
});
