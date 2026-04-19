import type {
  NormalizedEmployeePayComponent,
  NormalizedEmployeeRunRecord,
  NormalizedPayrollDataset,
} from "@/lib/imports/payroll-normalization";
import type { EmployeeRunMatchingResult } from "@/lib/review/employee-matching";

export type ReviewRuleFinding = {
  details: Record<string, unknown>;
  employeeDisplayName: string;
  employeeMatchId?: string;
  employeePayComponentId?: string;
  employeeRunRecordId: string;
  ruleCode:
    | "DUPLICATE_IDENTIFIER"
    | "GROSS_VARIANCE_THRESHOLD"
    | "HOURS_VARIANCE_THRESHOLD"
    | "MISSING_EMPLOYEE"
    | "NET_VARIANCE_THRESHOLD"
    | "NEW_EMPLOYEE"
    | "PENSION_VARIANCE_THRESHOLD"
    | "TAX_VARIANCE_THRESHOLD"
    | "ZERO_PAY_ANOMALY";
  ruleMessage: string;
  ruleVersion: string;
  severity: "blocker" | "info" | "warning";
};

type EvaluateDeterministicReviewRulesInput = {
  currentDataset: NormalizedPayrollDataset;
  matchResult: EmployeeRunMatchingResult;
  previousDataset: NormalizedPayrollDataset;
  ruleVersion: string;
};

const RULE_THRESHOLDS = {
  grossVarianceAmount: 100,
  hoursVarianceAmount: 2,
  netVarianceAmount: 75,
  pensionVarianceAmount: 25,
  taxVarianceAmount: 50,
} as const;

