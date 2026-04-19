import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { canManagePayRuns } from "@/lib/tenancy/access";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";
import { findClientForOrganization } from "@/lib/clients/service";
import { PayRunForm } from "@/components/pay-runs/pay-run-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { createPayRunAction } from "../actions";

type NewPayRunPageProps = {
  params: Promise<{
    orgSlug: string;
    clientId: string;
  }>;
};

export default async function NewPayRunPage({ params }: NewPayRunPageProps) {
  const { clientId, orgSlug } = await params;
  const user = await requireAuthenticatedUser();
  const organizationContext = await findOrganizationContextForUser(
    user.id,
    orgSlug,
  );

  if (!organizationContext) {
    redirect("/app");
  }

  if (!canManagePayRuns(organizationContext.role)) {
    redirect(`/app/orgs/${orgSlug}/clients/${clientId}/pay-runs`);
  }

  const client = await findClientForOrganization({
    organizationId: organizationContext.organization.id,
    clientId,
  });

  if (!client) {
    notFound();
  }

  const resolvedClient = client;

  async function createAction(formData: FormData) {
    "use server";

    const result = await createPayRunAction(orgSlug, resolvedClient.id, formData);

    if (!result.ok) {
      redirect(
        `/app/orgs/${orgSlug}/clients/${resolvedClient.id}/pay-runs/new?error=${encodeURIComponent(result.error)}`,
      );
    }

    redirect(
      `/app/orgs/${orgSlug}/clients/${resolvedClient.id}/pay-runs/${result.payRunId}?notice=${encodeURIComponent("Pay run created.")}`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              New pay run
            </h1>
            <Badge variant="outline" className="rounded-md">
              {resolvedClient.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Create the review container first, then attach source files with
            versioned lineage.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-md">
          <Link href={`/app/orgs/${orgSlug}/clients/${resolvedClient.id}/pay-runs`}>
            Back to pay runs
          </Link>
        </Button>
      </div>

      <Card className="rounded-md border-border/80">
        <CardHeader>
          <CardTitle>Create pay run</CardTitle>
        </CardHeader>
        <CardContent>
          <PayRunForm action={createAction} submitLabel="Create pay run" />
        </CardContent>
      </Card>
    </div>
  );
}
