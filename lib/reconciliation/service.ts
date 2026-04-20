import { prisma } from "@/lib/prisma";
import type { FieldMappingValues } from "@/lib/imports/mapping";
import {
  normalizeMappedJournalCsv,
  normalizeMappedPaymentCsv,
} from "@/lib/imports/reconciliation-normalization";
import type { SourceFileKind } from "@/lib/pay-runs/source-files";

export const RECONCILIATION_CHECK_KINDS = [
  "payroll_to_journal",
  "payroll_to_payment",
] as const;

export const RECONCILIATION_CHECK_STATUSES = [
  "matched",
  "within_tolerance",
  "mismatch",
] as const;

export type ReconciliationCheckKind =
  (typeof RECONCILIATION_CHECK_KINDS)[number];
export type ReconciliationCheckStatus =
  (typeof RECONCILIATION_CHECK_STATUSES)[number];

export const DEFAULT_RECONCILIATION_TOLERANCES: Record<
  ReconciliationCheckKind,
  string
> = {
  payroll_to_journal: "5.00",
  payroll_to_payment: "1.00",
};

type SecondaryReconciliationSourceKind = Extract<SourceFileKind, "journal" | "payment">;

type BuildReconciliationCheckRecordInput = {
  comparisonAmount: string | number;
  kind: ReconciliationCheckKind;
  payrollAmount: string | number;
  sourceFileId: string;
  toleranceAmount?: string | number;
};

