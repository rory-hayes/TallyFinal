import { prisma } from "@/lib/prisma";
import { getPayRunApprovalSummary } from "@/lib/review/approval";
import { listReviewExceptions } from "@/lib/review/exceptions";
import { listPayRunReconciliationSummary } from "@/lib/reconciliation/service";

type ExceptionExportRowInput = {
  assigneeLabel: string | null;
  commentsCount: number;
  employeeDisplayName: string;
  employeeExternalId: string | null;
  employeeNumber: string | null;
  firstSourceRowNumber: number | null;
  reviewStatus: string;
  ruleCode: string;
  ruleMessage: string;
  severity: string;
};

type ReconciliationExportRowInput = {
  checkKind: string;
  label: string;
  normalizedRowCount: number;
  payrollAmount: string | null;
  sourceAmount: string | null;
  sourceFileName: string | null;
  sourceFileVersion: number | null;
  state: string;
  toleranceAmount: string;
  varianceAmount: string | null;
};

type AuditExportInput = {
  approvalEvents: Array<{
    actorUserId: string;
    createdAt: string;
    eventType: string;
    note: string | null;
    reviewSnapshotVersion: number | null;
  }>;
  client: {
    id: string;
    name: string;
  };
  exceptions: Array<{
    comments: Array<{
      authorUserId: string;
      body: string;
      commentType: string;
      createdAt: string;
    }>;
    employeeDisplayName: string;
    reviewStatus: string;
    ruleCode: string;
    severity: string;
  }>;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  payRun: {
    activeReviewSnapshotVersion: number;
    id: string;
    title: string;
  };
  processingRuns: Array<{
    completedAt: string | null;
    currentMappingSignature: string;
    currentSourceFileId: string;
    errorMessage: string | null;
    previousMappingSignature: string;
    previousSourceFileId: string;
    requestedAt: string;
    resultingSnapshotVersion: number | null;
    startedAt: string | null;
    status: string;
  }>;
  sourceFiles: Array<{
    checksumSha256: string;
    id: string;
    kind: string;
    originalFilename: string;
    replacementOfId: string | null;
    status: string;
    version: number;
  }>;
};

function stringifyNumber(value: number | null) {
  return value === null ? "" : String(value);
}

function stringifyValue(value: string | null) {
  return value ?? "";
}

export function buildExceptionExportRows(rows: ExceptionExportRowInput[]) {
  return rows.map((row) => ({
    assignee: stringifyValue(row.assigneeLabel),
    commentsCount: stringifyNumber(row.commentsCount),
    employeeDisplayName: row.employeeDisplayName,
    employeeExternalId: stringifyValue(row.employeeExternalId),
    employeeNumber: stringifyValue(row.employeeNumber),
    firstSourceRowNumber: stringifyNumber(row.firstSourceRowNumber),
    reviewStatus: row.reviewStatus,
    ruleCode: row.ruleCode,
    ruleMessage: row.ruleMessage,
    severity: row.severity,
  }));
}

export function buildReconciliationExportRows(rows: ReconciliationExportRowInput[]) {
  return rows.map((row) => ({
    checkKind: row.checkKind,
    label: row.label,
    normalizedRowCount: stringifyNumber(row.normalizedRowCount),
    payrollAmount: stringifyValue(row.payrollAmount),
    sourceAmount: stringifyValue(row.sourceAmount),
    sourceFileName: stringifyValue(row.sourceFileName),
    sourceFileVersion: stringifyNumber(row.sourceFileVersion),
    state: row.state,
    toleranceAmount: row.toleranceAmount,
    varianceAmount: stringifyValue(row.varianceAmount),
  }));
}

export function buildAuditExport(input: AuditExportInput) {
  return {
    approvalEvents: input.approvalEvents,
    client: input.client,
    exceptions: input.exceptions,
    generatedAt: new Date().toISOString(),
    organization: input.organization,
    payRun: input.payRun,
    processingRuns: input.processingRuns,
    sourceFiles: input.sourceFiles,
  };
}

export async function getExceptionExportRows(input: {
  clientId: string;
  organizationId: string;
  payRunId: string;
  reviewSnapshotVersion: number;
}) {
  const exceptions = await listReviewExceptions({
    clientId: input.clientId,
    organizationId: input.organizationId,
    payRunId: input.payRunId,
    reviewSnapshotVersion: input.reviewSnapshotVersion,
  });

  return buildExceptionExportRows(
    exceptions.map((exception) => ({
      assigneeLabel: exception.assigneeUserId,
      commentsCount: exception.comments.length,
      employeeDisplayName: exception.ruleResult.employeeRunRecord.employeeDisplayName,
      employeeExternalId:
        exception.ruleResult.employeeRunRecord.employeeExternalId ?? null,
      employeeNumber: exception.ruleResult.employeeRunRecord.employeeNumber ?? null,
      firstSourceRowNumber:
        exception.ruleResult.employeeRunRecord.sourceRowRefs[0]?.rowNumber ?? null,
      reviewStatus: exception.reviewStatus,
      ruleCode: exception.ruleResult.ruleCode,
      ruleMessage: exception.ruleResult.ruleMessage,
      severity: exception.ruleResult.severity,
    })),
  );
}

