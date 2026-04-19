import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = {
  exceptionComment: {
    create: vi.fn(),
  },
  reviewException: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  ruleResult: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
};

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  exceptionComment: {
    create: vi.fn(),
  },
  reviewException: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  ruleResult: {
    findMany: vi.fn(),
  },
}));

vi.mock("../../lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  addReviewExceptionComment,
  bulkSetReviewExceptionStatus,
  listReviewExceptions,
  materializeRuleResultsAndExceptions,
} from "../../lib/review/exceptions";

describe("review exception lifecycle", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    prismaMock.exceptionComment.create.mockReset();
    prismaMock.reviewException.findFirst.mockReset();
    prismaMock.reviewException.findMany.mockReset();
    prismaMock.ruleResult.findMany.mockReset();
    transactionMock.exceptionComment.create.mockReset();
    transactionMock.reviewException.create.mockReset();
    transactionMock.reviewException.findMany.mockReset();
    transactionMock.reviewException.update.mockReset();
    transactionMock.ruleResult.create.mockReset();
    transactionMock.ruleResult.findMany.mockReset();

    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(transactionMock),
    );
  });

  it("materializes immutable failed rule results and derives review exceptions once per new finding", async () => {
    transactionMock.ruleResult.findMany.mockResolvedValue([
      {
        employeeMatchId: null,
        employeePayComponentId: null,
        employeeRunRecordId: "record_existing",
        ruleCode: "NET_VARIANCE_THRESHOLD",
        ruleVersion: "2026-04-19",
      },
    ]);
    transactionMock.ruleResult.create.mockResolvedValueOnce({
      id: "rule_new_1",
    });
    transactionMock.ruleResult.create.mockResolvedValueOnce({
      id: "rule_new_2",
    });

    const result = await materializeRuleResultsAndExceptions({
      clientId: "client_123",
      findings: [
        {
          details: { deltaAmount: "100.00" },
          employeeDisplayName: "Aoife Murphy",
          employeeMatchId: "match_new",
          employeeRunRecordId: "record_aoife",
          ruleCode: "GROSS_VARIANCE_THRESHOLD",
          ruleMessage: "Gross pay changed beyond the deterministic threshold.",
          ruleVersion: "2026-04-19",
          severity: "warning",
        },
        {
          details: { deltaAmount: "55.00" },
          employeeDisplayName: "Brian Kelly",
          employeeRunRecordId: "record_existing",
          ruleCode: "NET_VARIANCE_THRESHOLD",
          ruleMessage: "Net pay changed beyond the deterministic threshold.",
          ruleVersion: "2026-04-19",
          severity: "warning",
        },
        {
          details: { deltaAmount: "0.00" },
          employeeDisplayName: "Eve New",
          employeeRunRecordId: "record_eve",
          ruleCode: "ZERO_PAY_ANOMALY",
          ruleMessage: "Zero pay requires reviewer confirmation.",
          ruleVersion: "2026-04-19",
          severity: "blocker",
        },
      ],
      organizationId: "org_123",
      payRunId: "run_123",
    });

    expect(result).toEqual({
      createdExceptionCount: 2,
      createdRuleResultCount: 2,
      skippedExistingRuleResultCount: 1,
    });
    expect(transactionMock.ruleResult.create).toHaveBeenCalledTimes(2);
    expect(transactionMock.reviewException.create).toHaveBeenCalledTimes(2);
    expect(transactionMock.ruleResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        details: { deltaAmount: "100.00" },
        employeeMatchId: "match_new",
        employeeRunRecordId: "record_aoife",
        ruleCode: "GROSS_VARIANCE_THRESHOLD",
        severity: "warning",
      }),
    });
  });

  it("lists review exceptions with deterministic filters over severity, status, employee, and rule code", async () => {
    prismaMock.reviewException.findMany.mockResolvedValue([]);

    await listReviewExceptions({
      clientId: "client_123",
      employee: "Aoife",
      organizationId: "org_123",
      payRunId: "run_123",
      ruleCode: "GROSS_VARIANCE_THRESHOLD",
      severity: "warning",
      status: "open",
    });

    expect(prismaMock.reviewException.findMany).toHaveBeenCalledWith({
      include: expect.objectContaining({
        comments: expect.any(Object),
        ruleResult: expect.any(Object),
      }),
      orderBy: [{ createdAt: "desc" }],
      where: {
        clientId: "client_123",
        organizationId: "org_123",
        payRunId: "run_123",
        reviewStatus: "open",
        ruleResult: {
          employeeRunRecord: {
            OR: [
              {
                employeeDisplayName: {
                  contains: "Aoife",
                  mode: "insensitive",
                },
              },
              {
                employeeExternalId: {
                  contains: "Aoife",
                  mode: "insensitive",
                },
              },
              {
                employeeNumber: {
                  contains: "Aoife",
                  mode: "insensitive",
                },
              },
            ],
          },
          ruleCode: "GROSS_VARIANCE_THRESHOLD",
          severity: "warning",
        },
      },
    });
  });

  it("bulk resolves or dismisses exceptions and writes append-only audit comments for state changes", async () => {
    transactionMock.reviewException.findMany.mockResolvedValue([
      {
        id: "exception_1",
        reviewStatus: "open",
      },
      {
        id: "exception_2",
        reviewStatus: "in_review",
      },
      {
        id: "exception_3",
        reviewStatus: "resolved",
      },
    ]);
    transactionMock.reviewException.update.mockResolvedValue({});
    transactionMock.exceptionComment.create.mockResolvedValue({});

    const result = await bulkSetReviewExceptionStatus({
      action: "resolve",
      actorUserId: "user_123",
      clientId: "client_123",
      exceptionIds: ["exception_1", "exception_2", "exception_3"],
      note: "Reviewed against source evidence.",
      organizationId: "org_123",
      payRunId: "run_123",
    });

    expect(result).toEqual({
      skippedExceptionIds: ["exception_3"],
      updatedExceptionCount: 2,
    });
    expect(transactionMock.reviewException.update).toHaveBeenCalledTimes(2);
    expect(transactionMock.exceptionComment.create).toHaveBeenCalledTimes(2);
    expect(transactionMock.exceptionComment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        authorUserId: "user_123",
        body: "Exception status changed from open to resolved. Reviewed against source evidence.",
        commentType: "audit_log",
        metadata: {
          action: "resolve",
          fromStatus: "open",
          note: "Reviewed against source evidence.",
          toStatus: "resolved",
        },
      }),
    });
  });

  it("adds reviewer comments without mutating rule results or exception status", async () => {
    prismaMock.reviewException.findFirst.mockResolvedValue({
      id: "exception_123",
    });
    prismaMock.exceptionComment.create.mockResolvedValue({
      id: "comment_123",
    });

    await addReviewExceptionComment({
      authorUserId: "user_123",
      body: "Confirmed with payroll manager.",
      clientId: "client_123",
      organizationId: "org_123",
      payRunId: "run_123",
      reviewExceptionId: "exception_123",
    });

    expect(prismaMock.exceptionComment.create).toHaveBeenCalledWith({
      data: {
        authorUserId: "user_123",
        body: "Confirmed with payroll manager.",
        clientId: "client_123",
        commentType: "comment",
        metadata: undefined,
        organizationId: "org_123",
        payRunId: "run_123",
        reviewExceptionId: "exception_123",
      },
    });
  });

  it("rejects comments for exceptions outside the declared tenant/pay-run scope", async () => {
    prismaMock.reviewException.findFirst.mockResolvedValue(null);

    await expect(
      addReviewExceptionComment({
        authorUserId: "user_123",
        body: "This should not be allowed.",
        clientId: "client_123",
        organizationId: "org_123",
        payRunId: "run_123",
        reviewExceptionId: "exception_missing",
      }),
    ).rejects.toThrow(/access denied/i);
  });
});
