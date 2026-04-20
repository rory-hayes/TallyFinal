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
  }>;
  latestEvent:
    | {
        actorUserId: string;
        createdAt: Date;
        eventType: "approved" | "rejected" | "reopened" | "submitted";
        id: string;
        note: string | null;
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
  latestEventType: PayRunApprovalSummary["latestEvent"] extends infer T
    ? T extends { eventType: infer E }
      ? E
      : never
    : never,
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
}) {
  const [latestEvent] = await prisma.approvalEvent.findMany({
    where: {
      clientId: input.clientId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
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

  const latestEvent = events[0] ?? null;

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
    },
  });
}
