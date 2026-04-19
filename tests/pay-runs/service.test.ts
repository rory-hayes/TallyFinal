import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  payRun: {
    create: vi.fn(),
  },
  sourceFile: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  createPayRunForClient,
  registerSourceFileForPayRun,
} from "../../lib/pay-runs/service";

describe("createPayRunForClient", () => {
  beforeEach(() => {
    prismaMock.payRun.create.mockReset();
  });

  it("persists a draft pay run inside the organization and client scope", async () => {
    prismaMock.payRun.create.mockResolvedValue({
      id: "run_123",
      title: "April 2026 payroll",
    });

    await createPayRunForClient({
      organizationId: "org_123",
      clientId: "client_456",
      createdByUserId: "user_789",
      title: "April 2026 payroll",
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-04-30T00:00:00.000Z"),
      payDate: new Date("2026-04-30T00:00:00.000Z"),
    });

    expect(prismaMock.payRun.create).toHaveBeenCalledWith({
      data: {
        clientId: "client_456",
        createdByUserId: "user_789",
        organizationId: "org_123",
        payDate: new Date("2026-04-30T00:00:00.000Z"),
        periodEnd: new Date("2026-04-30T00:00:00.000Z"),
        periodStart: new Date("2026-04-01T00:00:00.000Z"),
        status: "draft",
        title: "April 2026 payroll",
        updatedByUserId: "user_789",
      },
    });
  });
});

describe("registerSourceFileForPayRun", () => {
  beforeEach(() => {
    prismaMock.sourceFile.create.mockReset();
    prismaMock.sourceFile.findMany.mockReset();
    prismaMock.sourceFile.update.mockReset();
  });

  it("persists the first file version with lineage-ready metadata", async () => {
    prismaMock.sourceFile.findMany.mockResolvedValue([]);
    prismaMock.sourceFile.create.mockResolvedValue({
      id: "source_123",
      version: 1,
    });

    await registerSourceFileForPayRun({
      organizationId: "org_123",
      clientId: "client_456",
      payRunId: "run_789",
      uploadedByUserId: "user_999",
      kind: "current_payroll",
      originalFilename: "Current Payroll.csv",
      contentType: "text/csv",
      byteSize: 4096,
      checksumSha256: "abc123",
      storageBucket: "tally-source-files",
    });

    expect(prismaMock.sourceFile.create).toHaveBeenCalledWith({
      data: {
        byteSize: 4096,
        checksumSha256: "abc123",
        clientId: "client_456",
        contentType: "text/csv",
        kind: "current_payroll",
        organizationId: "org_123",
        originalFilename: "Current Payroll.csv",
        payRunId: "run_789",
        replacementOfId: null,
        status: "registered",
        storageBucket: "tally-source-files",
        storagePath:
          "organizations/org_123/clients/client_456/pay-runs/run_789/current-payroll/v1-current-payroll.csv",
        uploadedByUserId: "user_999",
        version: 1,
      },
    });
  });

  it("increments the version and links the replacement chain for repeated uploads", async () => {
    prismaMock.sourceFile.findMany.mockResolvedValue([
      {
        id: "source_prev",
        kind: "current_payroll",
        version: 1,
      },
    ]);
    prismaMock.sourceFile.create.mockResolvedValue({
      id: "source_new",
      version: 2,
    });

    await registerSourceFileForPayRun({
      organizationId: "org_123",
      clientId: "client_456",
      payRunId: "run_789",
      uploadedByUserId: "user_999",
      kind: "current_payroll",
      originalFilename: "Current Payroll.csv",
      contentType: "text/csv",
      byteSize: 4096,
      checksumSha256: "def456",
      storageBucket: "tally-source-files",
    });

    expect(prismaMock.sourceFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        replacementOfId: "source_prev",
        version: 2,
      }),
    });
  });
});
