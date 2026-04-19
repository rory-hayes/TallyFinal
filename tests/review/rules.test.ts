import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { normalizeMappedPayrollCsv } from "../../lib/imports/payroll-normalization";
import { matchEmployeeRunRecords } from "../../lib/review/employee-matching";
import { evaluateDeterministicReviewRules } from "../../lib/review/rules";

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

describe("evaluateDeterministicReviewRules", () => {
  it("produces deterministic variance, new employee, and missing employee findings from normalized payroll datasets", () => {
    const currentDataset = normalizeFixture("generic-ie-current.csv", "current");
    const previousDataset = normalizeFixture("generic-ie-previous.csv", "previous");
    const matchResult = matchEmployeeRunRecords({
      currentRecords: currentDataset.employeeRunRecords,
      previousRecords: previousDataset.employeeRunRecords,
    });

    const findings = evaluateDeterministicReviewRules({
      currentDataset,
      previousDataset,
      ruleVersion: "2026-04-19",
      matchResult,
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleCode: "GROSS_VARIANCE_THRESHOLD",
          severity: "warning",
        }),
        expect.objectContaining({
          ruleCode: "NET_VARIANCE_THRESHOLD",
          severity: "warning",
        }),
        expect.objectContaining({
          ruleCode: "TAX_VARIANCE_THRESHOLD",
          severity: "warning",
        }),
        expect.objectContaining({
          ruleCode: "PENSION_VARIANCE_THRESHOLD",
          severity: "warning",
        }),
        expect.objectContaining({
          ruleCode: "HOURS_VARIANCE_THRESHOLD",
          severity: "warning",
        }),
        expect.objectContaining({
          ruleCode: "NEW_EMPLOYEE",
          severity: "info",
        }),
        expect.objectContaining({
          ruleCode: "MISSING_EMPLOYEE",
          severity: "warning",
        }),
      ]),
    );

    const aoifeGrossFinding = findings.find(
      (finding) =>
        finding.ruleCode === "GROSS_VARIANCE_THRESHOLD" &&
        finding.employeeDisplayName === "Aoife Murphy",
    );

    expect(aoifeGrossFinding).toMatchObject({
      details: expect.objectContaining({
        currentAmount: "4400.15",
        deltaAmount: "150.00",
        previousAmount: "4250.15",
        thresholdAmount: "100.00",
      }),
    });

    const brianHoursFinding = findings.find(
      (finding) =>
        finding.ruleCode === "HOURS_VARIANCE_THRESHOLD" &&
        finding.employeeDisplayName === "Brian Kelly",
    );

    expect(brianHoursFinding).toMatchObject({
      details: expect.objectContaining({
        currentAmount: "152.00",
        deltaAmount: "4.00",
        previousAmount: "148.00",
        thresholdAmount: "2.00",
      }),
    });
  });

  it("flags zero-pay anomalies and duplicate identifiers deterministically without mutating the source records", () => {
    const currentDataset = normalizeFixture("generic-ie-current.csv", "current");
    const previousDataset = normalizeFixture("generic-ie-previous.csv", "previous");
    const duplicatedCurrentRecords = currentDataset.employeeRunRecords.map((record) => {
      if (record.employeeDisplayName === "Eve New") {
        return {
          ...record,
          employeeExternalId: "E001",
          grossPay: "0.00",
          netPay: "0.00",
        };
      }

      return record;
    });

    const matchResult = matchEmployeeRunRecords({
      currentRecords: duplicatedCurrentRecords,
      previousRecords: previousDataset.employeeRunRecords,
    });

    const findings = evaluateDeterministicReviewRules({
      currentDataset: {
        ...currentDataset,
        employeeRunRecords: duplicatedCurrentRecords,
      },
      previousDataset,
      ruleVersion: "2026-04-19",
      matchResult,
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeDisplayName: "Eve New",
          ruleCode: "ZERO_PAY_ANOMALY",
          severity: "blocker",
        }),
        expect.objectContaining({
          employeeDisplayName: "Aoife Murphy",
          ruleCode: "DUPLICATE_IDENTIFIER",
          severity: "blocker",
        }),
        expect.objectContaining({
          employeeDisplayName: "Eve New",
          ruleCode: "DUPLICATE_IDENTIFIER",
          severity: "blocker",
        }),
      ]),
    );
  });
});
