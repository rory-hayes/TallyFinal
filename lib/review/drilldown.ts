import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type ComparableEmployeeRecord = {
  employeeDisplayName?: string | null;
  employeeExternalId?: string | null;
  employeeNumber?: string | null;
  grossPay?: string | null;
  netPay?: string | null;
};

type ComparablePayComponent = {
  amount: string;
  category: "deduction" | "earning" | "employer_cost" | "other";
  componentCode: string;
  componentLabel: string;
};

export type EmployeeComparisonRow = {
  changed: boolean;
  currentValue: string | null;
  fieldKey:
    | "employeeDisplayName"
    | "employeeExternalId"
    | "employeeNumber"
    | "grossPay"
    | "netPay";
  label: string;
  previousValue: string | null;
};

export type PayComponentComparisonRow = {
  category: ComparablePayComponent["category"] | null;
  changeType: "added" | "changed" | "removed" | "unchanged";
  componentCode: string;
  componentLabel: string;
  currentAmount: string | null;
  deltaAmount: string | null;
  previousAmount: string | null;
};

function normalizeValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

function normalizeAmount(value: string | null | undefined) {
  const normalized = normalizeValue(value);

  return normalized ? Number.parseFloat(normalized).toFixed(2) : null;
}

function calculateDelta(currentAmount: string | null, previousAmount: string | null) {
  if (currentAmount === null || previousAmount === null) {
    return null;
  }

  return (Number.parseFloat(currentAmount) - Number.parseFloat(previousAmount)).toFixed(
    2,
  );
}

export function buildEmployeeComparisonRows(input: {
  currentRecord: ComparableEmployeeRecord;
  previousRecord?: ComparableEmployeeRecord | null;
}): EmployeeComparisonRow[] {
  const fieldDefinitions: Array<{
    fieldKey: EmployeeComparisonRow["fieldKey"];
    label: string;
  }> = [
    {
      fieldKey: "employeeDisplayName",
      label: "Employee",
    },
    {
      fieldKey: "employeeExternalId",
      label: "External id",
    },
    {
      fieldKey: "employeeNumber",
      label: "Payroll number",
    },
    {
      fieldKey: "grossPay",
      label: "Gross pay",
    },
    {
      fieldKey: "netPay",
      label: "Net pay",
    },
  ];

  return fieldDefinitions.map(({ fieldKey, label }) => {
    const currentValue =
      fieldKey === "grossPay" || fieldKey === "netPay"
        ? normalizeAmount(input.currentRecord[fieldKey])
        : normalizeValue(input.currentRecord[fieldKey]);
    const previousValue =
      fieldKey === "grossPay" || fieldKey === "netPay"
        ? normalizeAmount(input.previousRecord?.[fieldKey])
        : normalizeValue(input.previousRecord?.[fieldKey]);

    return {
      changed: currentValue !== previousValue,
      currentValue,
      fieldKey,
      label,
      previousValue,
    };
  });
}

export function buildPayComponentComparisonRows(input: {
  currentComponents: ComparablePayComponent[];
  previousComponents: ComparablePayComponent[];
}) {
  const currentByCode = new Map(
    input.currentComponents.map((component) => [component.componentCode, component]),
  );
  const previousByCode = new Map(
    input.previousComponents.map((component) => [component.componentCode, component]),
  );
  const componentCodes = Array.from(
    new Set([
      ...input.currentComponents.map((component) => component.componentCode),
      ...input.previousComponents.map((component) => component.componentCode),
    ]),
  ).sort((left, right) => left.localeCompare(right));

  return componentCodes.map<PayComponentComparisonRow>((componentCode) => {
    const currentComponent = currentByCode.get(componentCode) ?? null;
    const previousComponent = previousByCode.get(componentCode) ?? null;
    const currentAmount = normalizeAmount(currentComponent?.amount);
    const previousAmount = normalizeAmount(previousComponent?.amount);

    let changeType: PayComponentComparisonRow["changeType"] = "unchanged";

    if (currentComponent && !previousComponent) {
      changeType = "added";
    } else if (!currentComponent && previousComponent) {
      changeType = "removed";
    } else if (currentAmount !== previousAmount) {
      changeType = "changed";
    }

    return {
      category: currentComponent?.category ?? previousComponent?.category ?? null,
      changeType,
      componentCode,
      componentLabel:
        currentComponent?.componentLabel ??
        previousComponent?.componentLabel ??
        componentCode,
      currentAmount,
      deltaAmount: calculateDelta(currentAmount, previousAmount),
      previousAmount,
    };
  });
}

