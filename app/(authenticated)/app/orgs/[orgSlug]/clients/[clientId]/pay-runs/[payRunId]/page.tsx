import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SourceFileUploadForm } from "@/components/pay-runs/source-file-upload-form";
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
import {
  findPayRunForClient,
  listPayRunsForClient,
} from "@/lib/pay-runs/service";
import { formatSourceFileKindLabel } from "@/lib/pay-runs/source-files";
import { canManagePayRuns } from "@/lib/tenancy/access";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";

import {
  confirmSourceFileUploadAction,
  registerSourceFileUploadAction,
} from "../actions";

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

type PayRunDetailPageProps = {
  params: Promise<{
    orgSlug: string;
    clientId: string;
    payRunId: string;
  }>;
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function PayRunDetailPage({
  params,
  searchParams,
}: PayRunDetailPageProps) {
  const { clientId, orgSlug, payRunId } = await params;
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

  const payRun = await findPayRunForClient({
    organizationId: organizationContext.organization.id,
    clientId: client.id,
    payRunId,
  });

  if (!payRun) {
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
              {payRun.title}
            </h1>
            <Badge variant="outline" className="rounded-md capitalize">
              {formatStatus(payRun.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            The pay run detail page keeps upload lineage visible before preview,
            mapping, or payroll review logic exists.
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
              Client
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-md">
            <Link href={`/app/orgs/${orgSlug}/clients/${client.id}/pay-runs`}>
              All pay runs
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <Card className="rounded-md border-border/80">
          <CardHeader>
            <CardTitle>Pay run details</CardTitle>
            <CardDescription>
              This run belongs to {client.name} and remains tenant-scoped by the
              current organization membership.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Period
              </p>
              <p className="mt-1 text-sm text-foreground">
                {new Intl.DateTimeFormat("en-IE", {
                  dateStyle: "medium",
                }).format(payRun.periodStart)}
                {" to "}
                {new Intl.DateTimeFormat("en-IE", {
                  dateStyle: "medium",
                }).format(payRun.periodEnd)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Pay date
              </p>
              <p className="mt-1 text-sm text-foreground">
                {payRun.payDate
                  ? new Intl.DateTimeFormat("en-IE", {
                      dateStyle: "medium",
                    }).format(payRun.payDate)
                  : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Source files
              </p>
              <p className="mt-1 text-sm text-foreground">
                {payRun.sourceFiles.length}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Client pay runs
              </p>
              <p className="mt-1 text-sm text-foreground">{payRuns.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md border-border/80">
          <CardHeader>
            <CardTitle>Attach source file</CardTitle>
            <CardDescription>
              Uploads are registered first, written to Supabase Storage with a
              signed URL, then confirmed against the file record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payRunManagementAllowed ? (
              <SourceFileUploadForm
                registerUpload={registerSourceFileUploadAction.bind(
                  null,
                  orgSlug,
                  client.id,
                  payRun.id,
                )}
                confirmUpload={confirmSourceFileUploadAction.bind(
                  null,
                  orgSlug,
                  client.id,
                  payRun.id,
                )}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Your role can inspect source lineage but cannot register new
                files.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-md border-border/80">
        <CardHeader>
          <CardTitle>Source file lineage</CardTitle>
          <CardDescription>
            New uploads create new versions. Prior versions stay visible and can
            be marked as superseded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payRun.sourceFiles.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Checksum</TableHead>
                  <TableHead>Storage path</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payRun.sourceFiles.map((sourceFile) => (
                  <TableRow key={sourceFile.id}>
                    <TableCell>{formatSourceFileKindLabel(sourceFile.kind)}</TableCell>
                    <TableCell>{sourceFile.version}</TableCell>
                    <TableCell className="capitalize">
                      {formatStatus(sourceFile.status)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {sourceFile.originalFilename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sourceFile.byteSize
                            ? `${Math.max(
                                1,
                                Math.round(sourceFile.byteSize / 1024),
                              )} KB`
                            : "Size pending"}
                          {sourceFile.replacementOfId
                            ? ` • replaces ${sourceFile.replacementOfId}`
                            : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {sourceFile.checksumSha256.slice(0, 16)}...
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {sourceFile.storagePath}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No source files are attached to this pay run yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
