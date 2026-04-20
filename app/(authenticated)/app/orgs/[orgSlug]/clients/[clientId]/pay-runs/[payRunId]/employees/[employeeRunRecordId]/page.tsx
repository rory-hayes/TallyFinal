import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { findClientForOrganization } from "@/lib/clients/service";
import { findPayRunForClient } from "@/lib/pay-runs/service";
import { prisma } from "@/lib/prisma";
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

  const employeeRecord = await prisma.employeeRunRecord.findFirst({
    where: {
      clientId: client.id,
      id: employeeRunRecordId,
      organizationId: organizationContext.organization.id,
      payRunId: payRun.id,
    },
    include: {
      ruleResults: {
        include: {
          reviewException: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      sourceRowRefs: {
        orderBy: {
          rowNumber: "asc",
        },
      },
    },
  });

  if (!employeeRecord) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {employeeRecord.employeeDisplayName}
            </h1>
            <Badge variant="outline" className="rounded-md capitalize">
              {employeeRecord.recordScope}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Drilldown routing is now in place from the queue. Detailed current
            vs previous comparison lands here next.
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

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
        <Card className="rounded-md border-border/80">
          <CardHeader>
            <CardTitle>Queue context</CardTitle>
            <CardDescription>
              Enough context to confirm the queue row you opened while the full
              drilldown remains intentionally out of scope for this prompt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Payroll number
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {employeeRecord.employeeNumber || "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  External id
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {employeeRecord.employeeExternalId || "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Gross pay
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {employeeRecord.grossPay?.toString() || "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Net pay
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {employeeRecord.netPay?.toString() || "Not provided"}
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Linked exceptions
              </p>
              {employeeRecord.ruleResults.length ? (
                <div className="space-y-2">
                  {employeeRecord.ruleResults.map((ruleResult) => (
                    <div
                      key={ruleResult.id}
                      className="rounded-md border border-border/80 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-md capitalize">
                          {ruleResult.severity}
                        </Badge>
                        <Badge variant="outline" className="rounded-md capitalize">
                          {ruleResult.reviewException
                            ? formatStatus(ruleResult.reviewException.reviewStatus)
                            : "No exception"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {ruleResult.ruleCode}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {ruleResult.ruleMessage}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No review exceptions are linked to this record yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md border-border/80">
          <CardHeader>
            <CardTitle>Source lineage</CardTitle>
            <CardDescription>
              Queue rows now have a real place to land when the reviewer wants
              to inspect source evidence next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {employeeRecord.sourceRowRefs.length ? (
              employeeRecord.sourceRowRefs.map((sourceRowRef) => (
                <div
                  key={sourceRowRef.id}
                  className="rounded-md border border-border/80 px-3 py-2"
                >
                  <p className="text-sm font-medium text-foreground">
                    Row {sourceRowRef.rowNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sourceRowRef.columnHeader || "Source field"}{" "}
                    {sourceRowRef.columnValue
                      ? `- ${sourceRowRef.columnValue}`
                      : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No source row refs are attached to this employee record yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
