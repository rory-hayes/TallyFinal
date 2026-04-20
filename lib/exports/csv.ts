function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function buildCsv(rows: Array<Record<string, string>>) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map((header) => escapeCsvCell(header)).join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvCell(row[header] ?? "")).join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}
