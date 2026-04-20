import { tasks } from "@trigger.dev/sdk";
import { type Prisma } from "@prisma/client";

import { hasSupabaseServiceRoleKey, readAppEnvironment } from "@/lib/env";
import {
  normalizeMappedPayrollCsv,
  type NormalizedEmployeePayComponent,
  type NormalizedEmployeeRunRecord,
  type NormalizedPayrollDataset,
  type PayrollNormalizationError,
} from "@/lib/imports/payroll-normalization";
import { prisma } from "@/lib/prisma";
import {
  deriveReviewProcessingState,
  type ReviewProcessingRunSnapshot,
  type ReviewProcessingSourceSnapshot,
  type ReviewProcessingState,
} from "@/lib/pay-runs/review-processing-state";
import { materializeRuleResultsAndExceptions } from "@/lib/review/exceptions";
import { matchEmployeeRunRecords } from "@/lib/review/employee-matching";
import { evaluateDeterministicReviewRules } from "@/lib/review/rules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PAYROLL_REVIEW_PROCESSING_TASK_ID = "payroll-review-processing";
const CURRENT_PAYROLL_KIND = "current_payroll";
const PREVIOUS_PAYROLL_KIND = "previous_payroll";
const MAX_ERROR_COUNT = 5;
const REVIEW_RULE_VERSION = "2026-04-20";

type SourceFileMappingRecord = {
  sourceHeader: string;
  targetFieldKey: string;
};

type MappedPayrollSourceFile = {
  id: string;
  kind: "current_payroll" | "previous_payroll";
  originalFilename: string;
  previewSheetName: string | null;
  sourceColumnMappings: SourceFileMappingRecord[];
  status: "uploaded";
  storageBucket: string;
  storagePath: string;
  version: number;
};

type ReviewProcessingRunRecord = ReviewProcessingRunSnapshot & {
  id: string;
  requestedAt: Date;
  triggerRunId: string | null;
};

type ReviewProcessingStore = Prisma.TransactionClient | typeof prisma;

export type PayRunReviewProcessingSummary = {
  activeReviewSnapshotVersion: number;
  currentPayroll: ReviewProcessingSourceSnapshot | null;
  latestRun: ReviewProcessingRunRecord | null;
  previousPayroll: ReviewProcessingSourceSnapshot | null;
  state: ReviewProcessingState;
};

type QueuePayRunReviewProcessingResult =
  | {
      enqueued: boolean;
      notice: string;
      ok: true;
      reviewProcessingRunId: string | null;
      state: ReviewProcessingState["code"];
    }
  | {
      error: string;
      ok: false;
      state: ReviewProcessingState["code"];
    };

type CreateReviewSnapshotResult = {
  createdExceptionCount: number;
  createdRuleResultCount: number;
  resultingSnapshotVersion: number;
};

function buildRecordStorageKey(record: {
  recordScope: "current" | "previous";
  rowNumber: number;
  sourceFileId: string;
}) {
  return `${record.recordScope}:${record.sourceFileId}:${record.rowNumber}`;
}

function buildMappingValues(mappings: SourceFileMappingRecord[]) {
  return Object.fromEntries(
    mappings.map((mapping) => [mapping.targetFieldKey, mapping.sourceHeader]),
  );
}

export function buildMappingSignature(mappings: SourceFileMappingRecord[]) {
  return mappings
    .slice()
    .sort((left, right) => left.targetFieldKey.localeCompare(right.targetFieldKey))
    .map((mapping) => `${mapping.targetFieldKey}:${mapping.sourceHeader}`)
    .join("|");
}

function pickLatestSourceFile(
  sourceFiles: MappedPayrollSourceFile[],
  kind: "current_payroll" | "previous_payroll",
) {
  return sourceFiles.find((sourceFile) => sourceFile.kind === kind) ?? null;
}

function toSourceSnapshot(
  sourceFile: MappedPayrollSourceFile | null,
): ReviewProcessingSourceSnapshot | null {
  if (!sourceFile || !sourceFile.sourceColumnMappings.length) {
    return null;
  }

  return {
    id: sourceFile.id,
    mappingSignature: buildMappingSignature(sourceFile.sourceColumnMappings),
    status: sourceFile.status,
    version: sourceFile.version,
  };
}

