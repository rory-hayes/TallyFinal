import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ReviewRuleFinding } from "@/lib/review/rules";

type ReviewExceptionStatusAction = "ignore" | "resolve";

const reviewExceptionListInclude =
  Prisma.validator<Prisma.ReviewExceptionInclude>()({
    comments: {
      orderBy: {
        createdAt: "asc",
      },
    },
    ruleResult: {
      include: {
        employeeMatch: {
          include: {
            previousEmployeeRunRecord: true,
          },
        },
        employeePayComponent: true,
        employeeRunRecord: {
          include: {
            sourceRowRefs: {
              orderBy: {
                rowNumber: "asc",
              },
              select: {
                canonicalFieldKey: true,
                columnHeader: true,
                rowNumber: true,
                sourceFileId: true,
              },
              take: 3,
            },
          },
        },
      },
    },
  });

export type ReviewExceptionListItem = Prisma.ReviewExceptionGetPayload<{
  include: typeof reviewExceptionListInclude;
}>;

export async function materializeRuleResultsAndExceptions(input: {
  clientId: string;
  findings: ReviewRuleFinding[];
  organizationId: string;
  payRunId: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const employeeRunRecordIds = Array.from(
      new Set(input.findings.map((finding) => finding.employeeRunRecordId)),
    );
    const ruleCodes = Array.from(
      new Set(input.findings.map((finding) => finding.ruleCode)),
    );
    const ruleVersions = Array.from(
      new Set(input.findings.map((finding) => finding.ruleVersion)),
    );
    const existingRuleResults = await transaction.ruleResult.findMany({
      where: {
        clientId: input.clientId,
        employeeRunRecordId: {
          in: employeeRunRecordIds,
        },
        organizationId: input.organizationId,
        payRunId: input.payRunId,
        ruleCode: {
          in: ruleCodes,
        },
        ruleVersion: {
          in: ruleVersions,
        },
      },
      select: {
        employeeMatchId: true,
        employeePayComponentId: true,
        employeeRunRecordId: true,
        ruleCode: true,
        ruleVersion: true,
      },
    });

    const buildExistingKey = (finding: {
      employeeMatchId?: string | null;
      employeePayComponentId?: string | null;
      employeeRunRecordId: string;
      ruleCode: string;
      ruleVersion: string;
    }) =>
      [
        finding.ruleCode,
        finding.ruleVersion,
        finding.employeeRunRecordId,
        finding.employeeMatchId ?? "",
        finding.employeePayComponentId ?? "",
      ].join("::");

    const existingResultKeys = new Set(
      existingRuleResults.map((finding) => buildExistingKey(finding)),
    );

    let createdRuleResultCount = 0;
    let createdExceptionCount = 0;
    let skippedExistingRuleResultCount = 0;

    for (const finding of input.findings) {
      const findingKey = buildExistingKey({
        employeeMatchId: finding.employeeMatchId,
        employeePayComponentId: finding.employeePayComponentId,
        employeeRunRecordId: finding.employeeRunRecordId,
        ruleCode: finding.ruleCode,
        ruleVersion: finding.ruleVersion,
      });

      if (existingResultKeys.has(findingKey)) {
        skippedExistingRuleResultCount += 1;
        continue;
      }

      const ruleResult = await transaction.ruleResult.create({
        data: {
          clientId: input.clientId,
          details: finding.details as Prisma.InputJsonValue,
          employeeMatchId: finding.employeeMatchId,
          employeePayComponentId: finding.employeePayComponentId,
          employeeRunRecordId: finding.employeeRunRecordId,
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          ruleCode: finding.ruleCode,
          ruleMessage: finding.ruleMessage,
          ruleVersion: finding.ruleVersion,
          severity: finding.severity,
        },
      });

      createdRuleResultCount += 1;
      existingResultKeys.add(findingKey);

      await transaction.reviewException.create({
        data: {
          clientId: input.clientId,
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          ruleResultId: ruleResult.id,
        },
      });

      createdExceptionCount += 1;
    }

    return {
      createdExceptionCount,
      createdRuleResultCount,
      skippedExistingRuleResultCount,
    };
  });
}

