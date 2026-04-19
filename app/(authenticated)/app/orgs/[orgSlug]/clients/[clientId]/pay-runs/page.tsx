import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { listPayRunsForClient } from "@/lib/pay-runs/service";
import { canManagePayRuns } from "@/lib/tenancy/access";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";
import { findClientForOrganization } from "@/lib/clients/service";
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

function formatPayRunStatus(status: string) {
  return status.replace(/_/g, " ");
}

type PayRunListPageProps = {
  params: Promise<{
    orgSlug: string;
    clientId: string;
  }>;
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function PayRunListPage({
  params,
  searchParams,
}: PayRunListPageProps) {
  const { clientId, orgSlug } = await params;
  const resolvedSearchParams = await searchParams;
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

  const payRuns = await listPayRunsForClient({
    organizationId: organizationContext.organization.id,
    clientId: client.id,
  });
  const payRunManagementAllowed = canManagePayRuns(organizationContext.role);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Pay runs
            </h1>
            <Badge variant="outline" className="rounded-md">
              {client.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Pay runs stay scoped to the current organization and hold the source
            file lineage before any payroll parsing begins.
          </p>
          {resolvedSearchParams.notice ? (
            <p className="text-sm text-emerald-800">
              {resolvedSearchParams.notice}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-md">
            <Link href={`/app/orgs/${orgSlug}/clients/${client.id}`}>
              Back to client
            </Link>
          </Button>
          {payRunManagementAllowed ? (
            <Button asChild className="rounded-md">
              <Link href={`/app/orgs/${orgSlug}/clients/${client.id}/pay-runs/new`}>
                Create pay run
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <Card className="rounded-md border-border/80">
        <CardHeader>
          <CardTitle>Pay run register</CardTitle>
          <CardDescription>
            Each pay run keeps attached source files as versioned records rather
            than mutating uploads in place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payRuns.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pay date</TableHead>
                  <TableHead>Source files</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payRuns.map((payRun) => (
                  <TableRow key={payRun.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {payRun.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("en-IE", {
                            dateStyle: "medium",
                          }).format(payRun.periodStart)}
                          {" to "}
                          {new Intl.DateTimeFormat("en-IE", {
                            dateStyle: "medium",
                          }).format(payRun.periodEnd)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {formatPayRunStatus(payRun.status)}
                    </TableCell>
                    <TableCell>
                      {payRun.payDate
                        ? new Intl.DateTimeFormat("en-IE", {
                            dateStyle: "medium",
                          }).format(payRun.payDate)
                        : "Not set"}
                    </TableCell>
                    <TableCell>{payRun._count.sourceFiles}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm" className="rounded-md">
                        <Link
                          href={`/app/orgs/${orgSlug}/clients/${client.id}/pay-runs/${payRun.id}`}
                        >
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No pay runs exist yet for this client.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
