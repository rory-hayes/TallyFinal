"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PayRunApprovalSummary } from "@/lib/review/approval";
import type { PayRunReviewProcessingSummary } from "@/lib/pay-runs/processing";

type PayRunProcessingPanelProps = {
  approvalSummary: PayRunApprovalSummary;
  clientId: string;
  orgSlug: string;
  payRunId: string;
  summary: PayRunReviewProcessingSummary;
};

function getStateBadgeClassName(state: PayRunReviewProcessingSummary["state"]["code"]) {
  if (state === "completed") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  if (state === "queued" || state === "processing") {
    return "border-blue-300 bg-blue-50 text-blue-800";
  }

  if (state === "failed") {
    return "border-red-300 bg-red-50 text-red-800";
  }

  return "border-amber-300 bg-amber-50 text-amber-800";
}

export function PayRunProcessingPanel({
  approvalSummary,
  clientId,
  orgSlug,
  payRunId,
  summary,
}: PayRunProcessingPanelProps) {
  const exportQuery = `orgSlug=${encodeURIComponent(orgSlug)}&clientId=${encodeURIComponent(clientId)}`;
  const latestRun = summary.latestRun;

  return (
    <Card className="rounded-md border-border/80">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Reviewer processing and exports</CardTitle>
            <CardDescription>
              Snapshot builds, reruns, and exports stay explicit here while the
              queue remains the primary workspace.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={`rounded-md capitalize ${getStateBadgeClassName(summary.state.code)}`}
          >
            {summary.state.code.replace(/_/g, " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border/80 px-3 py-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Active snapshot
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {summary.activeReviewSnapshotVersion || "None"}
            </p>
          </div>
          <div className="rounded-md border border-border/80 px-3 py-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Current payroll
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {summary.currentPayroll ? `v${summary.currentPayroll.version}` : "Awaiting file"}
            </p>
          </div>
          <div className="rounded-md border border-border/80 px-3 py-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Previous payroll
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {summary.previousPayroll ? `v${summary.previousPayroll.version}` : "Awaiting file"}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm text-foreground">
          {summary.state.detail}
        </div>

        {latestRun ? (
          <div className="rounded-md border border-border/80 px-3 py-3 text-sm">
            <p className="font-medium text-foreground">Latest processing run</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <p className="text-muted-foreground">
                Requested {latestRun.requestedAt.toLocaleString("en-IE")}
              </p>
              <p className="text-muted-foreground">
                Snapshot{" "}
                {latestRun.resultingSnapshotVersion
                  ? latestRun.resultingSnapshotVersion
                  : "pending"}
              </p>
              {latestRun.triggerRunId ? (
                <p className="text-muted-foreground">Trigger run {latestRun.triggerRunId}</p>
              ) : null}
              {latestRun.errorMessage ? (
                <p className="text-destructive">{latestRun.errorMessage}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-md">
            <Link href={`/api/pay-runs/${payRunId}/exports/exceptions?${exportQuery}`}>
              Exception CSV
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-md">
            <Link href={`/api/pay-runs/${payRunId}/exports/reconciliation?${exportQuery}`}>
              Reconciliation CSV
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-md">
            <Link href={`/api/pay-runs/${payRunId}/exports/audit?${exportQuery}`}>
              Audit export
            </Link>
          </Button>
          {approvalSummary.currentState === "approved" ? (
            <Button asChild className="rounded-md">
              <Link href={`/api/pay-runs/${payRunId}/exports/sign-off?${exportQuery}`}>
                Sign-off PDF
              </Link>
            </Button>
          ) : (
            <p className="self-center text-sm text-muted-foreground">
              Sign-off PDF unlocks after approval on the active snapshot.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
