import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = {
  mappingTemplate: {
    upsert: vi.fn(),
  },
  sourceColumnMapping: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  sourceFile: {
    update: vi.fn(),
  },
};

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  mappingTemplate: {
    findMany: vi.fn(),
  },
  sourceFile: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../lib/prisma", () => ({
  prisma: prismaMock,
}));

import { saveSourceFileMappings } from "../../lib/imports/service";

describe("saveSourceFileMappings", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    prismaMock.mappingTemplate.findMany.mockReset();
    prismaMock.sourceFile.findFirst.mockReset();
    prismaMock.sourceFile.update.mockReset();
    transactionMock.mappingTemplate.upsert.mockReset();
    transactionMock.sourceColumnMapping.createMany.mockReset();
    transactionMock.sourceColumnMapping.deleteMany.mockReset();
    transactionMock.sourceFile.update.mockReset();

    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(transactionMock),
    );
  });

  it("persists file mappings and upserts the reusable template in the client/profile/source-kind scope", async () => {
    prismaMock.sourceFile.findFirst.mockResolvedValue({
      clientId: "client_123",
      id: "source_456",
      kind: "current_payroll",
      previewHeaders: ["Employee ID", "Employee Name", "Gross Pay", "Net Pay"],
      previewStatus: "ready",
    });

    const result = await saveSourceFileMappings({
      clientId: "client_123",
      importProfileKey: "generic_ie_payroll_csv",
      organizationId: "org_123",
      saveTemplate: true,
      sourceFileId: "source_456",
      userId: "user_999",
      values: {
        employee_external_id: "Employee ID",
        employee_name: "Employee Name",
        gross_pay: "Gross Pay",
        net_pay: "Net Pay",
      },
    });

    expect(result).toEqual({
      ok: true,
      templateSaved: true,
    });
    expect(transactionMock.sourceColumnMapping.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: "org_123",
          sourceFileId: "source_456",
          sourceHeader: "Employee ID",
          targetFieldKey: "employee_external_id",
        },
        {
          organizationId: "org_123",
          sourceFileId: "source_456",
          sourceHeader: "Employee Name",
          targetFieldKey: "employee_name",
        },
        {
          organizationId: "org_123",
          sourceFileId: "source_456",
          sourceHeader: "Gross Pay",
          targetFieldKey: "gross_pay",
        },
        {
          organizationId: "org_123",
          sourceFileId: "source_456",
          sourceHeader: "Net Pay",
          targetFieldKey: "net_pay",
        },
      ],
    });
    expect(transactionMock.mappingTemplate.upsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        clientId: "client_123",
        createdByUserId: "user_999",
        importProfileKey: "generic_ie_payroll_csv",
        organizationId: "org_123",
        sourceKind: "current_payroll",
      }),
      update: expect.objectContaining({
        updatedByUserId: "user_999",
      }),
      where: {
        organizationId_clientId_sourceKind_importProfileKey: {
          clientId: "client_123",
          importProfileKey: "generic_ie_payroll_csv",
          organizationId: "org_123",
          sourceKind: "current_payroll",
        },
      },
    });
  });
});
