import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  approvalEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  payRun: {
    findFirst: vi.fn(),
  },
  reviewException: {
    count: vi.fn(),
  },
}));

vi.mock("../../lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  getPayRunApprovalSummary,
  recordPayRunApprovalEvent,
} from "../../lib/review/approval";

describe("pay run approval workflow", () => {
  beforeEach(() => {
    prismaMock.approvalEvent.create.mockReset();
    prismaMock.approvalEvent.findMany.mockReset();
    prismaMock.payRun.findFirst.mockReset();
    prismaMock.reviewException.count.mockReset();
    prismaMock.approvalEvent.findMany.mockResolvedValue([]);
    prismaMock.payRun.findFirst.mockResolvedValue({
      activeReviewSnapshotVersion: 2,
    });
  });

  it("summarizes approval state and blocker gating from immutable events plus mutable exception state", async () => {
    prismaMock.reviewException.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);
    prismaMock.approvalEvent.findMany.mockResolvedValue([
      {
        actorUserId: "reviewer_1",
        createdAt: new Date("2026-04-20T10:00:00.000Z"),
        eventType: "submitted",
        id: "event_1",
        note: "Ready for approver review.",
        reviewSnapshotVersion: 2,
      },
    ]);

    const summary = await getPayRunApprovalSummary({
      clientId: "client_123",
      organizationId: "org_123",
      payRunId: "run_123",
    });

    expect(summary).toMatchObject({
      activeExceptionCount: 4,
      blockingExceptionCount: 1,
      currentState: "submitted",
      latestEvent: {
        eventType: "submitted",
      },
    });
    expect(prismaMock.reviewException.count).toHaveBeenNthCalledWith(1, {
      where: {
        clientId: "client_123",
        organizationId: "org_123",
        payRunId: "run_123",
        reviewStatus: {
          in: ["open", "in_review"],
        },
        ruleResult: {
          employeeRunRecord: {
            reviewSnapshotVersion: 2,
          },
        },
      },
    });
    expect(prismaMock.reviewException.count).toHaveBeenNthCalledWith(2, {
      where: {
        clientId: "client_123",
        organizationId: "org_123",
        payRunId: "run_123",
        reviewStatus: {
          in: ["open", "in_review"],
        },
        ruleResult: {
          employeeRunRecord: {
            reviewSnapshotVersion: 2,
          },
          severity: "blocker",
        },
      },
    });
  });

  it("blocks approval when unresolved blocker exceptions remain", async () => {
    prismaMock.reviewException.count.mockResolvedValue(2);
    prismaMock.approvalEvent.findMany.mockResolvedValue([
      {
        actorUserId: "reviewer_1",
        createdAt: new Date("2026-04-20T09:00:00.000Z"),
        eventType: "submitted",
        id: "event_submitted",
        note: "Ready for approver review.",
        reviewSnapshotVersion: 2,
      },
    ]);

    await expect(
      recordPayRunApprovalEvent({
        action: "approve",
        actorRole: "reviewer",
        actorUserId: "reviewer_1",
        clientId: "client_123",
        organizationId: "org_123",
        payRunId: "run_123",
      }),
    ).rejects.toThrow(/unresolved blocker/i);

    expect(prismaMock.approvalEvent.create).not.toHaveBeenCalled();
  });

  it("allows reviewer approval once blockers are cleared, even if warnings remain", async () => {
    prismaMock.reviewException.count.mockResolvedValue(0);
    prismaMock.approvalEvent.findMany.mockResolvedValue([
      {
        actorUserId: "reviewer_1",
        createdAt: new Date("2026-04-20T09:00:00.000Z"),
        eventType: "submitted",
        id: "event_submitted",
        note: "Ready for approver review.",
        reviewSnapshotVersion: 2,
      },
    ]);
    prismaMock.approvalEvent.create.mockResolvedValue({
      id: "event_approved",
    });

    await recordPayRunApprovalEvent({
      action: "approve",
      actorRole: "reviewer",
      actorUserId: "reviewer_1",
      clientId: "client_123",
      note: "All blocker exceptions resolved in drilldown.",
      organizationId: "org_123",
      payRunId: "run_123",
    });

    expect(prismaMock.approvalEvent.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "reviewer_1",
        clientId: "client_123",
        eventType: "approved",
        note: "All blocker exceptions resolved in drilldown.",
        organizationId: "org_123",
        payRunId: "run_123",
        reviewSnapshotVersion: 2,
      },
    });
  });

  it("blocks operators from submit and approve actions", async () => {
    await expect(
      recordPayRunApprovalEvent({
        action: "submit",
        actorRole: "operator",
        actorUserId: "operator_1",
        clientId: "client_123",
        organizationId: "org_123",
        payRunId: "run_123",
      }),
    ).rejects.toThrow(/approval actions are not permitted/i);

    expect(prismaMock.approvalEvent.create).not.toHaveBeenCalled();
  });

  it("requires a submitted review state before approval", async () => {
    prismaMock.reviewException.count.mockResolvedValue(0);
    prismaMock.approvalEvent.findMany.mockResolvedValue([]);

    await expect(
      recordPayRunApprovalEvent({
        action: "approve",
        actorRole: "reviewer",
        actorUserId: "reviewer_1",
        clientId: "client_123",
        organizationId: "org_123",
        payRunId: "run_123",
      }),
    ).rejects.toThrow(/submitted for approval/i);
  });

  it("requires an approved state before reopening", async () => {
    prismaMock.approvalEvent.findMany.mockResolvedValue([
      {
        actorUserId: "reviewer_1",
        createdAt: new Date("2026-04-20T09:00:00.000Z"),
        eventType: "submitted",
        id: "event_submitted",
        note: null,
        reviewSnapshotVersion: 2,
      },
    ]);

    await expect(
      recordPayRunApprovalEvent({
        action: "reopen",
        actorRole: "admin",
        actorUserId: "admin_1",
        clientId: "client_123",
        note: "New evidence arrived after submission.",
        organizationId: "org_123",
        payRunId: "run_123",
      }),
    ).rejects.toThrow(/approved pay run/i);
  });

  it("requires a note when rejecting or reopening a pay run for auditability", async () => {
    await expect(
      recordPayRunApprovalEvent({
        action: "reject",
        actorRole: "admin",
        actorUserId: "admin_1",
        clientId: "client_123",
        organizationId: "org_123",
        payRunId: "run_123",
      }),
    ).rejects.toThrow(/note is required/i);
  });
});
