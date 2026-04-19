import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getDefaultOrganizationMembership } from "@/lib/tenancy/access";
import { listOrganizationMemberships } from "@/lib/tenancy/service";

export default async function AppHomePage() {
  const user = await requireAuthenticatedUser();
  const memberships = await listOrganizationMemberships(user.id);
  const defaultMembership = getDefaultOrganizationMembership(memberships);

  if (!defaultMembership) {
    redirect("/app/onboarding");
  }

  redirect(`/app/orgs/${defaultMembership.organizationSlug}`);
}
