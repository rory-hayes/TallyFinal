import Link from "next/link";
import { redirect } from "next/navigation";

import { listClientsForOrganization } from "@/lib/clients/service";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { canManageClients } from "@/lib/tenancy/access";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type OrganizationPageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const { orgSlug } = await params;
  const user = await requireAuthenticatedUser();
  const organizationContext = await findOrganizationContextForUser(
    user.id,
    orgSlug,
  );

  if (!organizationContext) {
    redirect("/app");
  }

  const clients = await listClientsForOrganization(
    organizationContext.organization.id,
  );
  const clientManagementAllowed = canManageClients(organizationContext.role);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {organizationContext.organization.name}
            </h1>
            <Badge variant="outline" className="rounded-md">
              {organizationContext.role}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            This organization is now the tenant boundary for client records and
            later payroll review data.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-md">
            <Link href={`/app/orgs/${orgSlug}/clients`}>View clients</Link>
          </Button>
          {clientManagementAllowed ? (
            <Button asChild className="rounded-md">
              <Link href={`/app/orgs/${orgSlug}/clients/new`}>
                Add client
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-md border-border/80">
          <CardHeader>
            <CardDescription>Active clients</CardDescription>
            <CardTitle className="text-3xl">{clients.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            All client reads and writes are scoped to this organization id.
          </CardContent>
        </Card>
        <Card className="rounded-md border-border/80">
          <CardHeader>
            <CardDescription>Members</CardDescription>
            <CardTitle className="text-3xl">
              {organizationContext.organization._count.members}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Roles exist now even though member management can come later.
          </CardContent>
        </Card>
        <Card className="rounded-md border-border/80">
          <CardHeader>
            <CardDescription>Permissions</CardDescription>
            <CardTitle className="text-3xl">
              {clientManagementAllowed ? "Write" : "Read"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Server actions enforce this role before any client mutation runs.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
