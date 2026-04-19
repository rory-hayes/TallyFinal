import { describe, expect, it } from "vitest";

import {
  buildSourceStoragePath,
  createNextSourceFileLineage,
  type SourceFileLineageCandidate,
} from "../../lib/pay-runs/source-files";

const existingFiles: SourceFileLineageCandidate[] = [
  {
    id: "file_current_v1",
    kind: "current_payroll",
    version: 1,
  },
  {
    id: "file_current_v2",
    kind: "current_payroll",
    version: 2,
  },
  {
    id: "file_previous_v1",
    kind: "previous_payroll",
    version: 1,
  },
];

describe("createNextSourceFileLineage", () => {
  it("increments the version for the same source kind and links replacements", () => {
    expect(
      createNextSourceFileLineage(existingFiles, "current_payroll"),
    ).toEqual({
      replacementOfId: "file_current_v2",
      version: 3,
    });
  });

  it("starts at version one when no prior file exists for the kind", () => {
    expect(createNextSourceFileLineage(existingFiles, "journal")).toEqual({
      replacementOfId: null,
      version: 1,
    });
  });
});

describe("buildSourceStoragePath", () => {
  it("creates a stable tenant-scoped path with versioned filenames", () => {
    expect(
      buildSourceStoragePath({
        organizationId: "org_123",
        clientId: "client_456",
        payRunId: "run_789",
        kind: "current_payroll",
        version: 2,
        originalFilename: "April Payroll (Final).CSV",
      }),
    ).toBe(
      "organizations/org_123/clients/client_456/pay-runs/run_789/current-payroll/v2-april-payroll-final.csv",
    );
  });

  it("falls back to a safe name when the uploaded filename is mostly punctuation", () => {
    expect(
      buildSourceStoragePath({
        organizationId: "org_123",
        clientId: "client_456",
        payRunId: "run_789",
        kind: "payment",
        version: 1,
        originalFilename: "%%%!!!",
      }),
    ).toBe(
      "organizations/org_123/clients/client_456/pay-runs/run_789/payment/v1-upload",
    );
  });
});
