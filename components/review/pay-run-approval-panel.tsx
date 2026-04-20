"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { PayRunApprovalSummary } from "@/lib/review/approval";

type RecordApprovalActionResult =
  | {
      notice: string;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

type PayRunApprovalPanelProps = {
  canManageApprovalActions: boolean;
  recordApprovalAction: (formData: FormData) => Promise<RecordApprovalActionResult>;
  summary: PayRunApprovalSummary;
};

const approvalStateLabel = {
  approved: "Approved",
  review_in_progress: "Review in progress",
  submitted: "Submitted",
} as const;

function getApprovalStateBadgeClassName(state: PayRunApprovalSummary["currentState"]) {
  if (state === "approved") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  if (state === "submitted") {
    return "border-blue-300 bg-blue-50 text-blue-800";
  }

  return "border-violet-300 bg-violet-50 text-violet-800";
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-IE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function PayRunApprovalPanel({
  canManageApprovalActions,
  recordApprovalAction,
  summary,
}: PayRunApprovalPanelProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = canManageApprovalActions && summary.currentState === "review_in_progress";
  const canApprove = canManageApprovalActions && summary.currentState === "submitted";
  const canReject = canManageApprovalActions && summary.currentState === "submitted";
  const canReopen = canManageApprovalActions && summary.currentState === "approved";

  async function handleAction(action: "approve" | "reject" | "reopen" | "submit") {
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("action", action);
      formData.set("note", note);

      const result = await recordApprovalAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setNotice(result.notice);
      setNote("");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Approval workflow update failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="rounded-md border-border/80">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Approval workflow</CardTitle>
            <CardDescription>
              Append-only review events with strict blocker gating on approval.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={`rounded-md ${getApprovalStateBadgeClassName(summary.currentState)}`}
          >
            {approvalStateLabel[summary.currentState]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border/80 px-3 py-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Active exceptions
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {summary.activeExceptionCount}
            </p>
          </div>
          <div className="rounded-md border border-border/80 px-3 py-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Blockers
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {summary.blockingExceptionCount}
            </p>
          </div>
          <div className="rounded-md border border-border/80 px-3 py-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Latest event
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {summary.latestEvent
                ? `${summary.latestEvent.eventType} ${dateTimeFormatter.format(summary.latestEvent.createdAt)}`
                : "No review events yet"}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm">
          {summary.blockingExceptionCount > 0 ? (
            <p className="text-foreground">
              Approval is blocked until {summary.blockingExceptionCount} unresolved
              blocker
              {summary.blockingExceptionCount === 1 ? "" : "s"} are resolved or
              ignored.
            </p>
          ) : (
            <p className="text-foreground">
              No unresolved blocker exceptions are currently blocking approval.
            </p>
          )}
        </div>

        {canManageApprovalActions ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <label
                htmlFor="approval-note"
                className="text-sm font-medium text-foreground"
              >
                Review note
              </label>
              <Textarea
                id="approval-note"
                onChange={(event) => setNote(event.target.value)}
                placeholder="Required for reject and reopen actions. Saved on the approval event."
                value={note}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {canSubmit ? (
                <Button
                  className="rounded-md"
                  disabled={isSubmitting}
                  onClick={() => void handleAction("submit")}
                  type="button"
                >
                  Submit for approval
                </Button>
              ) : null}
              {canApprove ? (
                <Button
                  className="rounded-md"
                  disabled={isSubmitting || summary.blockingExceptionCount > 0}
                  onClick={() => void handleAction("approve")}
                  type="button"
                >
                  Approve pay run
                </Button>
              ) : null}
              {canReject ? (
                <Button
                  className="rounded-md"
                  disabled={isSubmitting}
                  onClick={() => void handleAction("reject")}
                  type="button"
                  variant="outline"
                >
                  Reject to queue
                </Button>
              ) : null}
              {canReopen ? (
                <Button
                  className="rounded-md"
                  disabled={isSubmitting}
                  onClick={() => void handleAction("reopen")}
                  type="button"
                  variant="outline"
                >
                  Reopen review
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only reviewers and admins can submit, approve, reject, or reopen pay
            runs.
          </p>
        )}

        {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {summary.events.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Approval history</p>
            <div className="space-y-2">
              {summary.events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-md border border-border/80 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-md capitalize">
                      {event.eventType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {dateTimeFormatter.format(event.createdAt)}
                    </span>
                  </div>
                  {event.note ? (
                    <p className="mt-2 text-sm text-foreground">{event.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
