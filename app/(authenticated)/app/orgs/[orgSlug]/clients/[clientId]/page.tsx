import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { findClientForOrganization } from "@/lib/clients/service";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { canManageClients } from "@/lib/tenancy/access";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientForm } from "@/components/tenancy/client-form";

import { archiveClientAction, updateClientAction } from "../actions";

type ClientDetailPageProps = {
  params: Promise<{
    orgSlug: string;
    clientId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    notice?: string;
  }>;
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: ClientDetailPageProps) {
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

  const clientManagementAllowed = canManageClients(organizationContext.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {client.name}
            </h1>
            <Badge variant="outline" className="rounded-md">
              {organizationContext.role}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            The record is only loaded when both the organization id and client
            id match the current membership.
          </p>
          {resolvedSearchParams.notice ? (
            <p className="text-sm text-emerald-800">
              {resolvedSearchParams.notice}
            </p>
          ) : null}
          {resolvedSearchParams.error ? (
            <p className="text-sm text-destructive">
              {resolvedSearchParams.error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-md">
            <Link href={`/app/orgs/${orgSlug}/clients`}>Back to clients</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-md">
            <Link href={`/app/orgs/${orgSlug}/clients/${client.id}/pay-runs`}>
              Pay runs
            </Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-md border-border/80">
        <CardHeader>
          <CardTitle>
            {clientManagementAllowed ? "Edit client" : "Client details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clientManagementAllowed ? (
            <ClientForm
              action={updateClientAction.bind(null, orgSlug, client.id)}
              submitLabel="Save changes"
              destructiveAction={archiveClientAction.bind(
                null,
                orgSlug,
                client.id,
              )}
              destructiveLabel="Archive client"
              defaults={{
                name: client.name,
                legalName: client.legalName,
                countryCode: client.countryCode,
                notes: client.notes,
              }}
            />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Client name
                </dt>
                <dd className="mt-1 text-sm text-foreground">{client.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Legal name
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {client.legalName || "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Country
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {client.countryCode}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Updated
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {new Intl.DateTimeFormat("en-IE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(client.updatedAt)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Notes
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {client.notes || "No notes recorded."}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-md border-border/80">
        <CardHeader>
          <CardTitle>Pay runs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Pay runs now hold source-file lineage for this client before import
            preview, mapping, and employee-level review logic arrive.
          </p>
          <Button asChild className="rounded-md">
            <Link href={`/app/orgs/${orgSlug}/clients/${client.id}/pay-runs`}>
              Open pay runs
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
