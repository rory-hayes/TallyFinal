import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SourceFileMappingForm } from "@/components/pay-runs/source-file-mapping-form";
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
import { listImportWorkspacesForPayRun } from "@/lib/imports/service";
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
  saveSourceFileMappingAction,
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
  const importWorkspaces = await listImportWorkspacesForPayRun({
    organizationId: organizationContext.organization.id,
    payRunId: payRun.id,
  });
  const sourceFilesById = new Map(
    payRun.sourceFiles.map((sourceFile) => [sourceFile.id, sourceFile]),
  );
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
            Upload-first preview and mapping are live here before any canonical
            normalization starts.
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
          <CardTitle>Preview and mapping</CardTitle>
          <CardDescription>
            Uploaded files are previewed first. Operators can inspect headers,
            review sample rows, and save reusable mappings before normalization
            exists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {importWorkspaces.length ? (
            importWorkspaces.map((workspace) => {
              const sourceFile = sourceFilesById.get(workspace.sourceFileId);

              if (!sourceFile) {
                return null;
              }

              return (
                <div
                  key={workspace.sourceFileId}
                  className="space-y-4 rounded-md border border-border/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">
                          {formatSourceFileKindLabel(workspace.sourceKind)}
                        </h3>
                        <Badge variant="outline" className="rounded-md">
                          v{sourceFile.version}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-md capitalize"
                        >
                          {workspace.previewStatus}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">
                        {sourceFile.originalFilename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {workspace.previewSheetName
                          ? `${workspace.previewSheetName} - `
                          : ""}
                        {workspace.previewRowCount} data rows
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{workspace.previewHeaders.length} headers</p>
                      <p>
                        {workspace.hasSavedMapping
                          ? "Saved mapping on this upload"
                          : workspace.reusedTemplateName
                            ? "Template reused for this upload"
                            : "No saved mapping yet"}
                      </p>
                    </div>
                  </div>

                  {workspace.previewStatus === "failed" ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      {workspace.previewError ??
                        "Preview parsing failed for this file."}
                    </div>
                  ) : null}

                  {workspace.previewStatus === "pending" ? (
                    <div className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                      Preview parsing has not completed for this file yet.
                    </div>
                  ) : null}

                  {workspace.previewStatus === "ready" ? (
                    <>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          Headers
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {workspace.previewHeaders.map((header) => (
                            <span
                              key={`${workspace.sourceFileId}-${header}`}
                              className="rounded-md border border-border/80 px-2 py-1 text-xs text-foreground"
                            >
                              {header}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          Sample rows
                        </p>
                        {workspace.previewSampleRows.length ? (
                          <div className="overflow-x-auto rounded-md border border-border/80">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {workspace.previewHeaders.map((header) => (
                                    <TableHead key={`${workspace.sourceFileId}-${header}-head`}>
                                      {header}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {workspace.previewSampleRows.map((row, rowIndex) => (
                                  <TableRow key={`${workspace.sourceFileId}-row-${rowIndex}`}>
                                    {workspace.previewHeaders.map((header) => (
                                      <TableCell
                                        key={`${workspace.sourceFileId}-${rowIndex}-${header}`}
                                        className="align-top text-xs"
                                      >
                                        {row[header] || "N/A"}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                            The file has headers but no sample rows to preview.
                          </div>
                        )}
                      </div>

                      {payRunManagementAllowed ? (
                        <SourceFileMappingForm
                          workspace={workspace}
                          saveMapping={saveSourceFileMappingAction.bind(
                            null,
                            orgSlug,
                            client.id,
                            payRun.id,
                            workspace.sourceFileId,
                          )}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Your role can inspect mappings but cannot save them.
                        </p>
                      )}
                    </>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Upload a file to unlock preview parsing and reusable mappings.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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
                            ? ` - replaces ${sourceFile.replacementOfId}`
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