function parseMoneyToCents(value: string | number) {
  const normalized = typeof value === "number" ? value.toFixed(2) : value.trim();

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid money amount: ${value}`);
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");
  const sign = wholePart.startsWith("-") ? -1 : 1;
  const whole = Number.parseInt(wholePart.replace("-", ""), 10);
  const fraction = Number.parseInt(fractionalPart.padEnd(2, "0"), 10);

  return sign * (whole * 100 + fraction);
}

function formatMoneyFromCents(value: number) {
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100);
  const fraction = `${absolute % 100}`.padStart(2, "0");

  return `${value < 0 ? "-" : ""}${whole}.${fraction}`;
}

function toMoneyString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value.toFixed(2);
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    return value.toString();
  }

  return null;
}

function formatCheckLabel(kind: ReconciliationCheckKind) {
  return kind === "payroll_to_journal"
    ? "Payroll gross vs journal total"
    : "Payroll net vs payment total";
}

function getCheckKindForSourceKind(sourceKind: SecondaryReconciliationSourceKind) {
  return sourceKind === "journal" ? "payroll_to_journal" : "payroll_to_payment";
}

function getNormalizationCountForSourceKind(input: {
  kind: SecondaryReconciliationSourceKind;
  sourceFile: {
    _count: {
      journalEntries?: number;
      paymentRecords?: number;
    };
  };
}) {
  return input.kind === "journal"
    ? input.sourceFile._count.journalEntries ?? 0
    : input.sourceFile._count.paymentRecords ?? 0;
}

export function buildReconciliationCheckRecord(
  input: BuildReconciliationCheckRecordInput,
) {
  const payrollAmountCents = parseMoneyToCents(input.payrollAmount);
  const comparisonAmountCents = parseMoneyToCents(input.comparisonAmount);
  const toleranceAmountCents = parseMoneyToCents(input.toleranceAmount ?? "0.00");
  const varianceAmountCents = Math.abs(payrollAmountCents - comparisonAmountCents);
  const status: ReconciliationCheckStatus =
    varianceAmountCents === 0
      ? "matched"
      : varianceAmountCents <= toleranceAmountCents
        ? "within_tolerance"
        : "mismatch";

  return {
    comparisonAmount: formatMoneyFromCents(comparisonAmountCents),
    kind: input.kind,
    payrollAmount: formatMoneyFromCents(payrollAmountCents),
    sourceFileId: input.sourceFileId,
    status,
    toleranceAmount: formatMoneyFromCents(toleranceAmountCents),
    varianceAmount: formatMoneyFromCents(varianceAmountCents),
  };
}

export async function normalizeAndPersistReconciliationSourceFile(input: {
  clientId: string;
  csvText: string;
  mapping: FieldMappingValues;
  organizationId: string;
  payRunId: string;
  sourceFileId: string;
  sourceKind: SecondaryReconciliationSourceKind;
}) {
  if (input.sourceKind === "journal") {
    const normalizedResult = normalizeMappedJournalCsv({
      clientId: input.clientId,
      csvText: input.csvText,
      mapping: input.mapping,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      sourceFileId: input.sourceFileId,
    });

    if (!normalizedResult.ok) {
      return {
        errors: normalizedResult.errors,
        ok: false as const,
      };
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.journalEntry.deleteMany({
        where: {
          sourceFileId: input.sourceFileId,
        },
      });

      if (normalizedResult.entries.length) {
        await transaction.journalEntry.createMany({
          data: normalizedResult.entries,
        });
      }
    });

    const checks = await refreshPayRunReconciliationChecks({
      clientId: input.clientId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
    });

    return {
      checks,
      normalizedRowCount: normalizedResult.entries.length,
      ok: true as const,
      sourceKind: input.sourceKind,
    };
  }

  const normalizedResult = normalizeMappedPaymentCsv({
    clientId: input.clientId,
    csvText: input.csvText,
    mapping: input.mapping,
    organizationId: input.organizationId,
    payRunId: input.payRunId,
    sourceFileId: input.sourceFileId,
  });

  if (!normalizedResult.ok) {
    return {
      errors: normalizedResult.errors,
      ok: false as const,
    };
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.paymentRecord.deleteMany({
      where: {
        sourceFileId: input.sourceFileId,
      },
    });

    if (normalizedResult.records.length) {
      await transaction.paymentRecord.createMany({
        data: normalizedResult.records,
      });
    }
  });

  const checks = await refreshPayRunReconciliationChecks({
    clientId: input.clientId,
    organizationId: input.organizationId,
    payRunId: input.payRunId,
  });

  return {
    checks,
    normalizedRowCount: normalizedResult.records.length,
    ok: true as const,
    sourceKind: input.sourceKind,
  };
}

export async function refreshPayRunReconciliationChecks(input: {
  clientId: string;
  organizationId: string;
  payRunId: string;
  toleranceAmounts?: Partial<Record<ReconciliationCheckKind, string>>;
}) {
  const tolerances = {
    ...DEFAULT_RECONCILIATION_TOLERANCES,
    ...input.toleranceAmounts,
  };

  const [payrollTotals, latestJournalSourceFile, latestPaymentSourceFile] =
    await Promise.all([
      prisma.employeeRunRecord.aggregate({
        where: {
          clientId: input.clientId,
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          recordScope: "current",
        },
        _sum: {
          grossPay: true,
          netPay: true,
        },
      }),
      prisma.sourceFile.findFirst({
        where: {
          clientId: input.clientId,
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          kind: "journal",
          status: "uploaded",
        },
        select: {
          id: true,
          version: true,
        },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      }),
      prisma.sourceFile.findFirst({
        where: {
          clientId: input.clientId,
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          kind: "payment",
          status: "uploaded",
        },
        select: {
          id: true,
          version: true,
        },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      }),
    ]);

  const grossPayrollAmount = toMoneyString(payrollTotals._sum.grossPay);
  const netPayrollAmount = toMoneyString(payrollTotals._sum.netPay);
  const upsertedChecks: Array<
    ReturnType<typeof buildReconciliationCheckRecord>
  > = [];

  if (latestJournalSourceFile) {
    const journalTotals = await prisma.journalEntry.aggregate({
      where: {
        clientId: input.clientId,
        organizationId: input.organizationId,
        payRunId: input.payRunId,
        sourceFileId: latestJournalSourceFile.id,
      },
      _count: {
        _all: true,
      },
      _sum: {
        amount: true,
      },
    });

    if (grossPayrollAmount && journalTotals._count._all > 0) {
      const check = buildReconciliationCheckRecord({
        comparisonAmount: toMoneyString(journalTotals._sum.amount) ?? "0.00",
        kind: "payroll_to_journal",
        payrollAmount: grossPayrollAmount,
        sourceFileId: latestJournalSourceFile.id,
        toleranceAmount: tolerances.payroll_to_journal,
      });

      await prisma.reconciliationCheck.upsert({
        where: {
          sourceFileId_checkKind: {
            checkKind: check.kind,
            sourceFileId: latestJournalSourceFile.id,
          },
        },
        update: {
          comparisonAmount: check.comparisonAmount,
          details: {
            comparisonMetric: "journal_total",
            label: formatCheckLabel(check.kind),
            payrollMetric: "gross_pay",
            sourceVersion: latestJournalSourceFile.version,
            rowCount: journalTotals._count._all,
          },
          payrollAmount: check.payrollAmount,
          status: check.status,
          toleranceAmount: check.toleranceAmount,
          varianceAmount: check.varianceAmount,
        },
        create: {
          checkKind: check.kind,
          clientId: input.clientId,
          comparisonAmount: check.comparisonAmount,
          details: {
            comparisonMetric: "journal_total",
            label: formatCheckLabel(check.kind),
            payrollMetric: "gross_pay",
            sourceVersion: latestJournalSourceFile.version,
            rowCount: journalTotals._count._all,
          },
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          payrollAmount: check.payrollAmount,
          sourceFileId: latestJournalSourceFile.id,
          status: check.status,
          toleranceAmount: check.toleranceAmount,
          varianceAmount: check.varianceAmount,
        },
      });

      upsertedChecks.push(check);
    } else {
      await prisma.reconciliationCheck.deleteMany({
        where: {
          checkKind: "payroll_to_journal",
          sourceFileId: latestJournalSourceFile.id,
        },
      });
    }
  }

  if (latestPaymentSourceFile) {
    const paymentTotals = await prisma.paymentRecord.aggregate({
      where: {
        clientId: input.clientId,
        organizationId: input.organizationId,
        payRunId: input.payRunId,
        sourceFileId: latestPaymentSourceFile.id,
      },
      _count: {
        _all: true,
      },
      _sum: {
        paymentAmount: true,
      },
    });

    if (netPayrollAmount && paymentTotals._count._all > 0) {
      const check = buildReconciliationCheckRecord({
        comparisonAmount: toMoneyString(paymentTotals._sum.paymentAmount) ?? "0.00",
        kind: "payroll_to_payment",
        payrollAmount: netPayrollAmount,
        sourceFileId: latestPaymentSourceFile.id,
        toleranceAmount: tolerances.payroll_to_payment,
      });

      await prisma.reconciliationCheck.upsert({
        where: {
          sourceFileId_checkKind: {
            checkKind: check.kind,
            sourceFileId: latestPaymentSourceFile.id,
          },
        },
        update: {
          comparisonAmount: check.comparisonAmount,
          details: {
            comparisonMetric: "payment_total",
            label: formatCheckLabel(check.kind),
            payrollMetric: "net_pay",
            sourceVersion: latestPaymentSourceFile.version,
            rowCount: paymentTotals._count._all,
          },
          payrollAmount: check.payrollAmount,
          status: check.status,
          toleranceAmount: check.toleranceAmount,
          varianceAmount: check.varianceAmount,
        },
        create: {
          checkKind: check.kind,
          clientId: input.clientId,
          comparisonAmount: check.comparisonAmount,
          details: {
            comparisonMetric: "payment_total",
            label: formatCheckLabel(check.kind),
            payrollMetric: "net_pay",
            sourceVersion: latestPaymentSourceFile.version,
            rowCount: paymentTotals._count._all,
          },
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          payrollAmount: check.payrollAmount,
          sourceFileId: latestPaymentSourceFile.id,
          status: check.status,
          toleranceAmount: check.toleranceAmount,
          varianceAmount: check.varianceAmount,
        },
      });

      upsertedChecks.push(check);
    } else {
      await prisma.reconciliationCheck.deleteMany({
        where: {
          checkKind: "payroll_to_payment",
          sourceFileId: latestPaymentSourceFile.id,
        },
      });
    }
  }

  return upsertedChecks;
}

export type PayRunReconciliationSummaryRow = {
  checkKind: ReconciliationCheckKind;
  label: string;
  normalizedRowCount: number;
  payrollAmount: string | null;
  sourceAmount: string | null;
  sourceFile:
    | {
        id: string;
        kind: SecondaryReconciliationSourceKind;
        originalFilename: string;
        version: number;
      }
    | null;
  state: ReconciliationCheckStatus | "awaiting_normalization" | "awaiting_payroll" | "missing_source";
  toleranceAmount: string;
  varianceAmount: string | null;
};

export async function listPayRunReconciliationSummary(input: {
  clientId: string;
  organizationId: string;
  payRunId: string;
}) {
  const [sourceFiles, payrollTotals] = await Promise.all([
    prisma.sourceFile.findMany({
      where: {
        clientId: input.clientId,
        organizationId: input.organizationId,
        payRunId: input.payRunId,
        kind: {
          in: ["journal", "payment"],
        },
        status: "uploaded",
      },
      include: {
        _count: {
          select: {
            journalEntries: true,
            paymentRecords: true,
          },
        },
        reconciliationChecks: {
          orderBy: {
            updatedAt: "desc",
          },
        },
      },
      orderBy: [{ kind: "asc" }, { version: "desc" }, { createdAt: "desc" }],
    }),
    prisma.employeeRunRecord.aggregate({
      where: {
        clientId: input.clientId,
        organizationId: input.organizationId,
        payRunId: input.payRunId,
        recordScope: "current",
      },
      _sum: {
        grossPay: true,
        netPay: true,
      },
    }),
  ]);

  const latestByKind = sourceFiles.reduce<
    Partial<Record<SecondaryReconciliationSourceKind, (typeof sourceFiles)[number]>>
  >((accumulator, sourceFile) => {
    if (sourceFile.kind === "journal" || sourceFile.kind === "payment") {
      accumulator[sourceFile.kind] ??= sourceFile;
    }

    return accumulator;
  }, {});
  const grossPayrollAmount = toMoneyString(payrollTotals._sum.grossPay);
  const netPayrollAmount = toMoneyString(payrollTotals._sum.netPay);
  const [journalTotals, paymentTotals] = await Promise.all([
    latestByKind.journal
      ? prisma.journalEntry.aggregate({
          where: {
            clientId: input.clientId,
            organizationId: input.organizationId,
            payRunId: input.payRunId,
            sourceFileId: latestByKind.journal.id,
          },
          _sum: {
            amount: true,
          },
        })
      : null,
    latestByKind.payment
      ? prisma.paymentRecord.aggregate({
          where: {
            clientId: input.clientId,
            organizationId: input.organizationId,
            payRunId: input.payRunId,
            sourceFileId: latestByKind.payment.id,
          },
          _sum: {
            paymentAmount: true,
          },
        })
      : null,
  ]);

  return (["journal", "payment"] as const).map<PayRunReconciliationSummaryRow>(
    (sourceKind) => {
      const sourceFile = latestByKind[sourceKind] ?? null;
      const checkKind = getCheckKindForSourceKind(sourceKind);

      if (!sourceFile) {
        return {
          checkKind,
          label: formatCheckLabel(checkKind),
          normalizedRowCount: 0,
          payrollAmount:
            checkKind === "payroll_to_journal" ? grossPayrollAmount : netPayrollAmount,
          sourceAmount: null,
          sourceFile: null,
          state: "missing_source",
          toleranceAmount: DEFAULT_RECONCILIATION_TOLERANCES[checkKind],
          varianceAmount: null,
        };
      }

      const latestCheck =
        sourceFile.reconciliationChecks.find((check) => check.checkKind === checkKind) ??
        null;
      const normalizedRowCount = getNormalizationCountForSourceKind({
        kind: sourceKind,
        sourceFile,
      });
      const payrollAmount =
        checkKind === "payroll_to_journal" ? grossPayrollAmount : netPayrollAmount;

      if (!latestCheck) {
        const comparisonAmount =
          sourceKind === "journal"
            ? toMoneyString(journalTotals?._sum.amount)
            : toMoneyString(paymentTotals?._sum.paymentAmount);

        if (normalizedRowCount > 0 && payrollAmount && comparisonAmount) {
          const computedCheck = buildReconciliationCheckRecord({
            comparisonAmount,
            kind: checkKind,
            payrollAmount,
            sourceFileId: sourceFile.id,
            toleranceAmount: DEFAULT_RECONCILIATION_TOLERANCES[checkKind],
          });

          return {
            checkKind,
            label: formatCheckLabel(checkKind),
            normalizedRowCount,
            payrollAmount: computedCheck.payrollAmount,
            sourceAmount: computedCheck.comparisonAmount,
            sourceFile: {
              id: sourceFile.id,
              kind: sourceKind,
              originalFilename: sourceFile.originalFilename,
              version: sourceFile.version,
            },
            state: computedCheck.status,
            toleranceAmount: computedCheck.toleranceAmount,
            varianceAmount: computedCheck.varianceAmount,
          };
        }

        return {
          checkKind,
          label: formatCheckLabel(checkKind),
          normalizedRowCount,
          payrollAmount,
          sourceAmount: null,
          sourceFile: {
            id: sourceFile.id,
            kind: sourceKind,
            originalFilename: sourceFile.originalFilename,
            version: sourceFile.version,
          },
          state:
            normalizedRowCount > 0 ? "awaiting_payroll" : "awaiting_normalization",
          toleranceAmount: DEFAULT_RECONCILIATION_TOLERANCES[checkKind],
          varianceAmount: null,
        };
      }

      return {
        checkKind,
        label: formatCheckLabel(checkKind),
        normalizedRowCount,
        payrollAmount: toMoneyString(latestCheck.payrollAmount),
        sourceAmount: toMoneyString(latestCheck.comparisonAmount),
        sourceFile: {
          id: sourceFile.id,
          kind: sourceKind,
          originalFilename: sourceFile.originalFilename,
          version: sourceFile.version,
        },
        state: latestCheck.status,
        toleranceAmount: toMoneyString(latestCheck.toleranceAmount) ?? "0.00",
        varianceAmount: toMoneyString(latestCheck.varianceAmount),
      };
    },
  );
}
