import { describe, expect, it } from "vitest";

import {
  buildReviewQueueSummary,
  formatRuleCodeLabel,
  getReviewQueueRuleTypeOptions,
  matchesReviewQueueStatusFilter,
  summarizeRuleDetails,
  type ReviewQueueStatusFilter,
} from "../../lib/review/queue";

describe("review queue helpers", () => {
  it("treats active status as open and in_review for the default operator view", () => {
    const filter: ReviewQueueStatusFilter = "active";

    expect(matchesReviewQueueStatusFilter("open", filter)).toBe(true);
    expect(matchesReviewQueueStatusFilter("in_review", filter)).toBe(true);
    expect(matchesReviewQueueStatusFilter("resolved", filter)).toBe(false);
    expect(matchesReviewQueueStatusFilter("dismissed", filter)).toBe(false);
  });

  it("builds queue summary counts with attention-first severity totals", () => {
    const summary = buildReviewQueueSummary([
      {
        reviewStatus: "open",
        ruleResult: {
          ruleCode: "ZERO_PAY_ANOMALY",
          severity: "blocker",
        },
      },
      {
        reviewStatus: "in_review",
        ruleResult: {
          ruleCode: "NET_VARIANCE_THRESHOLD",
          severity: "warning",
        },
      },
      {
        reviewStatus: "resolved",
        ruleResult: {
          ruleCode: "NEW_EMPLOYEE",
          severity: "info",
        },
      },
      {
        reviewStatus: "dismissed",
        ruleResult: {
          ruleCode: "GROSS_VARIANCE_THRESHOLD",
          severity: "warning",
        },
      },
    ]);

    expect(summary).toEqual({
      activeCount: 2,
      dismissedCount: 1,
      resolvedCount: 1,
      severityCounts: {
        blocker: 1,
        info: 0,
        warning: 1,
      },
      totalCount: 4,
    });
  });

  it("derives sorted rule type options from the available exceptions", () => {
    expect(
      getReviewQueueRuleTypeOptions([
        {
          reviewStatus: "open",
          ruleResult: {
            ruleCode: "ZERO_PAY_ANOMALY",
            severity: "blocker",
          },
        },
        {
          reviewStatus: "open",
          ruleResult: {
            ruleCode: "GROSS_VARIANCE_THRESHOLD",
            severity: "warning",
          },
        },
        {
          reviewStatus: "resolved",
          ruleResult: {
            ruleCode: "GROSS_VARIANCE_THRESHOLD",
            severity: "warning",
          },
        },
      ]),
    ).toEqual([
      {
        label: "Gross variance threshold",
        value: "GROSS_VARIANCE_THRESHOLD",
      },
      {
        label: "Zero pay anomaly",
        value: "ZERO_PAY_ANOMALY",
      },
    ]);
  });

  it("formats rule labels and concise evidence summaries for dense queue rows", () => {
    expect(formatRuleCodeLabel("NET_VARIANCE_THRESHOLD")).toBe(
      "Net variance threshold",
    );

    expect(
      summarizeRuleDetails({
        currentAmount: "3025.00",
        deltaAmount: "280.00",
        metric: "net_pay",
        previousAmount: "2745.00",
        thresholdAmount: "75.00",
      }),
    ).toBe("Net pay 2745.00 -> 3025.00 (delta 280.00, threshold 75.00)");
  });
});