function normalizeText(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function formatAmount(amount: number) {
  return amount.toFixed(2);
}

function parseAmount(value: string | undefined) {
  return Number.parseFloat(value ?? "0");
}

function buildComponentIndex(components: NormalizedEmployeePayComponent[]) {
  const index = new Map<string, NormalizedEmployeePayComponent[]>();

  components.forEach((component) => {
    const current = index.get(component.employeeRunRecordKey) ?? [];
    current.push(component);
    index.set(component.employeeRunRecordKey, current);
  });

  return index;
}

function sumMatchingComponents(
  components: NormalizedEmployeePayComponent[] | undefined,
  matcher: RegExp,
) {
  return (components ?? [])
    .filter((component) => matcher.test(component.componentLabel))
    .reduce((total, component) => total + parseAmount(component.amount), 0);
}

function buildDuplicateIdentifierFindings(
  records: NormalizedEmployeeRunRecord[],
  ruleVersion: string,
) {
  const duplicateDetailsByRecord = new Map<
    string,
    {
      employeeDisplayName: string;
      identifiers: Array<{
        duplicateRecordIds: string[];
        identifierType: "employee_external_id" | "employee_number";
        identifierValue: string;
      }>;
    }
  >();

  const collectDuplicates = (
    identifierType: "employee_external_id" | "employee_number",
    selector: (record: NormalizedEmployeeRunRecord) => string | undefined,
  ) => {
    const recordsByIdentifier = new Map<string, NormalizedEmployeeRunRecord[]>();

    records.forEach((record) => {
      const identifierValue = normalizeText(selector(record));

      if (!identifierValue) {
        return;
      }

      const current = recordsByIdentifier.get(identifierValue) ?? [];
      current.push(record);
      recordsByIdentifier.set(identifierValue, current);
    });

    recordsByIdentifier.forEach((matchingRecords, identifierValue) => {
      if (matchingRecords.length < 2) {
        return;
      }

      const duplicateRecordIds = matchingRecords.map((record) => record.recordKey);

      matchingRecords.forEach((record) => {
        const current = duplicateDetailsByRecord.get(record.recordKey) ?? {
          employeeDisplayName: record.employeeDisplayName,
          identifiers: [],
        };
        current.identifiers.push({
          duplicateRecordIds,
          identifierType,
          identifierValue,
        });
        duplicateDetailsByRecord.set(record.recordKey, current);
      });
    });
  };

  collectDuplicates("employee_external_id", (record) => record.employeeExternalId);
  collectDuplicates("employee_number", (record) => record.employeeNumber);

  return Array.from(duplicateDetailsByRecord.entries()).map(([recordKey, details]) => ({
    details: {
      identifiers: details.identifiers,
    },
    employeeDisplayName: details.employeeDisplayName,
    employeeRunRecordId: recordKey,
    ruleCode: "DUPLICATE_IDENTIFIER" as const,
    ruleMessage: "Duplicate employee identifiers require reviewer confirmation.",
    ruleVersion,
    severity: "blocker" as const,
  }));
}

function createVarianceFinding(input: {
  currentAmount: number;
  currentRecord: NormalizedEmployeeRunRecord;
  label: string;
  previousAmount: number;
  ruleCode: ReviewRuleFinding["ruleCode"];
  ruleMessage: string;
  ruleVersion: string;
  severity: ReviewRuleFinding["severity"];
  thresholdAmount: number;
}) {
  const deltaAmount = Math.abs(input.currentAmount - input.previousAmount);

  if (deltaAmount <= input.thresholdAmount) {
    return null;
  }

  return {
    details: {
      currentAmount: formatAmount(input.currentAmount),
      deltaAmount: formatAmount(deltaAmount),
      metric: input.label,
      previousAmount: formatAmount(input.previousAmount),
      thresholdAmount: formatAmount(input.thresholdAmount),
    },
    employeeDisplayName: input.currentRecord.employeeDisplayName,
    employeeRunRecordId: input.currentRecord.recordKey,
    ruleCode: input.ruleCode,
    ruleMessage: input.ruleMessage,
    ruleVersion: input.ruleVersion,
    severity: input.severity,
  } satisfies ReviewRuleFinding;
}

export function evaluateDeterministicReviewRules(
  input: EvaluateDeterministicReviewRulesInput,
) {
  const findings: ReviewRuleFinding[] = [];
  const currentComponentsByRecord = buildComponentIndex(
    input.currentDataset.employeePayComponents,
  );
  const previousComponentsByRecord = buildComponentIndex(
    input.previousDataset.employeePayComponents,
  );
  const previousRecordsByKey = new Map(
    input.previousDataset.employeeRunRecords.map((record) => [record.recordKey, record]),
  );

  findings.push(
    ...buildDuplicateIdentifierFindings(
      input.currentDataset.employeeRunRecords,
      input.ruleVersion,
    ),
  );

  input.currentDataset.employeeRunRecords.forEach((record) => {
    if (parseAmount(record.grossPay) === 0 || parseAmount(record.netPay) === 0) {
      findings.push({
        details: {
          grossPay: record.grossPay,
          netPay: record.netPay,
        },
        employeeDisplayName: record.employeeDisplayName,
        employeeRunRecordId: record.recordKey,
        ruleCode: "ZERO_PAY_ANOMALY",
        ruleMessage: "Zero pay requires reviewer confirmation.",
        ruleVersion: input.ruleVersion,
        severity: "blocker",
      });
    }
  });

  input.matchResult.currentMatches.forEach((match) => {
    const currentRecord = input.currentDataset.employeeRunRecords.find(
      (record) => record.recordKey === match.currentRecordKey,
    );

    if (!currentRecord) {
      return;
    }

    if (match.status === "new_employee") {
      findings.push({
        details: {
          reason: match.reason,
        },
        employeeDisplayName: currentRecord.employeeDisplayName,
        employeeRunRecordId: currentRecord.recordKey,
        ruleCode: "NEW_EMPLOYEE",
        ruleMessage: "Employee is present in the current payroll but not the previous payroll.",
        ruleVersion: input.ruleVersion,
        severity: "info",
      });
      return;
    }

    if (match.status !== "matched" || !match.previousRecordKey) {
      return;
    }

    const previousRecord = previousRecordsByKey.get(match.previousRecordKey);

    if (!previousRecord) {
      return;
    }

    const grossVarianceFinding = createVarianceFinding({
      currentAmount: parseAmount(currentRecord.grossPay),
      currentRecord,
      label: "gross_pay",
      previousAmount: parseAmount(previousRecord.grossPay),
      ruleCode: "GROSS_VARIANCE_THRESHOLD",
      ruleMessage: "Gross pay changed beyond the deterministic threshold.",
      ruleVersion: input.ruleVersion,
      severity: "warning",
      thresholdAmount: RULE_THRESHOLDS.grossVarianceAmount,
    });

    const netVarianceFinding = createVarianceFinding({
      currentAmount: parseAmount(currentRecord.netPay),
      currentRecord,
      label: "net_pay",
      previousAmount: parseAmount(previousRecord.netPay),
      ruleCode: "NET_VARIANCE_THRESHOLD",
      ruleMessage: "Net pay changed beyond the deterministic threshold.",
      ruleVersion: input.ruleVersion,
      severity: "warning",
      thresholdAmount: RULE_THRESHOLDS.netVarianceAmount,
    });

    const taxVarianceFinding = createVarianceFinding({
      currentAmount: sumMatchingComponents(
        currentComponentsByRecord.get(currentRecord.recordKey),
        /^(paye|usc|employee prsi)$/i,
      ),
      currentRecord,
      label: "tax_total",
      previousAmount: sumMatchingComponents(
        previousComponentsByRecord.get(previousRecord.recordKey),
        /^(paye|usc|employee prsi)$/i,
      ),
      ruleCode: "TAX_VARIANCE_THRESHOLD",
      ruleMessage: "Employee tax moved beyond the deterministic threshold.",
      ruleVersion: input.ruleVersion,
      severity: "warning",
      thresholdAmount: RULE_THRESHOLDS.taxVarianceAmount,
    });

    const pensionVarianceFinding = createVarianceFinding({
      currentAmount: sumMatchingComponents(
        currentComponentsByRecord.get(currentRecord.recordKey),
        /pension/i,
      ),
      currentRecord,
      label: "pension_total",
      previousAmount: sumMatchingComponents(
        previousComponentsByRecord.get(previousRecord.recordKey),
        /pension/i,
      ),
      ruleCode: "PENSION_VARIANCE_THRESHOLD",
      ruleMessage: "Pension moved beyond the deterministic threshold.",
      ruleVersion: input.ruleVersion,
      severity: "warning",
      thresholdAmount: RULE_THRESHOLDS.pensionVarianceAmount,
    });

    const hoursVarianceFinding = createVarianceFinding({
      currentAmount: sumMatchingComponents(
        currentComponentsByRecord.get(currentRecord.recordKey),
        /hours/i,
      ),
      currentRecord,
      label: "hours_total",
      previousAmount: sumMatchingComponents(
        previousComponentsByRecord.get(previousRecord.recordKey),
        /hours/i,
      ),
      ruleCode: "HOURS_VARIANCE_THRESHOLD",
      ruleMessage: "Hours changed beyond the deterministic threshold.",
      ruleVersion: input.ruleVersion,
      severity: "warning",
      thresholdAmount: RULE_THRESHOLDS.hoursVarianceAmount,
    });

    [
      grossVarianceFinding,
      netVarianceFinding,
      taxVarianceFinding,
      pensionVarianceFinding,
      hoursVarianceFinding,
    ].forEach((finding) => {
      if (finding) {
        findings.push(finding);
      }
    });
  });

  input.matchResult.missingPreviousRecords.forEach((missingRecord) => {
    const previousRecord = previousRecordsByKey.get(missingRecord.previousRecordKey);

    if (!previousRecord) {
      return;
    }

    findings.push({
      details: {
        reason: missingRecord.reason,
      },
      employeeDisplayName: previousRecord.employeeDisplayName,
      employeeRunRecordId: previousRecord.recordKey,
      ruleCode: "MISSING_EMPLOYEE",
      ruleMessage:
        "Employee is present in the previous payroll but missing from the current payroll.",
      ruleVersion: input.ruleVersion,
      severity: "warning",
    });
  });

  return findings;
}
