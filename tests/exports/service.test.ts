import { describe, expect, it } from "vitest";

import {
  buildAuditExport,
  buildExceptionExportRows,
  buildReconciliationExportRows,
} from "../../lib/exports/service";

describe("buildExceptionExportRows", () => {
  it("flattens active reviewer data into export-ready rows with source lineage", () => {
    const rows = buildExceptionExportRows([
      {
        assigneeLabel: "Aoife Murphy",
        commentsCount: 3,
        employeeDisplayName: "Brian Kelly",
        employeeExternalId: "EMP-002",
        employeeNumber: "2002",
        firstSourceRowNumber: 18,
        reviewStatus: "open",
        ruleCode: "NET_VARIANCE_THRESHOLD",
        ruleMessage: "Net pay changed beyond the deterministic threshold.",
        severity: "warning",
      },
    ]);

    expect(rows).toEqual([
      {
        assignee: "Aoife Murphy",
        commentsCount: "3",
        employeeDisplayName: "Brian Kelly",
        employeeExternalId: "EMP-002",
        employeeNumber: "2002",
        firstSourceRowNumber: "18",
        reviewStatus: "open",
        ruleCode: "NET_VARIANCE_THRESHOLD",
        ruleMessage: "Net pay changed beyond the deterministic threshold.",
        severity: "warning",
      },
    ]);
  });
});

describe("buildReconciliationExportRows", () => {
  it("flattens secondary reconciliation rows without changing their reviewer-secondary meaning", () => {
    const rows = buildReconciliationExportRows([
      {
        checkKind: "payroll_to_payment",
        label: "Payroll net vs payment total",
        normalizedRowCount: 42,
        payrollAmount: "15000.00",
        sourceAmount: "14999.00",
        sourceFileName: "payments-v2.csv",
        sourceFileVersion: 2,
        state: "within_tolerance",
        toleranceAmount: "1.00",
        varianceAmount: "1.00",
      },
    ]);

    expect(rows).toEqual([
      {
        checkKind: "payroll_to_payment",
        label: "Payroll net vs payment total",
        normalizedRowCount: "42",
        payrollAmount: "15000.00",
        sourceAmount: "14999.00",
        sourceFileName: "payments-v2.csv",
        sourceFileVersion: "2",
        state: "within_tolerance",
        toleranceAmount: "1.00",
        varianceAmount: "1.00",
      },
    ]);
  });
});

describe("buildAuditExport", () => {
  it("includes source lineage, processing history, review state, and approval events in one durable export payload", () => {
    const auditExport = buildAuditExport({
      approvalEvents: [
        {
          actorUserId: "user_admin",
          createdAt: "2026-04-20T11:00:00.000Z",
          eventType: "approved",
          note: "Approved after source evidence review.",
          reviewSnapshotVersion: 3,
        },
      ],
      client: {
        id: "client_123",
        name: "Acme Payroll",
      },
      exceptions: [
        {
          comments: [
            {
              authorUserId: "user_reviewer",
              body: "Confirmed with payroll manager.",
              commentType: "comment",
              createdAt: "2026-04-20T10:30:00.000Z",
            },
          ],
          employeeDisplayName: "Brian Kelly",
          reviewStatus: "resolved",
          ruleCode: "NET_VARIANCE_THRESHOLD",
          severity: "warning",
        },
      ],
      organization: {
        id: "org_123",
        name: "North Bureau",
        slug: "north-bureau",
      },
      payRun: {
        activeReviewSnapshotVersion: 3,
        id: "run_123",
        title: "April 2026 payroll",
      },
      processingRuns: [
        {
          completedAt: "2026-04-20T10:15:00.000Z",
          currentMappingSignature: "current-map-v2",
          currentSourceFileId: "current_v2",
          errorMessage: null,
          previousMappingSignature: "previous-map-v1",
          previousSourceFileId: "previous_v1",
          requestedAt: "2026-04-20T10:10:00.000Z",
          resultingSnapshotVersion: 3,
          startedAt: "2026-04-20T10:11:00.000Z",
          status: "completed",
        },
      ],
      sourceFiles: [
        {
          checksumSha256: "abc123",
          id: "current_v2",
          kind: "current_payroll",
          originalFilename: "current-april-v2.csv",
          replacementOfId: "current_v1",
          status: "uploaded",
          version: 2,
        },
      ],
    });

    expect(auditExport).toEqual({
      approvalEvents: expect.any(Array),
      client: {
        id: "client_123",
        name: "Acme Payroll",
      },
      exceptions: expect.any(Array),
      generatedAt: expect.any(String),
      organization: {
        id: "org_123",
        name: "North Bureau",
        slug: "north-bureau",
      },
      payRun: {
        activeReviewSnapshotVersion: 3,
        id: "run_123",
        title: "April 2026 payroll",
      },
      processingRuns: expect.any(Array),
      sourceFiles: expect.any(Array),
    });
  });
});
