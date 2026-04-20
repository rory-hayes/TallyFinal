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
import { formatRuleCodeLabel, summarizeRuleDetails } from "@/lib/review/queue";
import type { EmployeeReviewDrilldownException } from "@/lib/review/drilldown";

type EmployeeExceptionWorkspaceProps = {
  canManageReviewExceptions: boolean;
  clientId: string;
  exceptions: EmployeeReviewDrilldownException[];
  orgSlug: string;
  payRunId: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-IE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getSeverityBadgeClassName(
  severity: "blocker" | "info" | "warning",
) {
  if (severity === "blocker") {
    return "border-red-300 bg-red-50 text-red-800";
  }

  if (severity === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  return "border-sky-300 bg-sky-50 text-sky-800";
}

function getStatusBadgeClassName(status: string) {
  if (status === "resolved") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  if (status === "dismissed") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  if (status === "in_review") {
    return "border-blue-300 bg-blue-50 text-blue-800";
  }

  return "border-violet-300 bg-violet-50 text-violet-800";
}

function EmployeeExceptionCard({
  canManageReviewExceptions,
  clientId,
  exception,
  orgSlug,
  payRunId,
}: {
  canManageReviewExceptions: boolean;
  clientId: string;
  exception: EmployeeReviewDrilldownException;
  orgSlug: string;
  payRunId: string;
}) {
  const router = useRouter();
  const [commentBody, setCommentBody] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCommentSubmit() {
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/review/exceptions/${exception.id}/comments`,
        {
          body: JSON.stringify({
            body: commentBody,
            clientId,
            orgSlug,
            payRunId,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const result = (await response.json()) as
        | {
            error: string;
          }
        | {
            ok: true;
          };

      if (!response.ok || !("ok" in result)) {
        setError(
          "error" in result ? result.error : "Comment could not be saved.",
        );
        return;
      }

      setCommentBody("");
      setNotice("Comment added to the exception timeline.");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Comment could not be saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusUpdate(action: "ignore" | "resolve") {
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/review/exceptions", {
        body: JSON.stringify({
          action,
          clientId,
          exceptionIds: [exception.id],
          note: resolutionNote,
          orgSlug,
          payRunId,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      });
      const result = (await response.json()) as
        | {
            error: string;
          }
        | {
            ok: true;
            updatedExceptionCount: number;
          };

      if (!response.ok || !("ok" in result)) {
        setError(
          "error" in result ? result.error : "Exception update failed.",
        );
        return;
      }

      setResolutionNote("");
      setNotice(
        action === "resolve"
          ? "Exception resolved from drilldown."
          : "Exception ignored from drilldown.",
      );
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Exception update failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border/80 px-3 py-3">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`rounded-md capitalize ${getSeverityBadgeClassName(exception.ruleResult.severity)}`}
          >
            {exception.ruleResult.severity}
          </Badge>
          <Badge
            variant="outline"
            className={`rounded-md ${getStatusBadgeClassName(exception.reviewStatus)}`}
          >
            {exception.reviewStatus.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            {formatRuleCodeLabel(exception.ruleResult.ruleCode)}
          </p>
          <p className="text-sm text-muted-foreground">
            {exception.ruleResult.ruleMessage}
          </p>
          <p className="text-xs text-muted-foreground">
            {summarizeRuleDetails(exception.ruleResult.details)}
          </p>
        </div>
      </div>

      {exception.comments.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Timeline</p>
          <div className="space-y-2">
            {exception.comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-md border border-border/80 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-md capitalize">
                    {comment.commentType.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {dateTimeFormatter.format(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground">{comment.body}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {canManageReviewExceptions ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Add comment
            </label>
            <Textarea
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="Capture evidence, follow-up, or reviewer context."
              value={commentBody}
            />
            <Button
              className="rounded-md"
              disabled={isSubmitting || !commentBody.trim()}
              onClick={() => void handleCommentSubmit()}
              size="sm"
              type="button"
              variant="outline"
            >
              Save comment
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Resolution note
            </label>
            <Textarea
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="Optional note stored with the exception status change."
              value={resolutionNote}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-md"
                disabled={isSubmitting}
                onClick={() => void handleStatusUpdate("resolve")}
                size="sm"
                type="button"
              >
                Resolve
              </Button>
              <Button
                className="rounded-md"
                disabled={isSubmitting}
                onClick={() => void handleStatusUpdate("ignore")}
                size="sm"
                type="button"
                variant="outline"
              >
                Ignore
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your role can inspect exception history but cannot comment or change
          exception status.
        </p>
      )}

      {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function EmployeeExceptionWorkspace({
  canManageReviewExceptions,
  clientId,
  exceptions,
  orgSlug,
  payRunId,
}: EmployeeExceptionWorkspaceProps) {
  return (
    <Card className="rounded-md border-border/80">
      <CardHeader>
        <CardTitle>Exception workspace</CardTitle>
        <CardDescription>
          Comments, status changes, and rule context stay attached to the
          immutable finding here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {exceptions.length ? (
          exceptions.map((exception) => (
            <EmployeeExceptionCard
              key={exception.id}
              canManageReviewExceptions={canManageReviewExceptions}
              clientId={clientId}
              exception={exception}
              orgSlug={orgSlug}
              payRunId={payRunId}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No review exceptions are currently attached to this employee.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
