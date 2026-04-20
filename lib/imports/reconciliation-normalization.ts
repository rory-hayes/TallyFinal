import { parse as parseCsv } from "csv-parse/sync";

import type { FieldMappingValues } from "@/lib/imports/mapping";

export type ReconciliationNormalizationErrorCode =
  | "invalid_number"
  | "malformed_csv"
  | "missing_mapped_header"
  | "missing_required_value";

export type ReconciliationNormalizationError = {
  code: ReconciliationNormalizationErrorCode;
  columnHeader?: string;
  fieldKey?: string;
  message: string;
  rowNumber?: number;
};

export type NormalizedJournalEntry = {
  accountCode: string;
  amount: string;
  clientId: string;
  entryDate: string;
  entryDescription: string;
  organizationId: string;
  payRunId: string;
  rowNumber: number;
  sourceFileId: string;
};

export type NormalizedPaymentRecord = {
  clientId: string;
  employeeExternalId: string;
  employeeName: string;
  organizationId: string;
  payRunId: string;
  paymentAmount: string;
  paymentDate?: string;
  paymentReference?: string;
  rowNumber: number;
  sourceFileId: string;
};

type ParsedCsvTable = {
  headers: string[];
  rows: string[][];
};

type NormalizeMappedJournalCsvInput = {
  clientId: string;
  csvText: string;
  mapping: FieldMappingValues;
  organizationId: string;
  payRunId: string;
  sourceFileId: string;
};

type NormalizeMappedPaymentCsvInput = {
  clientId: string;
  csvText: string;
  mapping: FieldMappingValues;
  organizationId: string;
  payRunId: string;
  sourceFileId: string;
};

type JournalNormalizationResult =
  | {
      entries: NormalizedJournalEntry[];
      ok: true;
    }
  | {
      errors: ReconciliationNormalizationError[];
      ok: false;
    };

type PaymentNormalizationResult =
  | {
      ok: true;
      records: NormalizedPaymentRecord[];
    }
  | {
      errors: ReconciliationNormalizationError[];
      ok: false;
    };

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

function buildRowLookup(headers: string[], row: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
}

function asOptionalString(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : undefined;
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

  return (isNegative ? -1 * Math.abs(parsed) : parsed).toFixed(2);
}

function validateMappedHeaders(
  headers: string[],
  mapping: FieldMappingValues,
): ReconciliationNormalizationError[] {
  const mappedEntries = Object.entries(mapping).filter(([, header]) => header?.trim());
  const headerSet = new Set(headers);

  return mappedEntries
    .filter(([, header]) => !headerSet.has(header))
    .map(([, header]) => ({
      code: "missing_mapped_header" as const,
      columnHeader: header,
      message: `Mapped header "${header}" is not present in the file.`,
    }));
}

export function normalizeMappedJournalCsv(
  input: NormalizeMappedJournalCsvInput,
): JournalNormalizationResult {
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

  const missingMappedHeaders = validateMappedHeaders(parsedTable.headers, input.mapping);

  if (missingMappedHeaders.length) {
    return {
      errors: missingMappedHeaders,
      ok: false,
    };
  }

  const errors: ReconciliationNormalizationError[] = [];
  const entries: NormalizedJournalEntry[] = [];

  parsedTable.rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const valuesByHeader = buildRowLookup(parsedTable.headers, row);
    const entryDateHeader = input.mapping.entry_date;
    const accountCodeHeader = input.mapping.account_code;
    const entryDescriptionHeader = input.mapping.entry_description;
    const amountHeader = input.mapping.amount;
    const entryDate = entryDateHeader ? valuesByHeader[entryDateHeader] ?? "" : "";
    const accountCode = accountCodeHeader ? valuesByHeader[accountCodeHeader] ?? "" : "";
    const entryDescription = entryDescriptionHeader
      ? valuesByHeader[entryDescriptionHeader] ?? ""
      : "";
    const amountValue = amountHeader ? valuesByHeader[amountHeader] ?? "" : "";

    if (!entryDate.trim()) {
      errors.push({
        code: "missing_required_value",
        columnHeader: entryDateHeader,
        fieldKey: "entry_date",
        message: "Entry date is required for journal normalization.",
        rowNumber,
      });
    }

    if (!accountCode.trim()) {
      errors.push({
        code: "missing_required_value",
        columnHeader: accountCodeHeader,
        fieldKey: "account_code",
        message: "Account code is required for journal normalization.",
        rowNumber,
      });
    }

    if (!entryDescription.trim()) {
      errors.push({
        code: "missing_required_value",
        columnHeader: entryDescriptionHeader,
        fieldKey: "entry_description",
        message: "Description is required for journal normalization.",
        rowNumber,
      });
    }

    const parsedAmount = parseDecimalString(amountValue);

    if (parsedAmount === null) {
      errors.push({
        code: "invalid_number",
        columnHeader: amountHeader,
        fieldKey: "amount",
        message: "Amount must be a valid signed decimal value.",
        rowNumber,
      });
      return;
    }

    if (
      !entryDate.trim() ||
      !accountCode.trim() ||
      !entryDescription.trim()
    ) {
      return;
    }

    entries.push({
      accountCode: accountCode.trim(),
      amount: parsedAmount,
      clientId: input.clientId,
      entryDate: entryDate.trim(),
      entryDescription: entryDescription.trim(),
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      rowNumber,
      sourceFileId: input.sourceFileId,
    });
  });

  if (errors.length) {
    return {
      errors,
      ok: false,
    };
  }

  return {
    entries,
    ok: true,
  };
}

