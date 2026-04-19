"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createOrganizationForUser } from "@/lib/tenancy/service";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export async function createOrganizationAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    redirect("/app/onboarding?error=Organization%20name%20is%20required.");
  }

  const organization = await createOrganizationForUser({
    name: parsed.data.name,
    userId: user.id,
    email: user.email,
    displayName:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email ??
      null,
  });

  redirect(`/app/orgs/${organization.slug}`);
}