export async function listReviewExceptions(input: {
  clientId: string;
  employee?: string;
  organizationId: string;
  payRunId: string;
  ruleCode?: string;
  severity?: "blocker" | "info" | "warning";
  status?: "dismissed" | "in_review" | "open" | "resolved";
}) {
  return prisma.reviewException.findMany({
    where: {
      clientId: input.clientId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      reviewStatus: input.status,
      ruleResult: {
        employeeRunRecord: input.employee
          ? {
              OR: [
                {
                  employeeDisplayName: {
                    contains: input.employee,
                    mode: "insensitive",
                  },
                },
                {
                  employeeExternalId: {
                    contains: input.employee,
                    mode: "insensitive",
                  },
                },
                {
                  employeeNumber: {
                    contains: input.employee,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : undefined,
        ruleCode: input.ruleCode,
        severity: input.severity,
      },
    },
    include: reviewExceptionListInclude,
    orderBy: [{ createdAt: "desc" }],
  });
}

function actionToReviewStatus(action: ReviewExceptionStatusAction) {
  if (action === "resolve") {
    return "resolved";
  }

  return "dismissed";
}

export async function bulkSetReviewExceptionStatus(input: {
  action: ReviewExceptionStatusAction;
  actorUserId: string;
  clientId: string;
  exceptionIds: string[];
  note?: string;
  organizationId: string;
  payRunId: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const targetStatus = actionToReviewStatus(input.action);
    const exceptions = await transaction.reviewException.findMany({
      where: {
        clientId: input.clientId,
        id: {
          in: input.exceptionIds,
        },
        organizationId: input.organizationId,
        payRunId: input.payRunId,
      },
      select: {
        id: true,
        reviewStatus: true,
      },
    });

    let updatedExceptionCount = 0;
    const skippedExceptionIds = input.exceptionIds.filter(
      (exceptionId) => !exceptions.some((exception) => exception.id === exceptionId),
    );

    for (const exception of exceptions) {
      if (exception.reviewStatus === targetStatus) {
        skippedExceptionIds.push(exception.id);
        continue;
      }

      await transaction.reviewException.update({
        where: {
          id: exception.id,
        },
        data: {
          resolutionNote: input.note,
          resolvedAt: new Date(),
          resolvedByUserId: input.actorUserId,
          reviewStatus: targetStatus,
        },
      });

      await transaction.exceptionComment.create({
        data: {
          authorUserId: input.actorUserId,
          body: `Exception status changed from ${exception.reviewStatus} to ${targetStatus}.${input.note ? ` ${input.note}` : ""}`,
          clientId: input.clientId,
          commentType: "audit_log",
          metadata: {
            action: input.action,
            fromStatus: exception.reviewStatus,
            note: input.note,
            toStatus: targetStatus,
          } as Prisma.InputJsonValue,
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          reviewExceptionId: exception.id,
        },
      });

      updatedExceptionCount += 1;
    }

    return {
      skippedExceptionIds,
      updatedExceptionCount,
    };
  });
}

export async function addReviewExceptionComment(input: {
  authorUserId: string;
  body: string;
  clientId: string;
  organizationId: string;
  payRunId: string;
  reviewExceptionId: string;
}) {
  const reviewException = await prisma.reviewException.findFirst({
    where: {
      clientId: input.clientId,
      id: input.reviewExceptionId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
    },
    select: {
      id: true,
    },
  });

  if (!reviewException) {
    throw new Error("Review exception access denied.");
  }

  return prisma.exceptionComment.create({
    data: {
      authorUserId: input.authorUserId,
      body: input.body,
      clientId: input.clientId,
      commentType: "comment",
      metadata: undefined,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      reviewExceptionId: input.reviewExceptionId,
    },
  });
}

export async function bulkAssignReviewExceptions(input: {
  actorUserId: string;
  assigneeUserId: string;
  clientId: string;
  exceptionIds: string[];
  organizationId: string;
  payRunId: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const exceptions = await transaction.reviewException.findMany({
      where: {
        clientId: input.clientId,
        id: {
          in: input.exceptionIds,
        },
        organizationId: input.organizationId,
        payRunId: input.payRunId,
      },
      select: {
        assigneeUserId: true,
        id: true,
      },
    });

    let updatedExceptionCount = 0;
    const skippedExceptionIds = input.exceptionIds.filter(
      (exceptionId) => !exceptions.some((exception) => exception.id === exceptionId),
    );

    for (const exception of exceptions) {
      await transaction.reviewException.update({
        where: {
          id: exception.id,
        },
        data: {
          assigneeUserId: input.assigneeUserId,
        },
      });

      await transaction.exceptionComment.create({
        data: {
          authorUserId: input.actorUserId,
          body: `Exception assigned to ${input.assigneeUserId}.`,
          clientId: input.clientId,
          commentType: "audit_log",
          metadata: {
            action: "assign",
            assigneeUserId: input.assigneeUserId,
            previousAssigneeUserId: exception.assigneeUserId,
          } as Prisma.InputJsonValue,
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          reviewExceptionId: exception.id,
        },
      });

      updatedExceptionCount += 1;
    }

    return {
      skippedExceptionIds,
      updatedExceptionCount,
    };
  });
}