export function normalizeMappedPaymentCsv(
  input: NormalizeMappedPaymentCsvInput,
): PaymentNormalizationResult {
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

  const missingMappedHeaders = validateMappedHeaders(parsedTable.headers, input.mapping);

  if (missingMappedHeaders.length) {
    return {
      errors: missingMappedHeaders,
      ok: false,
    };
  }

  const errors: ReconciliationNormalizationError[] = [];
  const records: NormalizedPaymentRecord[] = [];

  parsedTable.rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const valuesByHeader = buildRowLookup(parsedTable.headers, row);
    const employeeExternalIdHeader = input.mapping.employee_external_id;
    const employeeNameHeader = input.mapping.employee_name;
    const paymentAmountHeader = input.mapping.payment_amount;
    const paymentReferenceHeader = input.mapping.payment_reference;
    const paymentDateHeader = input.mapping.payment_date;
    const employeeExternalId = employeeExternalIdHeader
      ? valuesByHeader[employeeExternalIdHeader] ?? ""
      : "";
    const employeeName = employeeNameHeader
      ? valuesByHeader[employeeNameHeader] ?? ""
      : "";
    const paymentAmountValue = paymentAmountHeader
      ? valuesByHeader[paymentAmountHeader] ?? ""
      : "";
    const parsedAmount = parseDecimalString(paymentAmountValue);

    if (!employeeExternalId.trim()) {
      errors.push({
        code: "missing_required_value",
        columnHeader: employeeExternalIdHeader,
        fieldKey: "employee_external_id",
        message: "Employee ID is required for payment normalization.",
        rowNumber,
      });
    }

    if (!employeeName.trim()) {
      errors.push({
        code: "missing_required_value",
        columnHeader: employeeNameHeader,
        fieldKey: "employee_name",
        message: "Employee name is required for payment normalization.",
        rowNumber,
      });
    }

    if (parsedAmount === null) {
      errors.push({
        code: "invalid_number",
        columnHeader: paymentAmountHeader,
        fieldKey: "payment_amount",
        message: "Payment amount must be a valid decimal value.",
        rowNumber,
      });
      return;
    }

    if (!employeeExternalId.trim() || !employeeName.trim()) {
      return;
    }

    records.push({
      clientId: input.clientId,
      employeeExternalId: employeeExternalId.trim(),
      employeeName: employeeName.trim(),
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      paymentAmount: parsedAmount,
      paymentDate: asOptionalString(
        paymentDateHeader ? valuesByHeader[paymentDateHeader] : undefined,
      ),
      paymentReference: asOptionalString(
        paymentReferenceHeader ? valuesByHeader[paymentReferenceHeader] : undefined,
      ),
      rowNumber,
      sourceFileId: input.sourceFileId,
    });
  });

  if (errors.length) {
    return {
      errors,
      ok: false,
    };
  }

  return {
    ok: true,
    records,
  };
}