function toRunSnapshot(
  run:
    | {
        completedAt: Date | null;
        currentMappingSignature: string;
        currentSourceFileId: string;
        errorMessage: string | null;
        id: string;
        previousMappingSignature: string;
        previousSourceFileId: string;
        requestedAt: Date;
        resultingSnapshotVersion: number | null;
        startedAt: Date | null;
        status: "completed" | "failed" | "processing" | "queued";
        triggerRunId: string | null;
      }
    | null,
) {
  if (!run) {
    return null;
  }

  return {
    completedAt: run.completedAt,
    currentMappingSignature: run.currentMappingSignature,
    currentSourceFileId: run.currentSourceFileId,
    errorMessage: run.errorMessage,
    id: run.id,
    previousMappingSignature: run.previousMappingSignature,
    previousSourceFileId: run.previousSourceFileId,
    requestedAt: run.requestedAt,
    resultingSnapshotVersion: run.resultingSnapshotVersion,
    startedAt: run.startedAt,
    status: run.status,
    triggerRunId: run.triggerRunId,
  } satisfies ReviewProcessingRunRecord;
}

function formatNormalizationErrors(errors: PayrollNormalizationError[]) {
  return errors
    .slice(0, MAX_ERROR_COUNT)
    .map((error) =>
      error.rowNumber
        ? `${error.message} (row ${error.rowNumber})`
        : error.message,
    )
    .join(" ");
}

function mapMatchMethodToDatabase(
  match: ReturnType<typeof matchEmployeeRunRecords>["currentMatches"][number],
) {
  if (match.status !== "matched") {
    return "unmatched" as const;
  }

  return match.matchMethod === "employee_name_exact"
    ? ("manual" as const)
    : ("exact_identifier" as const);
}

async function loadMappedPayrollSourceFiles(input: {
  clientId: string;
  organizationId: string;
  payRunId: string;
}) {
  const sourceFiles = await prisma.sourceFile.findMany({
    where: {
      clientId: input.clientId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      kind: {
        in: [CURRENT_PAYROLL_KIND, PREVIOUS_PAYROLL_KIND],
      },
      status: "uploaded",
    },
    include: {
      sourceColumnMappings: {
        orderBy: {
          targetFieldKey: "asc",
        },
      },
    },
    orderBy: [{ kind: "asc" }, { version: "desc" }, { createdAt: "desc" }],
  });

  return sourceFiles as MappedPayrollSourceFile[];
}

async function loadLatestReviewProcessingRun(input: {
  clientId: string;
  organizationId: string;
  payRunId: string;
}) {
  const run = await prisma.reviewProcessingRun.findFirst({
    where: {
      clientId: input.clientId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
    },
    orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
  });

  return toRunSnapshot(run);
}

async function loadPayRunSnapshotVersion(input: {
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
    select: {
      activeReviewSnapshotVersion: true,
    },
  });

  if (!payRun) {
    throw new Error("Pay run access denied.");
  }

  return payRun.activeReviewSnapshotVersion;
}

