import { parse as parseCsv } from "csv-parse/sync";

import type { FieldMappingValues } from "@/lib/imports/mapping";

export type PayrollDatasetRole = "current" | "previous";

export type PayrollNormalizationErrorCode =
  | "invalid_number"
  | "malformed_csv"
  | "missing_mapped_header"
  | "missing_required_value";

export type PayrollNormalizationError = {
  code: PayrollNormalizationErrorCode;
  columnHeader?: string;
  fieldKey?: string;
  message: string;
  rowNumber?: number;
};

export type NormalizedEmployeeRunRecord = {
  clientId: string;
  employeeDisplayName: string;
  employeeExternalId?: string;
  employeeNumber?: string;
  grossPay: string;
  netPay: string;
  organizationId: string;
  payRunId: string;
  recordKey: string;
  recordScope: PayrollDatasetRole;
  rowNumber: number;
  sourceFileId: string;
};

export type NormalizedEmployeePayComponent = {
  amount: string;
  category: "deduction" | "earning" | "employer_cost" | "other";
  clientId: string;
  componentCode: string;
  componentKey: string;
  componentLabel: string;
  employeeRunRecordKey: string;
  organizationId: string;
  payRunId: string;
  rowNumber: number;
  sourceFileId: string;
};

export type NormalizedSourceRowRef = {
  canonicalFieldKey: string;
  clientId: string;
  columnHeader: string;
  columnValue: string;
  employeePayComponentKey?: string;
  employeeRunRecordKey?: string;
  organizationId: string;
  payRunId: string;
  rowNumber: number;
  sheetName: string | null;
  sourceFileId: string;
};

export type NormalizedPayrollDataset = {
  datasetRole: PayrollDatasetRole;
  employeePayComponents: NormalizedEmployeePayComponent[];
  employeeRunRecords: NormalizedEmployeeRunRecord[];
  sourceRowRefs: NormalizedSourceRowRef[];
};

type NormalizeMappedPayrollCsvInput = {
  clientId: string;
  csvText: string;
  datasetRole: PayrollDatasetRole;
  mapping: FieldMappingValues;
  organizationId: string;
  payRunId: string;
  sheetName?: string;
  sourceFileId: string;
};

type NormalizeMappedPayrollCsvResult =
  | {
      dataset: NormalizedPayrollDataset;
      ok: true;
    }
  | {
      errors: PayrollNormalizationError[];
      ok: false;
    };

type ParsedCsvTable = {
  headers: string[];
  rows: string[][];
};

const REQUIRED_FIELD_KEYS = ["employee_name", "gross_pay", "net_pay"] as const;
function asOptionalString(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : undefined;
}

