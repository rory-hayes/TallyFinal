import type { OrganizationRole } from "@/lib/tenancy/access";
import { canManageApprovalActions } from "@/lib/tenancy/access";
import { prisma } from "@/lib/prisma";

export type PayRunApprovalAction = "approve" | "reject" | "reopen" | "submit";

export type PayRunApprovalSummary = {
  activeExceptionCount: number;
  blockingExceptionCount: number;
  currentState: "approved" | "review_in_progress" | "submitted";
  events: Array<{
    actorUserId: string;
    createdAt: Date;
    eventType: "approved" | "rejected" | "reopened" | "submitted";
    id: string;
    note: string | null;
    reviewSnapshotVersion: number | null;
  }>;
  latestEvent:
    | {
        actorUserId: string;
        createdAt: Date;
        eventType: "approved" | "rejected" | "reopened" | "submitted";
        id: string;
        note: string | null;
        reviewSnapshotVersion: number | null;
      }
    | null;
};

function actionToEventType(action: PayRunApprovalAction) {
  if (action === "submit") {
    return "submitted" as const;
  }

  if (action === "approve") {
    return "approved" as const;
  }

  if (action === "reject") {
    return "rejected" as const;
  }

  return "reopened" as const;
}

function deriveApprovalState(
  latestEventType:
    | (PayRunApprovalSummary["latestEvent"] extends infer T
        ? T extends { eventType: infer E }
          ? E
          : never
        : never)
    | undefined,
) {
  if (latestEventType === "approved") {
    return "approved" as const;
  }

  if (latestEventType === "submitted") {
    return "submitted" as const;
  }

  return "review_in_progress" as const;
}

async function getLatestApprovalEvent(input: {
  clientId: string;
  organizationId: string;
  payRunId: string;
  reviewSnapshotVersion: number;
}) {
  const [latestEvent] = await prisma.approvalEvent.findMany({
    where: {
      clientId: input.clientId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      reviewSnapshotVersion: input.reviewSnapshotVersion,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
  });

  return latestEvent ?? null;
}

export async function getPayRunApprovalSummary(input: {
  clientId: string;
  organizationId: string;
  payRunId: string;
}): Promise<PayRunApprovalSummary> {
  const payRun = await prisma.payRun.findFirst({
    where: {
      clientId: input.clientId,
      id: input.payRunId,
      organizationId: input.organizationId,
    },
    select: {
      activeReviewSnapshotVersion: true,
    },
  });
  const activeReviewSnapshotVersion = payRun?.activeReviewSnapshotVersion ?? 0;
  const [activeExceptionCount, blockingExceptionCount, events] =
    await Promise.all([
      prisma.reviewException.count({
        where: {
          clientId: input.clientId,
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          reviewStatus: {
            in: ["open", "in_review"],
          },
          ruleResult: {
            employeeRunRecord: {
              reviewSnapshotVersion: activeReviewSnapshotVersion,
            },
          },
        },
      }),
      prisma.reviewException.count({
        where: {
          clientId: input.clientId,
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          reviewStatus: {
            in: ["open", "in_review"],
          },
          ruleResult: {
            employeeRunRecord: {
              reviewSnapshotVersion: activeReviewSnapshotVersion,
            },
            severity: "blocker",
          },
        },
      }),
      prisma.approvalEvent.findMany({
        where: {
          clientId: input.clientId,
          organizationId: input.organizationId,
          payRunId: input.payRunId,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

  const latestEvent =
    events.find(
      (event) => event.reviewSnapshotVersion === activeReviewSnapshotVersion,
    ) ?? null;

  return {
    activeExceptionCount,
    blockingExceptionCount,
    currentState: deriveApprovalState(latestEvent?.eventType),
    events,
    latestEvent,
  };
}

export async function recordPayRunApprovalEvent(input: {
  action: PayRunApprovalAction;
  actorRole: OrganizationRole;
  actorUserId: string;
  clientId: string;
  note?: string;
  organizationId: string;
  payRunId: string;
}) {
  if (!canManageApprovalActions(input.actorRole)) {
    throw new Error("Approval actions are not permitted for this role.");
  }

  const trimmedNote = input.note?.trim();
  const payRun = await prisma.payRun.findFirst({
    where: {
      clientId: input.clientId,
      id: input.payRunId,
      organizationId: input.organizationId,
    },
    select: {
      activeReviewSnapshotVersion: true,
    },
  });
  const activeReviewSnapshotVersion = payRun?.activeReviewSnapshotVersion ?? 0;

  if (
    activeReviewSnapshotVersion < 1 &&
    (input.action === "submit" || input.action === "approve")
  ) {
    throw new Error(
      "Process the current and previous payroll files before using approval actions.",
    );
  }

  if (
    (input.action === "reject" || input.action === "reopen") &&
    !trimmedNote
  ) {
    throw new Error("A note is required for rejected or reopened pay runs.");
  }

  const latestEvent = await getLatestApprovalEvent({
    clientId: input.clientId,
    organizationId: input.organizationId,
    payRunId: input.payRunId,
    reviewSnapshotVersion: activeReviewSnapshotVersion,
  });
  const currentState = deriveApprovalState(latestEvent?.eventType);

  if (input.action === "submit" && currentState === "submitted") {
    throw new Error("This pay run is already submitted for approval.");
  }

  if (input.action === "approve") {
    if (currentState !== "submitted") {
      throw new Error("The pay run must be submitted for approval first.");
    }

    const blockingExceptionCount = await prisma.reviewException.count({
      where: {
        clientId: input.clientId,
        organizationId: input.organizationId,
        payRunId: input.payRunId,
        reviewStatus: {
          in: ["open", "in_review"],
        },
        ruleResult: {
          employeeRunRecord: {
            reviewSnapshotVersion: activeReviewSnapshotVersion,
          },
          severity: "blocker",
        },
      },
    });

    if (blockingExceptionCount > 0) {
      throw new Error(
        "Approval is blocked while unresolved blocker exceptions remain.",
      );
    }
  }

  if (input.action === "reject" && currentState !== "submitted") {
    throw new Error("Only submitted pay runs can be rejected.");
  }

  if (input.action === "reopen" && currentState !== "approved") {
    throw new Error("Only an approved pay run can be reopened.");
  }

  return prisma.approvalEvent.create({
    data: {
      actorUserId: input.actorUserId,
      clientId: input.clientId,
      eventType: actionToEventType(input.action),
      note: trimmedNote,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      reviewSnapshotVersion: activeReviewSnapshotVersion,
    },
  });
}
