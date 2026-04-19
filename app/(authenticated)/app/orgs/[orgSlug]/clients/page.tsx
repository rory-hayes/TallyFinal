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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ClientListPageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function ClientListPage({
  params,
  searchParams,
}: ClientListPageProps) {
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

  const clients = await listClientsForOrganization(
    organizationContext.organization.id,
  );
  const clientManagementAllowed = canManageClients(organizationContext.role);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Clients
            </h1>
            <Badge variant="outline" className="rounded-md">
              {organizationContext.organization.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Client records are always filtered by organization membership before
            they are shown or changed.
          </p>
          {resolvedSearchParams.notice ? (
            <p className="text-sm text-emerald-800">
              {resolvedSearchParams.notice}
            </p>
          ) : null}
        </div>

        {clientManagementAllowed ? (
          <Button asChild className="rounded-md">
            <Link href={`/app/orgs/${orgSlug}/clients/new`}>Add client</Link>
          </Button>
        ) : null}
      </section>

      <Card className="rounded-md border-border/80">
        <CardHeader>
          <CardTitle>Client directory</CardTitle>
          <CardDescription>
            {clientManagementAllowed
              ? "You can create and edit clients in this organization."
              : "Your role is read-only for client records."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>{client.name}</TableCell>
                    <TableCell>{client.countryCode}</TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat("en-IE", {
                        dateStyle: "medium",
                      }).format(client.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm" className="rounded-md">
                        <Link href={`/app/orgs/${orgSlug}/clients/${client.id}`}>
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
                No clients exist yet for this organization.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
