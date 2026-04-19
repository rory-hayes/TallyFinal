import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";

type ParseSourceFilePreviewInput = {
  bytes: ArrayBuffer | Buffer | Uint8Array;
  contentType?: string;
  filename: string;
};

export type SourceFilePreview = {
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
  sheetName: string;
};

const SAMPLE_ROW_LIMIT = 5;

function normalizeExtension(filename: string) {
  const extension = filename.split(".").pop()?.trim().toLowerCase();
  return extension || "";
}

function asBuffer(bytes: ParseSourceFilePreviewInput["bytes"]) {
  if (Buffer.isBuffer(bytes)) {
    return bytes;
  }

  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes);
  }

  return Buffer.from(bytes);
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function buildPreviewFromRows(rows: string[][]) {
  const [headerRow, ...dataRows] = rows;

  if (!headerRow) {
    throw new Error("The file is empty.");
  }

  const headers = headerRow.map((header) => header.trim());

  if (!headers.length || headers.every((header) => !header)) {
    throw new Error("The file does not contain a usable header row.");
  }

  const sampleRows = dataRows.slice(0, SAMPLE_ROW_LIMIT).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );

  return {
    headers,
    rowCount: dataRows.length,
    sampleRows,
  };
}

function parseCsvPreview(input: ParseSourceFilePreviewInput) {
  try {
    const records = parseCsv(asBuffer(input.bytes), {
      bom: true,
      relax_column_count: false,
      skip_empty_lines: true,
      trim: false,
    }) as string[][];

    return {
      ...buildPreviewFromRows(
        records.map((row) => row.map((value) => normalizeCellValue(value))),
      ),
      sheetName: "CSV",
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

function parseSpreadsheetPreview(input: ParseSourceFilePreviewInput) {
  try {
    const buffer = asBuffer(input.bytes);
    const isZipWorkbook = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
    const isLegacyWorkbook =
      buffer.length >= 8 &&
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0 &&
      buffer[4] === 0xa1 &&
      buffer[5] === 0xb1 &&
      buffer[6] === 0x1a &&
      buffer[7] === 0xe1;

    if (!isZipWorkbook && !isLegacyWorkbook) {
      throw new Error("The uploaded spreadsheet is not a valid XLSX workbook.");
    }

    const workbook = XLSX.read(buffer, {
      cellDates: false,
      dense: false,
      raw: false,
      type: "buffer",
    });

    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new Error("The workbook does not contain any sheets.");
    }

    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      throw new Error("The workbook sheet could not be read.");
    }

    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
      worksheet,
      {
        blankrows: false,
        defval: "",
        header: 1,
        raw: false,
      },
    );

    return {
      ...buildPreviewFromRows(
        rows.map((row) => row.map((value) => normalizeCellValue(value))),
      ),
      sheetName: firstSheetName,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `The XLSX workbook could not be read: ${error.message}`
        : "The XLSX workbook could not be read.",
    );
  }
}

export async function parseSourceFilePreview(
  input: ParseSourceFilePreviewInput,
): Promise<SourceFilePreview> {
  const extension = normalizeExtension(input.filename);

  if (extension === "csv" || extension === "txt") {
    return parseCsvPreview(input);
  }

  if (extension === "xlsx" || extension === "xls") {
    return parseSpreadsheetPreview(input);
  }

  if (input.contentType?.includes("csv")) {
    return parseCsvPreview(input);
  }

  throw new Error(
    "Unsupported file type. Upload a CSV or XLSX file for preview and mapping.",
  );
}