async function downloadSourceFileText(sourceFile: {
  originalFilename: string;
  storageBucket: string;
  storagePath: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(sourceFile.storageBucket)
    .download(sourceFile.storagePath);

  if (error || !data) {
    throw new Error(
      `Could not download ${sourceFile.originalFilename} from storage for review processing.`,
    );
  }

  return new TextDecoder().decode(await data.arrayBuffer());
}

function normalizePayrollSource(input: {
  clientId: string;
  csvText: string;
  datasetRole: "current" | "previous";
  organizationId: string;
  payRunId: string;
  sourceFile: MappedPayrollSourceFile;
}) {
  return normalizeMappedPayrollCsv({
    clientId: input.clientId,
    csvText: input.csvText,
    datasetRole: input.datasetRole,
    mapping: buildMappingValues(input.sourceFile.sourceColumnMappings),
    organizationId: input.organizationId,
    payRunId: input.payRunId,
    sheetName: input.sourceFile.previewSheetName ?? undefined,
    sourceFileId: input.sourceFile.id,
  });
}

async function createReviewSnapshot(input: {
  clientId: string;
  currentDataset: NormalizedPayrollDataset;
  matchResult: ReturnType<typeof matchEmployeeRunRecords>;
  organizationId: string;
  payRunId: string;
  previousDataset: NormalizedPayrollDataset;
  store: ReviewProcessingStore;
}) {
  const payRun = await input.store.payRun.findUnique({
    where: {
      id_organizationId: {
        id: input.payRunId,
        organizationId: input.organizationId,
      },
    },
    select: {
      activeReviewSnapshotVersion: true,
    },
  });

  if (!payRun) {
    throw new Error("Pay run access denied.");
  }

  const nextSnapshotVersion = payRun.activeReviewSnapshotVersion + 1;
  const allRecords = [
    ...input.currentDataset.employeeRunRecords,
    ...input.previousDataset.employeeRunRecords,
  ];
  const createdRecords = await input.store.employeeRunRecord.createManyAndReturn({
    data: allRecords.map((record) => ({
      clientId: input.clientId,
      employeeDisplayName: record.employeeDisplayName,
      employeeExternalId: record.employeeExternalId,
      employeeNumber: record.employeeNumber,
      grossPay: record.grossPay,
      netPay: record.netPay,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      recordScope: record.recordScope,
      reviewSnapshotVersion: nextSnapshotVersion,
      sourceFileId: record.sourceFileId,
      sourceRowNumber: record.rowNumber,
    })),
  });

  const recordIdByDatasetKey = new Map<string, string>();
  const currentRecordKeyById = new Map<string, string>();

  for (const record of createdRecords) {
    const datasetKey = buildRecordStorageKey({
      recordScope: record.recordScope,
      rowNumber: record.sourceRowNumber,
      sourceFileId: record.sourceFileId,
    });
    recordIdByDatasetKey.set(datasetKey, record.id);

    if (record.recordScope === "current") {
      currentRecordKeyById.set(record.id, datasetKey);
    }
  }

  const allComponents = [
    ...input.currentDataset.employeePayComponents,
    ...input.previousDataset.employeePayComponents,
  ];
  const componentStorageKeyToDatasetKey = new Map<string, string>();
  const createdComponents = await input.store.employeePayComponent.createManyAndReturn({
    data: allComponents.map((component) => {
      const employeeRunRecordId = recordIdByDatasetKey.get(
        component.employeeRunRecordKey,
      );

      if (!employeeRunRecordId) {
        throw new Error("Canonical employee record mapping failed during processing.");
      }

      componentStorageKeyToDatasetKey.set(
        `${employeeRunRecordId}:${component.componentCode}`,
        component.componentKey,
      );

      return {
        amount: component.amount,
        category: component.category,
        clientId: input.clientId,
        componentCode: component.componentCode,
        componentLabel: component.componentLabel,
        employeeRunRecordId,
        organizationId: input.organizationId,
        payRunId: input.payRunId,
        sourceFileId: component.sourceFileId,
      };
    }),
  });

  const componentIdByDatasetKey = new Map<string, string>();

  for (const component of createdComponents) {
    const datasetKey = componentStorageKeyToDatasetKey.get(
      `${component.employeeRunRecordId}:${component.componentCode}`,
    );

    if (datasetKey) {
      componentIdByDatasetKey.set(datasetKey, component.id);
    }
  }

  await input.store.sourceRowRef.createMany({
    data: [
      ...input.currentDataset.sourceRowRefs,
      ...input.previousDataset.sourceRowRefs,
    ].map((sourceRowRef) => ({
      canonicalFieldKey: sourceRowRef.canonicalFieldKey,
      clientId: input.clientId,
      columnHeader: sourceRowRef.columnHeader,
      columnValue: sourceRowRef.columnValue,
      employeePayComponentId: sourceRowRef.employeePayComponentKey
        ? componentIdByDatasetKey.get(sourceRowRef.employeePayComponentKey)
        : undefined,
      employeeRunRecordId: sourceRowRef.employeeRunRecordKey
        ? recordIdByDatasetKey.get(sourceRowRef.employeeRunRecordKey)
        : undefined,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      rowNumber: sourceRowRef.rowNumber,
      sheetName: sourceRowRef.sheetName ?? undefined,
      sourceFileId: sourceRowRef.sourceFileId,
    })),
  });

  const createdMatches = await input.store.employeeMatch.createManyAndReturn({
    data: input.matchResult.currentMatches.map((match) => {
      const currentEmployeeRunRecordId = recordIdByDatasetKey.get(
        match.currentRecordKey,
      );

      if (!currentEmployeeRunRecordId) {
        throw new Error("Current employee matching failed during processing.");
      }

      return {
        clientId: input.clientId,
        currentEmployeeRunRecordId,
        matchMethod: mapMatchMethodToDatabase(match),
        organizationId: input.organizationId,
        payRunId: input.payRunId,
        previousEmployeeRunRecordId: match.previousRecordKey
          ? recordIdByDatasetKey.get(match.previousRecordKey)
          : undefined,
      };
    }),
  });

  const matchIdByCurrentRecordKey = new Map<string, string>();

  for (const match of createdMatches) {
    const currentRecordKey = currentRecordKeyById.get(match.currentEmployeeRunRecordId);

    if (currentRecordKey) {
      matchIdByCurrentRecordKey.set(currentRecordKey, match.id);
    }
  }

  const findings = evaluateDeterministicReviewRules({
    currentDataset: input.currentDataset,
    matchResult: input.matchResult,
    previousDataset: input.previousDataset,
    ruleVersion: REVIEW_RULE_VERSION,
  });

  const materialization = await materializeRuleResultsAndExceptions(
    {
      clientId: input.clientId,
      findings: findings.map((finding) => {
        const employeeRunRecordId = recordIdByDatasetKey.get(
          finding.employeeRunRecordId,
        );

        if (!employeeRunRecordId) {
          throw new Error(
            `Could not resolve canonical review record for finding ${finding.ruleCode}.`,
          );
        }

        return {
          ...finding,
          employeeMatchId: matchIdByCurrentRecordKey.get(
            finding.employeeRunRecordId,
          ),
          employeeRunRecordId,
        };
      }),
      organizationId: input.organizationId,
      payRunId: input.payRunId,
    },
    input.store,
  );

  await input.store.payRun.update({
    where: {
      id_organizationId: {
        id: input.payRunId,
        organizationId: input.organizationId,
      },
    },
    data: {
      activeReviewSnapshotVersion: nextSnapshotVersion,
      status: "ready_for_import",
    },
  });

  return {
    ...materialization,
    resultingSnapshotVersion: nextSnapshotVersion,
  } satisfies CreateReviewSnapshotResult;
}

export async function getPayRunReviewProcessingSummary(input: {
  clientId: string;
  organizationId: string;
  payRunId: string;
}): Promise<PayRunReviewProcessingSummary> {
  const [activeReviewSnapshotVersion, sourceFiles, latestRun] = await Promise.all([
    loadPayRunSnapshotVersion(input),
    loadMappedPayrollSourceFiles(input),
    loadLatestReviewProcessingRun(input),
  ]);
  const currentPayroll = toSourceSnapshot(
    pickLatestSourceFile(sourceFiles, CURRENT_PAYROLL_KIND),
  );
  const previousPayroll = toSourceSnapshot(
    pickLatestSourceFile(sourceFiles, PREVIOUS_PAYROLL_KIND),
  );

  return {
    activeReviewSnapshotVersion,
    currentPayroll,
    latestRun,
    previousPayroll,
    state: deriveReviewProcessingState({
      activeReviewSnapshotVersion,
      currentPayroll,
      latestRun,
      previousPayroll,
    }),
  };
}

export async function queuePayRunReviewProcessing(input: {
  clientId: string;
  initiatedByUserId?: string;
  organizationId: string;
  payRunId: string;
}): Promise<QueuePayRunReviewProcessingResult> {
  const summary = await getPayRunReviewProcessingSummary({
    clientId: input.clientId,
    organizationId: input.organizationId,
    payRunId: input.payRunId,
  });

  if (!summary.currentPayroll || !summary.previousPayroll) {
    return {
      error: summary.state.detail,
      ok: false,
      state: summary.state.code,
    };
  }

  if (
    summary.state.code === "queued" ||
    summary.state.code === "processing" ||
    summary.state.code === "completed"
  ) {
    return {
      enqueued: false,
      notice: summary.state.detail,
      ok: true,
      reviewProcessingRunId: summary.latestRun?.id ?? null,
      state: summary.state.code,
    };
  }

  if (!hasSupabaseServiceRoleKey()) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required before payroll review processing can run.",
      ok: false,
      state: "stale",
    };
  }

  const run = await prisma.reviewProcessingRun.create({
    data: {
      clientId: input.clientId,
      currentMappingSignature: summary.currentPayroll.mappingSignature,
      currentSourceFileId: summary.currentPayroll.id,
      initiatedByUserId: input.initiatedByUserId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      previousMappingSignature: summary.previousPayroll.mappingSignature,
      previousSourceFileId: summary.previousPayroll.id,
      status: "queued",
    },
  });

  try {
    if (readAppEnvironment().services.trigger) {
      const handle = await tasks.trigger(PAYROLL_REVIEW_PROCESSING_TASK_ID, {
        reviewProcessingRunId: run.id,
      });

      await prisma.reviewProcessingRun.update({
        where: {
          id: run.id,
        },
        data: {
          triggerRunId: handle.id,
        },
      });

      return {
        enqueued: true,
        notice: "Reviewer processing queued for the latest mapped payroll files.",
        ok: true,
        reviewProcessingRunId: run.id,
        state: "queued",
      };
    }

    await runQueuedPayRunReviewProcessing({
      reviewProcessingRunId: run.id,
    });

    return {
      enqueued: true,
      notice:
        "Reviewer processing completed for the latest mapped payroll files.",
      ok: true,
      reviewProcessingRunId: run.id,
      state: "completed",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Reviewer processing could not be started.";

    await prisma.reviewProcessingRun.update({
      where: {
        id: run.id,
      },
      data: {
        completedAt: new Date(),
        errorMessage: message,
        status: "failed",
      },
    });

    return {
      error: message,
      ok: false,
      state: "failed",
    };
  }
}

