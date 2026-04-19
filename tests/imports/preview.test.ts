import { describe, expect, it } from "vitest";

import { parseSourceFilePreview } from "../../lib/imports/preview";

describe("parseSourceFilePreview", () => {
  it("fails loudly for malformed CSV files with inconsistent columns", async () => {
    await expect(
      parseSourceFilePreview({
        bytes: Buffer.from("Employee ID,Name,Gross Pay\nE001,Aoife,4200\nE002,Bran"),
        contentType: "text/csv",
        filename: "broken-payroll.csv",
      }),
    ).rejects.toThrow(/line 3/i);
  });

  it("fails loudly for unreadable XLSX files", async () => {
    await expect(
      parseSourceFilePreview({
        bytes: Buffer.from("not a workbook"),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: "broken.xlsx",
      }),
    ).rejects.toThrow(/could not be read/i);
  });
});