export async function getReconciliationExportRows(input: {
  clientId: string;
  organizationId: string;
  payRunId: string;
}) {
  const rows = await listPayRunReconciliationSummary(input);

  return buildReconciliationExportRows(
    rows.map((row) => ({
      checkKind: row.checkKind,
      label: row.label,
      normalizedRowCount: row.normalizedRowCount,
      payrollAmount: row.payrollAmount,
      sourceAmount: row.sourceAmount,
      sourceFileName: row.sourceFile?.originalFilename ?? null,
      sourceFileVersion: row.sourceFile?.version ?? null,
      state: row.state,
      toleranceAmount: row.toleranceAmount,
      varianceAmount: row.varianceAmount,
    })),
  );
}

export async function getAuditExport(input: {
  clientId: string;
  organizationId: string;
  payRunId: string;
}) {
  const payRun = await prisma.payRun.findFirst({
    where: {
      clientId: input.clientId,
      id: input.payRunId,
      organizationId: input.organizationId,
    },
    include: {
      approvalEvents: {
        orderBy: {
          createdAt: "desc",
        },
      },
      reviewProcessingRuns: {
        orderBy: {
          requestedAt: "desc",
        },
      },
      sourceFiles: {
        orderBy: [{ kind: "asc" }, { version: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!payRun) {
    throw new Error("Pay run access denied.");
  }

  const [organization, client, exceptions] = await Promise.all([
    prisma.organization.findFirst({
      where: {
        id: input.organizationId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    prisma.client.findFirst({
      where: {
        id: input.clientId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        name: true,
      },
    }),
    listReviewExceptions({
      clientId: input.clientId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      reviewSnapshotVersion: payRun.activeReviewSnapshotVersion,
    }),
  ]);

  if (!organization || !client) {
    throw new Error("Audit export access denied.");
  }

  return buildAuditExport({
    approvalEvents: payRun.approvalEvents.map((event) => ({
      actorUserId: event.actorUserId,
      createdAt: event.createdAt.toISOString(),
      eventType: event.eventType,
      note: event.note,
      reviewSnapshotVersion: event.reviewSnapshotVersion,
    })),
    client,
    exceptions: exceptions.map((exception) => ({
      comments: exception.comments.map((comment) => ({
        authorUserId: comment.authorUserId,
        body: comment.body,
        commentType: comment.commentType,
        createdAt: comment.createdAt.toISOString(),
      })),
      employeeDisplayName: exception.ruleResult.employeeRunRecord.employeeDisplayName,
      reviewStatus: exception.reviewStatus,
      ruleCode: exception.ruleResult.ruleCode,
      severity: exception.ruleResult.severity,
    })),
    organization,
    payRun: {
      activeReviewSnapshotVersion: payRun.activeReviewSnapshotVersion,
      id: payRun.id,
      title: payRun.title,
    },
    processingRuns: payRun.reviewProcessingRuns.map((run) => ({
      completedAt: run.completedAt?.toISOString() ?? null,
      currentMappingSignature: run.currentMappingSignature,
      currentSourceFileId: run.currentSourceFileId,
      errorMessage: run.errorMessage,
      previousMappingSignature: run.previousMappingSignature,
      previousSourceFileId: run.previousSourceFileId,
      requestedAt: run.requestedAt.toISOString(),
      resultingSnapshotVersion: run.resultingSnapshotVersion,
      startedAt: run.startedAt?.toISOString() ?? null,
      status: run.status,
    })),
    sourceFiles: payRun.sourceFiles.map((sourceFile) => ({
      checksumSha256: sourceFile.checksumSha256,
      id: sourceFile.id,
      kind: sourceFile.kind,
      originalFilename: sourceFile.originalFilename,
      replacementOfId: sourceFile.replacementOfId,
      status: sourceFile.status,
      version: sourceFile.version,
    })),
  });
}

export async function getSignOffExportData(input: {
  clientId: string;
  organizationId: string;
  payRunId: string;
}) {
  const payRun = await prisma.payRun.findFirst({
    where: {
      clientId: input.clientId,
      id: input.payRunId,
      organizationId: input.organizationId,
    },
    include: {
      sourceFiles: {
        orderBy: [{ kind: "asc" }, { version: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!payRun) {
    throw new Error("Pay run access denied.");
  }

  const [organization, client, approvalSummary] = await Promise.all([
    prisma.organization.findFirst({
      where: {
        id: input.organizationId,
      },
      select: {
        name: true,
      },
    }),
    prisma.client.findFirst({
      where: {
        id: input.clientId,
        organizationId: input.organizationId,
      },
      select: {
        name: true,
      },
    }),
    getPayRunApprovalSummary(input),
  ]);

  if (!organization || !client) {
    throw new Error("Sign-off export access denied.");
  }

  return {
    approvalSummary,
    clientName: client.name,
    organizationName: organization.name,
    payRun,
  };
}
