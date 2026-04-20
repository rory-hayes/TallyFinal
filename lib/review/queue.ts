type ReviewExceptionStatus = "dismissed" | "in_review" | "open" | "resolved";
type RuleResultSeverity = "blocker" | "info" | "warning";

export type ReviewQueueStatusFilter = "active" | "all" | ReviewExceptionStatus;

type SummaryLikeException = {
  reviewStatus: ReviewExceptionStatus;
  ruleResult: {
    ruleCode: string;
    severity: RuleResultSeverity;
  };
};

const ACTIVE_REVIEW_STATUSES = new Set<ReviewExceptionStatus>([
  "open",
  "in_review",
]);

function titleCaseWords(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sentenceCaseWords(value: string) {
  const normalized = value.toLowerCase();

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDetailLabel(key: string) {
  return sentenceCaseWords(key.replace(/_/g, " "));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function matchesReviewQueueStatusFilter(
  status: ReviewExceptionStatus,
  filter: ReviewQueueStatusFilter,
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "active") {
    return ACTIVE_REVIEW_STATUSES.has(status);
  }

  return status === filter;
}

export function buildReviewQueueSummary(exceptions: SummaryLikeException[]) {
  return exceptions.reduce(
    (summary, exception) => {
      summary.totalCount += 1;

      if (matchesReviewQueueStatusFilter(exception.reviewStatus, "active")) {
        summary.activeCount += 1;
        summary.severityCounts[exception.ruleResult.severity] += 1;
      }

      if (exception.reviewStatus === "resolved") {
        summary.resolvedCount += 1;
      }

      if (exception.reviewStatus === "dismissed") {
        summary.dismissedCount += 1;
      }

      return summary;
    },
    {
      activeCount: 0,
      dismissedCount: 0,
      resolvedCount: 0,
      severityCounts: {
        blocker: 0,
        info: 0,
        warning: 0,
      },
      totalCount: 0,
    },
  );
}

export function formatRuleCodeLabel(ruleCode: string) {
  return sentenceCaseWords(ruleCode.replace(/_/g, " "));
}

export function formatReviewStatusLabel(status: ReviewExceptionStatus) {
  return titleCaseWords(status.replace(/_/g, " "));
}

export function getReviewQueueRuleTypeOptions(exceptions: SummaryLikeException[]) {
  return Array.from(
    new Set(exceptions.map((exception) => exception.ruleResult.ruleCode)),
  )
    .sort((left, right) => left.localeCompare(right))
    .map((ruleCode) => ({
      label: formatRuleCodeLabel(ruleCode),
      value: ruleCode,
    }));
}

export function summarizeRuleDetails(details: unknown) {
  if (!isRecord(details)) {
    return "Inspect employee drilldown for source evidence.";
  }

  const metric = typeof details.metric === "string" ? details.metric : null;
  const previousAmount =
    typeof details.previousAmount === "string" ? details.previousAmount : null;
  const currentAmount =
    typeof details.currentAmount === "string" ? details.currentAmount : null;
  const deltaAmount =
    typeof details.deltaAmount === "string" ? details.deltaAmount : null;
  const thresholdAmount =
    typeof details.thresholdAmount === "string" ? details.thresholdAmount : null;

  if (metric && previousAmount && currentAmount && deltaAmount && thresholdAmount) {
    return `${formatDetailLabel(metric)} ${previousAmount} -> ${currentAmount} (delta ${deltaAmount}, threshold ${thresholdAmount})`;
  }

  if (
    typeof details.grossPay === "string" &&
    typeof details.netPay === "string"
  ) {
    return `Gross ${details.grossPay}, net ${details.netPay}`;
  }

  if (typeof details.reason === "string") {
    return formatDetailLabel(details.reason);
  }

  const fragments = Object.entries(details)
    .slice(0, 3)
    .map(([key, value]) => {
      if (value == null) {
        return null;
      }

      if (typeof value === "string" || typeof value === "number") {
        return `${formatDetailLabel(key)} ${value}`;
      }

      if (Array.isArray(value)) {
        return `${formatDetailLabel(key)} ${value.length}`;
      }

      return formatDetailLabel(key);
    })
    .filter((value): value is string => Boolean(value));

  return fragments.join(" • ") || "Inspect employee drilldown for source evidence.";
}