export async function runQueuedPayRunReviewProcessing(input: {
  reviewProcessingRunId: string;
}) {
  const processingRun = await prisma.reviewProcessingRun.findFirst({
    where: {
      id: input.reviewProcessingRunId,
    },
  });

  if (!processingRun) {
    throw new Error("Review processing run not found.");
  }

  if (processingRun.status === "completed") {
    return processingRun;
  }

  await prisma.reviewProcessingRun.update({
    where: {
      id: processingRun.id,
    },
    data: {
      errorMessage: null,
      startedAt: new Date(),
      status: "processing",
    },
  });

  try {
    const sourceFiles = await prisma.sourceFile.findMany({
      where: {
        id: {
          in: [
            processingRun.currentSourceFileId,
            processingRun.previousSourceFileId,
          ],
        },
        organizationId: processingRun.organizationId,
      },
      include: {
        sourceColumnMappings: {
          orderBy: {
            targetFieldKey: "asc",
          },
        },
      },
    });
    const currentSourceFile =
      sourceFiles.find((sourceFile) => sourceFile.id === processingRun.currentSourceFileId) ??
      null;
    const previousSourceFile =
      sourceFiles.find((sourceFile) => sourceFile.id === processingRun.previousSourceFileId) ??
      null;

    if (!currentSourceFile || !previousSourceFile) {
      throw new Error(
        "The mapped payroll files for this reviewer processing run are no longer available.",
      );
    }

    const [currentCsvText, previousCsvText] = await Promise.all([
      downloadSourceFileText(currentSourceFile),
      downloadSourceFileText(previousSourceFile),
    ]);
    const currentNormalization = normalizePayrollSource({
      clientId: processingRun.clientId,
      csvText: currentCsvText,
      datasetRole: "current",
      organizationId: processingRun.organizationId,
      payRunId: processingRun.payRunId,
      sourceFile: currentSourceFile as MappedPayrollSourceFile,
    });
    const previousNormalization = normalizePayrollSource({
      clientId: processingRun.clientId,
      csvText: previousCsvText,
      datasetRole: "previous",
      organizationId: processingRun.organizationId,
      payRunId: processingRun.payRunId,
      sourceFile: previousSourceFile as MappedPayrollSourceFile,
    });

    if (!currentNormalization.ok) {
      throw new Error(formatNormalizationErrors(currentNormalization.errors));
    }

    if (!previousNormalization.ok) {
      throw new Error(formatNormalizationErrors(previousNormalization.errors));
    }

    const matchResult = matchEmployeeRunRecords({
      currentRecords: currentNormalization.dataset.employeeRunRecords,
      previousRecords: previousNormalization.dataset.employeeRunRecords,
    });
    const snapshotResult = await prisma.$transaction((transaction) =>
      createReviewSnapshot({
        clientId: processingRun.clientId,
        currentDataset: currentNormalization.dataset,
        matchResult,
        organizationId: processingRun.organizationId,
        payRunId: processingRun.payRunId,
        previousDataset: previousNormalization.dataset,
        store: transaction,
      }),
    );

    return prisma.reviewProcessingRun.update({
      where: {
        id: processingRun.id,
      },
      data: {
        completedAt: new Date(),
        errorMessage: null,
        resultingSnapshotVersion: snapshotResult.resultingSnapshotVersion,
        status: "completed",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Reviewer processing failed for the latest mapped payroll files.";

    await prisma.reviewProcessingRun.update({
      where: {
        id: processingRun.id,
      },
      data: {
        completedAt: new Date(),
        errorMessage: message,
        status: "failed",
      },
    });

    throw error;
  }
}

export { PAYROLL_REVIEW_PROCESSING_TASK_ID };
