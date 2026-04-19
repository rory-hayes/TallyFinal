import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { normalizeMappedPayrollCsv } from "../../lib/imports/payroll-normalization";
import { matchEmployeeRunRecords } from "../../lib/review/employee-matching";

function readFixture(name: string) {
  return readFileSync(
    new URL(`../../fixtures/payroll/${name}`, import.meta.url),
    "utf8",
  );
}

function normalizeFixture(name: string, datasetRole: "current" | "previous") {
  const result = normalizeMappedPayrollCsv({
    clientId: "client_123",
    csvText: readFixture(name),
    datasetRole,
    mapping: {
      employee_external_id: "Employee ID",
      employee_name: "Employee Name",
      employee_number: "Payroll No",
      gross_pay: "Gross Pay",
      net_pay: "Net Pay",
    },
    organizationId: "org_123",
    payRunId: "run_123",
    sourceFileId: `source_${datasetRole}_123`,
  });

  if (!result.ok) {
    throw new Error(`Fixture ${name} failed normalization.`);
  }

  return result.dataset;
}

describe("matchEmployeeRunRecords", () => {
  it("matches current employees to previous records by external id, then payroll number, then exact name with a low-confidence flag", () => {
    const currentDataset = normalizeFixture("generic-ie-current.csv", "current");
    const previousDataset = normalizeFixture("generic-ie-previous.csv", "previous");

    const result = matchEmployeeRunRecords({
      currentRecords: currentDataset.employeeRunRecords,
      previousRecords: previousDataset.employeeRunRecords,
    });

    expect(result.currentMatches).toHaveLength(5);
    expect(result.missingPreviousRecords).toHaveLength(1);

    const aoifeMatch = result.currentMatches.find(
      (match) => match.currentEmployeeDisplayName === "Aoife Murphy",
    );
    expect(aoifeMatch).toMatchObject({
      confidence: "high",
      matchMethod: "employee_external_id",
      status: "matched",
    });

    const brianMatch = result.currentMatches.find(
      (match) => match.currentEmployeeDisplayName === "Brian Kelly",
    );
    expect(brianMatch).toMatchObject({
      confidence: "high",
      matchMethod: "employee_number",
      status: "matched",
    });

    const ciaraMatch = result.currentMatches.find(
      (match) => match.currentEmployeeDisplayName === "Ciara Doyle",
    );
    expect(ciaraMatch).toMatchObject({
      confidence: "low",
      matchMethod: "employee_name_exact",
      status: "matched",
    });
  });

  it("surfaces ambiguous duplicate-name fallbacks and explicit new and missing employees instead of hiding them", () => {
    const currentDataset = normalizeFixture("generic-ie-current.csv", "current");
    const previousDataset = normalizeFixture("generic-ie-previous.csv", "previous");

    const result = matchEmployeeRunRecords({
      currentRecords: currentDataset.employeeRunRecords,
      previousRecords: previousDataset.employeeRunRecords,
    });

    const chrisMatch = result.currentMatches.find(
      (match) => match.currentEmployeeDisplayName === "Chris O'Brien",
    );

    expect(chrisMatch).toMatchObject({
      ambiguousCandidateRecordKeys: expect.any(Array),
      confidence: "none",
      matchMethod: null,
      reason: "duplicate_name",
      status: "ambiguous_match",
    });
    expect(chrisMatch?.ambiguousCandidateRecordKeys).toHaveLength(2);

    const eveMatch = result.currentMatches.find(
      (match) => match.currentEmployeeDisplayName === "Eve New",
    );

    expect(eveMatch).toMatchObject({
      confidence: "none",
      matchMethod: null,
      reason: "no_previous_match",
      status: "new_employee",
    });

    expect(result.missingPreviousRecords).toEqual([
      expect.objectContaining({
        previousEmployeeDisplayName: "Dormant Person",
        reason: "missing_from_current",
        status: "missing_employee",
      }),
    ]);
  });
});