function normalizeNameKey(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function slugifyHeader(value: string) {
  const slug = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug.length ? slug : "PAY_COMPONENT";
}

function parseCsvTable(csvText: string): ParsedCsvTable {
  try {
    const records = parseCsv(csvText, {
      bom: true,
      relax_column_count: false,
      skip_empty_lines: true,
      trim: false,
    }) as string[][];

    const [headerRow, ...rows] = records;

    if (!headerRow) {
      throw new Error("The file is empty.");
    }

    const headers = headerRow.map((header) => String(header ?? "").trim());

    if (!headers.length || headers.every((header) => !header)) {
      throw new Error("The file does not contain a usable header row.");
    }

    return {
      headers,
      rows: rows.map((row) => row.map((value) => String(value ?? "").trim())),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      /Invalid Record Length|record length|columns length/i.test(error.message)
    ) {
      const lineMatch = error.message.match(/line (\d+)/i);
      const lineSuffix = lineMatch ? ` on line ${lineMatch[1]}` : "";
      throw new Error(`Malformed CSV: inconsistent column count${lineSuffix}.`);
    }

    throw new Error(
      error instanceof Error ? `Malformed CSV: ${error.message}` : "Malformed CSV.",
    );
  }
}

function parseDecimalString(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const isNegative = /^\(.*\)$/.test(trimmed);
  const numericValue = trimmed
    .replace(/^\((.*)\)$/, "$1")
    .replace(/[,\s€]/g, "");

  if (!/^-?\d+(\.\d+)?$/.test(numericValue)) {
    return null;
  }

  const parsed = Number.parseFloat(numericValue);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return `${isNegative ? -1 * Math.abs(parsed) : parsed}`.replace(/^-0$/, "0");
}

function formatMoney(value: string) {
  return Number.parseFloat(value).toFixed(2);
}

function inferComponentCategory(
  header: string,
  amount: string,
): "deduction" | "earning" | "employer_cost" | "other" {
  const normalizedHeader = header.trim().toLowerCase();

  if (/employer|ers|company/.test(normalizedHeader)) {
    return "employer_cost";
  }

  if (
    /paye|usc|prsi|pension|deduction|tax|levy/.test(normalizedHeader) ||
    Number.parseFloat(amount) < 0
  ) {
    return "deduction";
  }

  if (Number.parseFloat(amount) >= 0) {
    return "earning";
  }

  return "other";
}

function buildRowLookup(headers: string[], row: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
}

export function normalizeMappedPayrollCsv(
  input: NormalizeMappedPayrollCsvInput,
): NormalizeMappedPayrollCsvResult {
  let parsedTable: ParsedCsvTable;

  try {
    parsedTable = parseCsvTable(input.csvText);
  } catch (error) {
    return {
      errors: [
        {
          code: "malformed_csv",
          message:
            error instanceof Error ? error.message : "Malformed CSV input.",
        },
      ],
      ok: false,
    };
  }

  const mappedEntries = Object.entries(input.mapping).filter(([, header]) => header?.trim());
  const headerSet = new Set(parsedTable.headers);
  const missingMappedHeaders = mappedEntries
    .filter(([, header]) => !headerSet.has(header))
    .map(([, header]) => ({
      code: "missing_mapped_header" as const,
      columnHeader: header,
      message: `Mapped header "${header}" is not present in the file.`,
    }));

  if (missingMappedHeaders.length) {
    return {
      errors: missingMappedHeaders,
      ok: false,
    };
  }

  const mappedHeaders = new Set(mappedEntries.map(([, header]) => header));
  const validationErrors: PayrollNormalizationError[] = [];
  const employeeRunRecords: NormalizedEmployeeRunRecord[] = [];
  const employeePayComponents: NormalizedEmployeePayComponent[] = [];
  const sourceRowRefs: NormalizedSourceRowRef[] = [];

  parsedTable.rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const valuesByHeader = buildRowLookup(parsedTable.headers, row);
    const getValue = (fieldKey: string) => {
      const header = input.mapping[fieldKey];
      return header ? valuesByHeader[header]?.trim() ?? "" : "";
    };

    for (const fieldKey of REQUIRED_FIELD_KEYS) {
      const value = getValue(fieldKey);

      if (!value) {
        validationErrors.push({
          code: "missing_required_value",
          columnHeader: input.mapping[fieldKey],
          fieldKey,
          message: `Row ${rowNumber} is missing ${fieldKey}.`,
          rowNumber,
        });
      }
    }

    const grossPay = getValue("gross_pay");
    const netPay = getValue("net_pay");
    const parsedGrossPay = grossPay ? parseDecimalString(grossPay) : null;
    const parsedNetPay = netPay ? parseDecimalString(netPay) : null;

    if (grossPay && parsedGrossPay === null) {
      validationErrors.push({
        code: "invalid_number",
        columnHeader: input.mapping.gross_pay,
        fieldKey: "gross_pay",
        message: `Row ${rowNumber} contains an invalid gross pay amount.`,
        rowNumber,
      });
    }

    if (netPay && parsedNetPay === null) {
      validationErrors.push({
        code: "invalid_number",
        columnHeader: input.mapping.net_pay,
        fieldKey: "net_pay",
        message: `Row ${rowNumber} contains an invalid net pay amount.`,
        rowNumber,
      });
    }

    if (!normalizeNameKey(getValue("employee_name")) || parsedGrossPay === null || parsedNetPay === null) {
      return;
    }

    const recordKey = `${input.datasetRole}:${input.sourceFileId}:${rowNumber}`;
    const employeeRunRecord: NormalizedEmployeeRunRecord = {
      clientId: input.clientId,
      employeeDisplayName: normalizeNameKey(getValue("employee_name")),
      employeeExternalId: asOptionalString(getValue("employee_external_id")),
      employeeNumber: asOptionalString(getValue("employee_number")),
      grossPay: formatMoney(parsedGrossPay),
      netPay: formatMoney(parsedNetPay),
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      recordKey,
      recordScope: input.datasetRole,
      rowNumber,
      sourceFileId: input.sourceFileId,
    };

    employeeRunRecords.push(employeeRunRecord);

    const recordFieldKeys = [
      "employee_external_id",
      "employee_number",
      "employee_name",
      "gross_pay",
      "net_pay",
    ] as const;

    recordFieldKeys.forEach((fieldKey) => {
      const header = input.mapping[fieldKey];
      const value = getValue(fieldKey);

      if (!header || !value) {
        return;
      }

      sourceRowRefs.push({
        canonicalFieldKey: fieldKey,
        clientId: input.clientId,
        columnHeader: header,
        columnValue: value,
        employeeRunRecordKey: recordKey,
        organizationId: input.organizationId,
        payRunId: input.payRunId,
        rowNumber,
        sheetName: input.sheetName ?? "CSV",
        sourceFileId: input.sourceFileId,
      });
    });

    parsedTable.headers.forEach((header) => {
      if (mappedHeaders.has(header)) {
        return;
      }

      const rawValue = valuesByHeader[header]?.trim() ?? "";

      if (!rawValue) {
        return;
      }

      const parsedAmount = parseDecimalString(rawValue);

      if (parsedAmount === null) {
        return;
      }

      const componentCode = slugifyHeader(header);
      const componentKey = `${recordKey}:component:${componentCode}`;

      employeePayComponents.push({
        amount: formatMoney(parsedAmount),
        category: inferComponentCategory(header, parsedAmount),
        clientId: input.clientId,
        componentCode,
        componentKey,
        componentLabel: header,
        employeeRunRecordKey: recordKey,
        organizationId: input.organizationId,
        payRunId: input.payRunId,
        rowNumber,
        sourceFileId: input.sourceFileId,
      });

      sourceRowRefs.push({
        canonicalFieldKey: `pay_component:${componentCode}`,
        clientId: input.clientId,
        columnHeader: header,
        columnValue: rawValue,
        employeePayComponentKey: componentKey,
        organizationId: input.organizationId,
        payRunId: input.payRunId,
        rowNumber,
        sheetName: input.sheetName ?? "CSV",
        sourceFileId: input.sourceFileId,
      });
    });
  });

  if (validationErrors.length) {
    return {
      errors: validationErrors,
      ok: false,
    };
  }

  return {
    dataset: {
      datasetRole: input.datasetRole,
      employeePayComponents,
      employeeRunRecords,
      sourceRowRefs,
    },
    ok: true,
  };
}
