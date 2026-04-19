import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  approvalEvent: {
    create: vi.fn(),
  },
  employeeMatch: {
    create: vi.fn(),
  },
  employeePayComponent: {
    create: vi.fn(),
  },
  employeeRunRecord: {
    create: vi.fn(),
  },
  exceptionComment: {
    create: vi.fn(),
  },
  reviewException: {
    create: vi.fn(),
  },
  ruleResult: {
    create: vi.fn(),
  },
  sourceRowRef: {
    create: vi.fn(),
  },
}));

vi.mock("../../lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  createApprovalEvent,
  createEmployeeMatch,
  createEmployeePayComponent,
  createEmployeeRunRecord,
  createExceptionComment,
  createReviewException,
  createRuleResult,
  createSourceRowRef,
} from "../../lib/review/service";

describe("canonical reviewer domain persistence", () => {
  beforeEach(() => {
    prismaMock.approvalEvent.create.mockReset();
    prismaMock.employeeMatch.create.mockReset();
    prismaMock.employeePayComponent.create.mockReset();
    prismaMock.employeeRunRecord.create.mockReset();
    prismaMock.exceptionComment.create.mockReset();
    prismaMock.reviewException.create.mockReset();
    prismaMock.ruleResult.create.mockReset();
    prismaMock.sourceRowRef.create.mockReset();
  });

  it("persists an employee-first run record inside the organization, client, pay run, and source file scope", async () => {
    prismaMock.employeeRunRecord.create.mockResolvedValue({
      id: "record_123",
    });

    await createEmployeeRunRecord({
      clientId: "client_123",
      employeeDisplayName: "Aoife Murphy",
      employeeExternalId: "EMP-001",
      grossPay: "4250.15",
      netPay: "3110.44",
      organizationId: "org_123",
      payRunId: "run_123",
      recordScope: "current",
      sourceFileId: "source_123",
    });

    expect(prismaMock.employeeRunRecord.create).toHaveBeenCalledWith({
      data: {
        clientId: "client_123",
        employeeDisplayName: "Aoife Murphy",
        employeeExternalId: "EMP-001",
        grossPay: "4250.15",
        netPay: "3110.44",
        organizationId: "org_123",
        payRunId: "run_123",
        recordScope: "current",
        sourceFileId: "source_123",
      },
    });
  });

  it("persists explainable pay components against the canonical employee record", async () => {
    prismaMock.employeePayComponent.create.mockResolvedValue({
      id: "component_123",
    });

    await createEmployeePayComponent({
      amount: "2500.00",
      category: "earning",
      clientId: "client_123",
      componentCode: "BASIC",
      componentLabel: "Basic salary",
      employeeRunRecordId: "record_123",
      organizationId: "org_123",
      payRunId: "run_123",
      sourceFileId: "source_123",
    });

    expect(prismaMock.employeePayComponent.create).toHaveBeenCalledWith({
      data: {
        amount: "2500.00",
        category: "earning",
        clientId: "client_123",
        componentCode: "BASIC",
        componentLabel: "Basic salary",
        employeeRunRecordId: "record_123",
        organizationId: "org_123",
        payRunId: "run_123",
        sourceFileId: "source_123",
      },
    });
  });

  it("requires source row refs to point at an employee record or pay component target", async () => {
    await expect(
      createSourceRowRef({
        clientId: "client_123",
        organizationId: "org_123",
        payRunId: "run_123",
        rowNumber: 14,
        sourceFileId: "source_123",
      }),
    ).rejects.toThrow(/employee record or pay component/i);
  });

  it("persists source row refs as explicit lineage against a pay component", async () => {
    prismaMock.sourceRowRef.create.mockResolvedValue({
      id: "row_ref_123",
    });

    await createSourceRowRef({
      canonicalFieldKey: "gross_pay",
      clientId: "client_123",
      columnHeader: "Gross Pay",
      columnValue: "4250.15",
      employeePayComponentId: "component_123",
      organizationId: "org_123",
      payRunId: "run_123",
      rowNumber: 14,
      sheetName: "Payroll Export",
      sourceFileId: "source_123",
    });

    expect(prismaMock.sourceRowRef.create).toHaveBeenCalledWith({
      data: {
        canonicalFieldKey: "gross_pay",
        clientId: "client_123",
        columnHeader: "Gross Pay",
        columnValue: "4250.15",
        employeePayComponentId: "component_123",
        employeeRunRecordId: undefined,
        organizationId: "org_123",
        payRunId: "run_123",
        rowNumber: 14,
        sheetName: "Payroll Export",
        sourceFileId: "source_123",
      },
    });
  });

  it("persists employee matches as current-to-previous reviewer links", async () => {
    prismaMock.employeeMatch.create.mockResolvedValue({
      id: "match_123",
    });

    await createEmployeeMatch({
      clientId: "client_123",
      currentEmployeeRunRecordId: "current_record_123",
      matchMethod: "exact_identifier",
      organizationId: "org_123",
      payRunId: "run_123",
      previousEmployeeRunRecordId: "previous_record_123",
    });

    expect(prismaMock.employeeMatch.create).toHaveBeenCalledWith({
      data: {
        clientId: "client_123",
        currentEmployeeRunRecordId: "current_record_123",
        matchMethod: "exact_identifier",
        organizationId: "org_123",
        payRunId: "run_123",
        previousEmployeeRunRecordId: "previous_record_123",
      },
    });
  });

  it("persists immutable rule results without reviewer-state fields", async () => {
    prismaMock.ruleResult.create.mockResolvedValue({
      id: "rule_123",
    });

    await createRuleResult({
      clientId: "client_123",
      employeeMatchId: "match_123",
      employeeRunRecordId: "current_record_123",
      organizationId: "org_123",
      payRunId: "run_123",
      ruleCode: "NET_PAY_VARIANCE",
      ruleMessage: "Net pay moved beyond the review threshold.",
      ruleVersion: "2026-04-19",
      severity: "warning",
    });

    expect(prismaMock.ruleResult.create).toHaveBeenCalledWith({
      data: {
        clientId: "client_123",
        employeeMatchId: "match_123",
        employeeRunRecordId: "current_record_123",
        organizationId: "org_123",
        payRunId: "run_123",
        ruleCode: "NET_PAY_VARIANCE",
        ruleMessage: "Net pay moved beyond the review threshold.",
        ruleVersion: "2026-04-19",
        severity: "warning",
      },
    });

    const createdRuleResult =
      prismaMock.ruleResult.create.mock.calls[0]?.[0]?.data ?? {};

    expect(createdRuleResult).not.toHaveProperty("status");
    expect(createdRuleResult).not.toHaveProperty("resolutionNote");
    expect(createdRuleResult).not.toHaveProperty("resolvedAt");
  });

  it("persists mutable review state separately from the underlying rule result", async () => {
    prismaMock.reviewException.create.mockResolvedValue({
      id: "exception_123",
    });

    await createReviewException({
      assigneeUserId: "user_999",
      clientId: "client_123",
      organizationId: "org_123",
      payRunId: "run_123",
      reviewStatus: "open",
      ruleResultId: "rule_123",
    });

    expect(prismaMock.reviewException.create).toHaveBeenCalledWith({
      data: {
        assigneeUserId: "user_999",
        clientId: "client_123",
        organizationId: "org_123",
        payRunId: "run_123",
        reviewStatus: "open",
        ruleResultId: "rule_123",
      },
    });
  });

  it("persists exception comments and append-only approval events in the same reviewer graph", async () => {
    prismaMock.exceptionComment.create.mockResolvedValue({
      id: "comment_123",
    });
    prismaMock.approvalEvent.create.mockResolvedValue({
      id: "approval_123",
    });

    await createExceptionComment({
      authorUserId: "user_111",
      body: "Waiting on payroll manager confirmation for the employee note.",
      clientId: "client_123",
      organizationId: "org_123",
      payRunId: "run_123",
      reviewExceptionId: "exception_123",
    });
    await createApprovalEvent({
      actorUserId: "user_222",
      clientId: "client_123",
      eventType: "approved",
      organizationId: "org_123",
      payRunId: "run_123",
    });

    expect(prismaMock.exceptionComment.create).toHaveBeenCalledWith({
      data: {
        authorUserId: "user_111",
        body: "Waiting on payroll manager confirmation for the employee note.",
        clientId: "client_123",
        organizationId: "org_123",
        payRunId: "run_123",
        reviewExceptionId: "exception_123",
      },
    });
    expect(prismaMock.approvalEvent.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user_222",
        clientId: "client_123",
        eventType: "approved",
        organizationId: "org_123",
        payRunId: "run_123",
      },
    });
  });
});