const employeeReviewDrilldownInclude =
  Prisma.validator<Prisma.EmployeeRunRecordInclude>()({
    currentEmployeeMatch: {
      include: {
        previousEmployeeRunRecord: {
          include: {
            payComponents: {
              include: {
                sourceRowRefs: {
                  include: {
                    sourceFile: {
                      select: {
                        kind: true,
                        originalFilename: true,
                      },
                    },
                  },
                  orderBy: {
                    rowNumber: "asc",
                  },
                },
              },
              orderBy: [{ componentCode: "asc" }, { componentLabel: "asc" }],
            },
            sourceFile: {
              select: {
                kind: true,
                originalFilename: true,
              },
            },
            sourceRowRefs: {
              include: {
                sourceFile: {
                  select: {
                    kind: true,
                    originalFilename: true,
                  },
                },
              },
              orderBy: {
                rowNumber: "asc",
              },
            },
          },
        },
      },
    },
    payComponents: {
      include: {
        sourceRowRefs: {
          include: {
            sourceFile: {
              select: {
                kind: true,
                originalFilename: true,
              },
            },
          },
          orderBy: {
            rowNumber: "asc",
          },
        },
      },
      orderBy: [{ componentCode: "asc" }, { componentLabel: "asc" }],
    },
    sourceFile: {
      select: {
        kind: true,
        originalFilename: true,
      },
    },
    sourceRowRefs: {
      include: {
        sourceFile: {
          select: {
            kind: true,
            originalFilename: true,
          },
        },
      },
      orderBy: {
        rowNumber: "asc",
      },
    },
  });

const reviewExceptionDrilldownInclude =
  Prisma.validator<Prisma.ReviewExceptionInclude>()({
    comments: {
      orderBy: {
        createdAt: "asc",
      },
    },
    ruleResult: {
      include: {
        employeePayComponent: true,
      },
    },
  });

export type EmployeeReviewDrilldownRecord = Prisma.EmployeeRunRecordGetPayload<{
  include: typeof employeeReviewDrilldownInclude;
}>;

export type EmployeeReviewDrilldownException = Prisma.ReviewExceptionGetPayload<{
  include: typeof reviewExceptionDrilldownInclude;
}>;

export async function findEmployeeReviewDrilldown(input: {
  clientId: string;
  employeeRunRecordId: string;
  organizationId: string;
  payRunId: string;
}) {
  const currentRecord = await prisma.employeeRunRecord.findFirst({
    where: {
      clientId: input.clientId,
      id: input.employeeRunRecordId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      recordScope: "current",
    },
    include: employeeReviewDrilldownInclude,
  });

  if (!currentRecord) {
    return null;
  }

  const exceptions = await prisma.reviewException.findMany({
    where: {
      clientId: input.clientId,
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      ruleResult: {
        employeeRunRecordId: currentRecord.id,
      },
    },
    include: reviewExceptionDrilldownInclude,
    orderBy: [
      {
        ruleResult: {
          severity: "desc",
        },
      },
      {
        createdAt: "desc",
      },
    ],
  });

  const previousRecord =
    currentRecord.currentEmployeeMatch?.previousEmployeeRunRecord ?? null;

  return {
    currentRecord,
    employeeComparisonRows: buildEmployeeComparisonRows({
      currentRecord: {
        employeeDisplayName: currentRecord.employeeDisplayName,
        employeeExternalId: currentRecord.employeeExternalId,
        employeeNumber: currentRecord.employeeNumber,
        grossPay: currentRecord.grossPay?.toString() ?? null,
        netPay: currentRecord.netPay?.toString() ?? null,
      },
      previousRecord: previousRecord
        ? {
            employeeDisplayName: previousRecord.employeeDisplayName,
            employeeExternalId: previousRecord.employeeExternalId,
            employeeNumber: previousRecord.employeeNumber,
            grossPay: previousRecord.grossPay?.toString() ?? null,
            netPay: previousRecord.netPay?.toString() ?? null,
          }
        : null,
    }),
    exceptions,
    payComponentComparisonRows: buildPayComponentComparisonRows({
      currentComponents: currentRecord.payComponents.map((component) => ({
        amount: component.amount.toString(),
        category: component.category,
        componentCode: component.componentCode,
        componentLabel: component.componentLabel,
      })),
      previousComponents:
        previousRecord?.payComponents.map((component) => ({
          amount: component.amount.toString(),
          category: component.category,
          componentCode: component.componentCode,
          componentLabel: component.componentLabel,
        })) ?? [],
    }),
    previousRecord,
  };
}
