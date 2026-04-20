import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function createEmployeeRunRecord(input: {
  clientId: string;
  employeeDisplayName: string;
  employeeExternalId?: string;
  employeeNumber?: string;
  grossPay?: string | number;
  netPay?: string | number;
  organizationId: string;
  payRunId: string;
  recordScope: "current" | "previous";
  reviewSnapshotVersion?: number;
  sourceRowNumber: number;
  sourceFileId: string;
}) {
  return prisma.employeeRunRecord.create({
    data: {
      clientId: input.clientId,
      employeeDisplayName: input.employeeDisplayName,
      employeeExternalId: input.employeeExternalId,
      employeeNumber: input.employeeNumber,
      grossPay: input.grossPay,
      netPay: input.netPay,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      recordScope: input.recordScope,
      reviewSnapshotVersion: input.reviewSnapshotVersion,
      sourceFileId: input.sourceFileId,
      sourceRowNumber: input.sourceRowNumber,
    },
  });
}

export async function createEmployeePayComponent(input: {
  amount: string | number;
  category: "earning" | "deduction" | "employer_cost" | "other";
  clientId: string;
  componentCode: string;
  componentLabel: string;
  employeeRunRecordId: string;
  organizationId: string;
  payRunId: string;
  quantity?: string | number;
  sourceFileId: string;
  unitRate?: string | number;
}) {
  return prisma.employeePayComponent.create({
    data: {
      amount: input.amount,
      category: input.category,
      clientId: input.clientId,
      componentCode: input.componentCode,
      componentLabel: input.componentLabel,
      employeeRunRecordId: input.employeeRunRecordId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      quantity: input.quantity,
      sourceFileId: input.sourceFileId,
      unitRate: input.unitRate,
    },
  });
}

export async function createSourceRowRef(input: {
  canonicalFieldKey?: string;
  clientId: string;
  columnHeader?: string;
  columnValue?: string;
  employeePayComponentId?: string;
  employeeRunRecordId?: string;
  organizationId: string;
  payRunId: string;
  rowNumber: number;
  sheetName?: string;
  sourceFileId: string;
}) {
  if (!input.employeeRunRecordId && !input.employeePayComponentId) {
    throw new Error(
      "Source row refs must point to an employee record or pay component target.",
    );
  }

  return prisma.sourceRowRef.create({
    data: {
      canonicalFieldKey: input.canonicalFieldKey,
      clientId: input.clientId,
      columnHeader: input.columnHeader,
      columnValue: input.columnValue,
      employeePayComponentId: input.employeePayComponentId,
      employeeRunRecordId: input.employeeRunRecordId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      rowNumber: input.rowNumber,
      sheetName: input.sheetName,
      sourceFileId: input.sourceFileId,
    },
  });
}

export async function createEmployeeMatch(input: {
  clientId: string;
  currentEmployeeRunRecordId: string;
  matchMethod: "exact_identifier" | "manual" | "unmatched";
  organizationId: string;
  payRunId: string;
  previousEmployeeRunRecordId?: string;
}) {
  return prisma.employeeMatch.create({
    data: {
      clientId: input.clientId,
      currentEmployeeRunRecordId: input.currentEmployeeRunRecordId,
      matchMethod: input.matchMethod,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      previousEmployeeRunRecordId: input.previousEmployeeRunRecordId,
    },
  });
}

export async function createRuleResult(input: {
  clientId: string;
  details?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  employeeMatchId?: string;
  employeePayComponentId?: string;
  employeeRunRecordId: string;
  organizationId: string;
  payRunId: string;
  resultStatus?: "passed" | "failed";
  ruleCode: string;
  ruleMessage: string;
  ruleVersion: string;
  severity: "info" | "warning" | "blocker";
}) {
  return prisma.ruleResult.create({
    data: {
      clientId: input.clientId,
      details: input.details,
      employeeMatchId: input.employeeMatchId,
      employeePayComponentId: input.employeePayComponentId,
      employeeRunRecordId: input.employeeRunRecordId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      resultStatus: input.resultStatus,
      ruleCode: input.ruleCode,
      ruleMessage: input.ruleMessage,
      ruleVersion: input.ruleVersion,
      severity: input.severity,
    },
  });
}

export async function createReviewException(input: {
  assigneeUserId?: string;
  clientId: string;
  organizationId: string;
  payRunId: string;
  reviewStatus?: "open" | "in_review" | "resolved" | "dismissed";
  ruleResultId: string;
}) {
  return prisma.reviewException.create({
    data: {
      assigneeUserId: input.assigneeUserId,
      clientId: input.clientId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      reviewStatus: input.reviewStatus,
      ruleResultId: input.ruleResultId,
    },
  });
}

export async function createExceptionComment(input: {
  authorUserId: string;
  body: string;
  clientId: string;
  commentType?: "audit_log" | "comment";
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  organizationId: string;
  payRunId: string;
  reviewExceptionId: string;
}) {
  return prisma.exceptionComment.create({
    data: {
      authorUserId: input.authorUserId,
      body: input.body,
      clientId: input.clientId,
      commentType: input.commentType,
      metadata: input.metadata,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      reviewExceptionId: input.reviewExceptionId,
    },
  });
}

export async function createApprovalEvent(input: {
  actorUserId: string;
  clientId: string;
  eventType: "submitted" | "approved" | "rejected" | "reopened";
  note?: string;
  organizationId: string;
  payRunId: string;
}) {
  return prisma.approvalEvent.create({
    data: {
      actorUserId: input.actorUserId,
      clientId: input.clientId,
      eventType: input.eventType,
      note: input.note,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
    },
  });
}
