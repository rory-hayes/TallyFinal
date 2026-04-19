import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getDefaultOrganizationMembership } from "@/lib/tenancy/access";
import { listOrganizationMemberships } from "@/lib/tenancy/service";

import { createOrganizationAction } from "./actions";

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const user = await requireAuthenticatedUser();
  const memberships = await listOrganizationMemberships(user.id);
  const defaultMembership = getDefaultOrganizationMembership(memberships);

  if (defaultMembership) {
    redirect(`/app/orgs/${defaultMembership.organizationSlug}`);
  }

  const params = await searchParams;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_420px]">
      <section className="space-y-4">
        <p className="text-sm font-medium text-emerald-700">
          Organization onboarding
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground">
          Create the first organization before client work begins.
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          This is the tenancy anchor for all later client, pay run, and review
          data. The signed-in creator becomes the first admin automatically.
        </p>
      </section>

      <Card className="rounded-md border-border/80">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">New organization</CardTitle>
          {params.error ? (
            <p className="text-sm text-destructive">{params.error}</p>
          ) : null}
        </CardHeader>
        <CardContent>
          <form action={createOrganizationAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Northside Payroll Bureau"
                required
              />
            </div>
            <Button type="submit" className="rounded-md">
              Create organization
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
