import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { normalizeMappedPayrollCsv } from "../../lib/imports/payroll-normalization";

function readFixture(name: string) {
  return readFileSync(
    new URL(`../../fixtures/payroll/${name}`, import.meta.url),
    "utf8",
  );
}

describe("normalizeMappedPayrollCsv", () => {
  it("normalizes a mapped current payroll CSV into canonical employee records, pay components, and source-row evidence", () => {
    const result = normalizeMappedPayrollCsv({
      clientId: "client_123",
      csvText: readFixture("generic-ie-current.csv"),
      datasetRole: "current",
      mapping: {
        employee_external_id: "Employee ID",
        employee_name: "Employee Name",
        employee_number: "Payroll No",
        gross_pay: "Gross Pay",
        net_pay: "Net Pay",
      },
      organizationId: "org_123",
      payRunId: "run_123",
      sourceFileId: "source_current_123",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected successful normalization.");
    }

    expect(result.dataset.employeeRunRecords).toHaveLength(5);
    expect(result.dataset.employeePayComponents.length).toBeGreaterThan(20);

    const aoifeRecord = result.dataset.employeeRunRecords.find(
      (record) => record.employeeDisplayName === "Aoife Murphy",
    );

    expect(aoifeRecord).toMatchObject({
      employeeDisplayName: "Aoife Murphy",
      employeeExternalId: "E001",
      employeeNumber: "P100",
      grossPay: "4400.15",
      netPay: "3210.44",
      recordScope: "current",
      rowNumber: 2,
    });

    const aoifeGrossEvidence = result.dataset.sourceRowRefs.find(
      (rowRef) =>
        rowRef.employeeRunRecordKey === aoifeRecord?.recordKey &&
        rowRef.canonicalFieldKey === "gross_pay",
    );

    expect(aoifeGrossEvidence).toMatchObject({
      columnHeader: "Gross Pay",
      columnValue: "4400.15",
      rowNumber: 2,
      sourceFileId: "source_current_123",
    });

    const basicPayComponent = result.dataset.employeePayComponents.find(
      (component) =>
        component.employeeRunRecordKey === aoifeRecord?.recordKey &&
        component.componentLabel === "Basic Pay",
    );

    expect(basicPayComponent).toMatchObject({
      amount: "3900.15",
      category: "earning",
    });

    const payeComponent = result.dataset.employeePayComponents.find(
      (component) =>
        component.employeeRunRecordKey === aoifeRecord?.recordKey &&
        component.componentLabel === "PAYE",
    );

    expect(payeComponent).toMatchObject({
      amount: "700.00",
      category: "deduction",
    });
  });

  it("normalizes the previous payroll with the same canonical shape", () => {
    const result = normalizeMappedPayrollCsv({
      clientId: "client_123",
      csvText: readFixture("generic-ie-previous.csv"),
      datasetRole: "previous",
      mapping: {
        employee_external_id: "Employee ID",
        employee_name: "Employee Name",
        employee_number: "Payroll No",
        gross_pay: "Gross Pay",
        net_pay: "Net Pay",
      },
      organizationId: "org_123",
      payRunId: "run_123",
      sourceFileId: "source_previous_123",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected successful normalization.");
    }

    expect(result.dataset.employeeRunRecords).toHaveLength(6);
    expect(
      result.dataset.employeeRunRecords.every(
        (record) => record.recordScope === "previous",
      ),
    ).toBe(true);
  });

  it("returns explicit validation errors for incomplete rows and invalid numeric values in a mapped file", () => {
    const result = normalizeMappedPayrollCsv({
      clientId: "client_123",
      csvText: readFixture("generic-ie-messy-invalid.csv"),
      datasetRole: "current",
      mapping: {
        employee_external_id: "Worker Ref",
        employee_name: "Full Name",
        employee_number: "Payroll Number",
        gross_pay: "Gross EUR",
        net_pay: "Take Home",
      },
      organizationId: "org_123",
      payRunId: "run_123",
      sourceFileId: "source_invalid_123",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected validation errors.");
    }

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_required_value",
          columnHeader: "Take Home",
          rowNumber: 3,
        }),
        expect.objectContaining({
          code: "invalid_number",
          columnHeader: "Gross EUR",
          rowNumber: 4,
        }),
      ]),
    );
  });

  it("fails clearly when a mapped header is missing from the file or the CSV shape is malformed", () => {
    const missingHeaderResult = normalizeMappedPayrollCsv({
      clientId: "client_123",
      csvText: readFixture("generic-ie-current.csv"),
      datasetRole: "current",
      mapping: {
        employee_name: "Employee Name",
        employee_number: "Payroll No",
        gross_pay: "Gross Pay",
        net_pay: "Net Pay",
        employee_external_id: "Employee Reference",
      },
      organizationId: "org_123",
      payRunId: "run_123",
      sourceFileId: "source_current_123",
    });

    expect(missingHeaderResult.ok).toBe(false);

    if (missingHeaderResult.ok) {
      throw new Error("Expected missing mapped header failure.");
    }

    expect(missingHeaderResult.errors).toEqual([
      expect.objectContaining({
        code: "missing_mapped_header",
        columnHeader: "Employee Reference",
      }),
    ]);

    const malformedCsvResult = normalizeMappedPayrollCsv({
      clientId: "client_123",
      csvText: readFixture("generic-ie-malformed.csv"),
      datasetRole: "previous",
      mapping: {
        employee_external_id: "Employee ID",
        employee_name: "Employee Name",
        employee_number: "Payroll No",
        gross_pay: "Gross Pay",
        net_pay: "Net Pay",
      },
      organizationId: "org_123",
      payRunId: "run_123",
      sourceFileId: "source_malformed_123",
    });

    expect(malformedCsvResult.ok).toBe(false);

    if (malformedCsvResult.ok) {
      throw new Error("Expected malformed CSV failure.");
    }

    expect(malformedCsvResult.errors).toEqual([
      expect.objectContaining({
        code: "malformed_csv",
      }),
    ]);
  });
});
