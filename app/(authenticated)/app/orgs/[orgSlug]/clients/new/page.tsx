import Link from "next/link";
import { redirect } from "next/navigation";

import { ClientForm } from "@/components/tenancy/client-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { canManageClients } from "@/lib/tenancy/access";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";

import { createClientAction } from "../actions";

type NewClientPageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewClientPage({
  params,
  searchParams,
}: NewClientPageProps) {
  const { orgSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const user = await requireAuthenticatedUser();
  const organizationContext = await findOrganizationContextForUser(
    user.id,
    orgSlug,
  );

  if (!organizationContext) {
    redirect("/app");
  }

  if (!canManageClients(organizationContext.role)) {
    redirect(`/app/orgs/${orgSlug}/clients`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              New client
            </h1>
            <Badge variant="outline" className="rounded-md">
              {organizationContext.organization.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Client creation is available only to admins and operators.
          </p>
          {resolvedSearchParams.error ? (
            <p className="text-sm text-destructive">
              {resolvedSearchParams.error}
            </p>
          ) : null}
        </div>
        <Button asChild variant="outline" className="rounded-md">
          <Link href={`/app/orgs/${orgSlug}/clients`}>Back to clients</Link>
        </Button>
      </div>

      <Card className="rounded-md border-border/80">
        <CardHeader>
          <CardTitle>Create client</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm
            action={createClientAction.bind(null, orgSlug)}
            submitLabel="Create client"
          />
        </CardContent>
      </Card>
    </div>
  );
}
