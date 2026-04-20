import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EmployeeExceptionWorkspace } from "@/components/review/employee-exception-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { findClientForOrganization } from "@/lib/clients/service";
import { findPayRunForClient } from "@/lib/pay-runs/service";
import {
  findEmployeeReviewDrilldown,
  type PayComponentComparisonRow,
} from "@/lib/review/drilldown";
import { formatRuleCodeLabel, summarizeRuleDetails } from "@/lib/review/queue";
import { canManageReviewExceptions } from "@/lib/tenancy/access";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";

type EmployeeReviewDrilldownPageProps = {
  params: Promise<{
    clientId: string;
    employeeRunRecordId: string;
    orgSlug: string;
    payRunId: string;
  }>;
};

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatAmount(value: string | null) {
  return value ?? "—";
}

function getChangeBadge(changeType: PayComponentComparisonRow["changeType"]) {
  if (changeType === "added") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  if (changeType === "removed") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  if (changeType === "changed") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  return "border-border bg-background text-muted-foreground";
}

export default async function EmployeeReviewDrilldownPage({
  params,
}: EmployeeReviewDrilldownPageProps) {
  const { clientId, employeeRunRecordId, orgSlug, payRunId } = await params;
  const user = await requireAuthenticatedUser();
  const organizationContext = await findOrganizationContextForUser(
    user.id,
    orgSlug,
  );

  if (!organizationContext) {
    redirect("/app");
  }

  const client = await findClientForOrganization({
    organizationId: organizationContext.organization.id,
    clientId,
  });

  if (!client) {
    notFound();
  }

  const payRun = await findPayRunForClient({
    organizationId: organizationContext.organization.id,
    clientId: client.id,
    payRunId,
  });

  if (!payRun) {
    notFound();
  }

  const drilldown = await findEmployeeReviewDrilldown({
    clientId: client.id,
    employeeRunRecordId,
    organizationId: organizationContext.organization.id,
    payRunId: payRun.id,
    reviewSnapshotVersion: payRun.activeReviewSnapshotVersion,
  });

  if (!drilldown) {
    notFound();
  }

  const reviewMutationAllowed = canManageReviewExceptions(organizationContext.role);
  const subjectRecord = drilldown.currentRecord ?? drilldown.previousRecord;
  const previousRecord = drilldown.previousRecord;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {subjectRecord?.employeeDisplayName ?? "Employee review"}
            </h1>
            <Badge variant="outline" className="rounded-md">
              {drilldown.currentRecord ? "Current run" : "Previous run"}
            </Badge>
            {drilldown.currentRecord?.currentEmployeeMatch?.matchMethod ? (
              <Badge variant="outline" className="rounded-md capitalize">
                {drilldown.currentRecord.currentEmployeeMatch.matchMethod.replace(
                  /_/g,
                  " ",
                )}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Current vs previous employee review with deterministic findings,
            normalized component deltas, and source-row evidence in one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-md">
            <Link href={`/app/orgs/${orgSlug}/clients/${client.id}/pay-runs/${payRun.id}`}>
              Back to queue
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.9fr)]">
        <div className="space-y-4">
          <Card className="rounded-md border-border/80">
            <CardHeader>
              <CardTitle>Current vs previous values</CardTitle>
              <CardDescription>
                Changed fields are highlighted so the reviewer can see what
                moved before going deeper into rule details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Previous</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldown.employeeComparisonRows.map((row) => (
                    <TableRow
                      key={row.fieldKey}
                      className={row.changed ? "bg-amber-50/60" : undefined}
                    >
                      <TableCell className="font-medium text-foreground">
                        {row.label}
                      </TableCell>
                      <TableCell>{row.previousValue ?? "—"}</TableCell>
                      <TableCell>{row.currentValue ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-md ${row.changed ? "border-amber-300 bg-amber-50 text-amber-800" : "border-border bg-background text-muted-foreground"}`}
                        >
                          {row.changed ? "Changed" : "Same"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-md border-border/80">
            <CardHeader>
              <CardTitle>Normalized pay components</CardTitle>
              <CardDescription>
                Components are compared by canonical code so earnings and
                deductions are readable outside the raw import file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {drilldown.payComponentComparisonRows.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Previous</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Delta</TableHead>
                      <TableHead>Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drilldown.payComponentComparisonRows.map((row) => (
                      <TableRow
                        key={row.componentCode}
                        className={row.changeType !== "unchanged" ? "bg-amber-50/40" : undefined}
                      >
                        <TableCell className="whitespace-normal">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              {row.componentLabel}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.componentCode}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {row.category?.replace(/_/g, " ") ?? "—"}
                        </TableCell>
                        <TableCell>{formatAmount(row.previousAmount)}</TableCell>
                        <TableCell>{formatAmount(row.currentAmount)}</TableCell>
                        <TableCell>{formatAmount(row.deltaAmount)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-md capitalize ${getChangeBadge(row.changeType)}`}
                          >
                            {row.changeType}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No normalized pay components are available for this employee
                  yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <EmployeeExceptionWorkspace
          canManageReviewExceptions={reviewMutationAllowed}
          clientId={client.id}
          exceptions={drilldown.exceptions}
          orgSlug={orgSlug}
          payRunId={payRun.id}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
          <Card className="rounded-md border-border/80">
            <CardHeader>
              <CardTitle>Current-run evidence</CardTitle>
            <CardDescription>
              Canonical employee values and normalized components traced back to
              current source rows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {drilldown.currentRecord ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Record lineage</p>
                  {drilldown.currentRecord.sourceRowRefs.length ? (
                    <div className="space-y-2">
                      {drilldown.currentRecord.sourceRowRefs.map((sourceRowRef) => (
                        <div
                          key={sourceRowRef.id}
                          className="rounded-md border border-border/80 px-3 py-2"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {sourceRowRef.canonicalFieldKey || "Record field"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sourceRowRef.sourceFile.kind} · row {sourceRowRef.rowNumber}
                          </p>
                          <p className="mt-1 text-sm text-foreground">
                            {sourceRowRef.columnHeader || "Source column"}:{" "}
                            {sourceRowRef.columnValue || "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No record-level source row refs were found for the current
                      employee record.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Component lineage
                  </p>
                  {drilldown.currentRecord.payComponents.length ? (
                    <div className="space-y-2">
                      {drilldown.currentRecord.payComponents.map((component) => (
                        <div
                          key={component.id}
                          className="rounded-md border border-border/80 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {component.componentLabel}
                            </p>
                            <Badge variant="outline" className="rounded-md capitalize">
                              {component.category.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          {component.sourceRowRefs.length ? (
                            component.sourceRowRefs.map((sourceRowRef) => (
                              <p
                                key={sourceRowRef.id}
                                className="mt-1 text-xs text-muted-foreground"
                              >
                                Row {sourceRowRef.rowNumber}:{" "}
                                {sourceRowRef.columnHeader || "Source column"} ={" "}
                                {sourceRowRef.columnValue || "—"}
                              </p>
                            ))
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                              No component source row refs were found.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No normalized current-run components are attached to this
                      employee record.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This exception is attached to a previous-run employee record, so
                there is no current-run evidence for this drilldown.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md border-border/80">
          <CardHeader>
            <CardTitle>Previous-run evidence</CardTitle>
            <CardDescription>
              The matched previous record stays visible beside the current run
              so reviewers can trust the delta they are seeing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previousRecord ? (
              <>
                <div className="rounded-md border border-border/80 px-3 py-2">
                  <p className="text-sm font-medium text-foreground">
                    Matched previous employee
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {previousRecord.employeeDisplayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {previousRecord.sourceFile.kind} · {previousRecord.sourceFile.originalFilename}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Record lineage
                  </p>
                  {previousRecord.sourceRowRefs.length ? (
                    <div className="space-y-2">
                      {previousRecord.sourceRowRefs.map((sourceRowRef) => (
                        <div
                          key={sourceRowRef.id}
                          className="rounded-md border border-border/80 px-3 py-2"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {sourceRowRef.canonicalFieldKey || "Record field"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sourceRowRef.sourceFile.kind} · row {sourceRowRef.rowNumber}
                          </p>
                          <p className="mt-1 text-sm text-foreground">
                            {sourceRowRef.columnHeader || "Source column"}:{" "}
                            {sourceRowRef.columnValue || "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No previous-run record lineage was found.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Component lineage
                  </p>
                  {previousRecord.payComponents.length ? (
                    <div className="space-y-2">
                      {previousRecord.payComponents.map((component) => (
                        <div
                          key={component.id}
                          className="rounded-md border border-border/80 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {component.componentLabel}
                            </p>
                            <Badge variant="outline" className="rounded-md capitalize">
                              {component.category.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          {component.sourceRowRefs.length ? (
                            component.sourceRowRefs.map((sourceRowRef) => (
                              <p
                                key={sourceRowRef.id}
                                className="mt-1 text-xs text-muted-foreground"
                              >
                                Row {sourceRowRef.rowNumber}:{" "}
                                {sourceRowRef.columnHeader || "Source column"} ={" "}
                                {sourceRowRef.columnValue || "—"}
                              </p>
                            ))
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                              No component source row refs were found.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No previous-run components are available for this matched
                      record.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-border px-4 py-6">
                <p className="text-sm text-muted-foreground">
                  No matched previous employee record exists for this drilldown
                  yet. New employee and unmatched review still happens against
                  the current-run evidence.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {drilldown.exceptions.length ? (
        <Card className="rounded-md border-border/80">
          <CardHeader>
            <CardTitle>Exception evidence summaries</CardTitle>
            <CardDescription>
              Deterministic rule outputs stay visible here so the reviewer can
              compare the underlying evidence with the finding that was created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {drilldown.exceptions.map((exception) => (
              <div
                key={exception.id}
                className="rounded-md border border-border/80 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-md capitalize">
                    {exception.ruleResult.severity}
                  </Badge>
                  <Badge variant="outline" className="rounded-md capitalize">
                    {formatStatus(exception.reviewStatus)}
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatRuleCodeLabel(exception.ruleResult.ruleCode)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {exception.ruleResult.ruleMessage}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summarizeRuleDetails(exception.ruleResult.details)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
