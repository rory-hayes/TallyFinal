"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  archiveClientForOrganization,
  createClientForOrganization,
  updateClientForOrganization,
} from "@/lib/clients/service";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { canManageClients } from "@/lib/tenancy/access";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";

const clientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).optional(),
  countryCode: z.string().trim().min(2).max(2),
  notes: z.string().trim().max(4000).optional(),
});

async function requireMutableOrganizationContext(orgSlug: string) {
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

  return {
    organizationContext,
    user,
  };
}

export async function createClientAction(orgSlug: string, formData: FormData) {
  const { organizationContext, user } =
    await requireMutableOrganizationContext(orgSlug);

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName") || undefined,
    countryCode: formData.get("countryCode"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    redirect(
      `/app/orgs/${orgSlug}/clients/new?error=Check%20the%20client%20details.`,
    );
  }

  const client = await createClientForOrganization({
    organizationId: organizationContext.organization.id,
    createdByUserId: user.id,
    name: parsed.data.name,
    legalName: parsed.data.legalName,
    countryCode: parsed.data.countryCode,
    notes: parsed.data.notes,
  });

  revalidatePath(`/app/orgs/${orgSlug}`);
  revalidatePath(`/app/orgs/${orgSlug}/clients`);
  redirect(`/app/orgs/${orgSlug}/clients/${client.id}?notice=Client%20created.`);
}

export async function updateClientAction(
  orgSlug: string,
  clientId: string,
  formData: FormData,
) {
  const { organizationContext, user } =
    await requireMutableOrganizationContext(orgSlug);

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName") || undefined,
    countryCode: formData.get("countryCode"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    redirect(
      `/app/orgs/${orgSlug}/clients/${clientId}?error=Check%20the%20client%20details.`,
    );
  }

  await updateClientForOrganization({
    organizationId: organizationContext.organization.id,
    clientId,
    updatedByUserId: user.id,
    name: parsed.data.name,
    legalName: parsed.data.legalName,
    countryCode: parsed.data.countryCode,
    notes: parsed.data.notes,
  });

  revalidatePath(`/app/orgs/${orgSlug}`);
  revalidatePath(`/app/orgs/${orgSlug}/clients`);
  revalidatePath(`/app/orgs/${orgSlug}/clients/${clientId}`);
  redirect(`/app/orgs/${orgSlug}/clients/${clientId}?notice=Client%20updated.`);
}

export async function archiveClientAction(orgSlug: string, clientId: string) {
  const { organizationContext, user } =
    await requireMutableOrganizationContext(orgSlug);

  await archiveClientForOrganization({
    organizationId: organizationContext.organization.id,
    clientId,
    updatedByUserId: user.id,
  });

  revalidatePath(`/app/orgs/${orgSlug}`);
  revalidatePath(`/app/orgs/${orgSlug}/clients`);
  redirect(`/app/orgs/${orgSlug}/clients?notice=Client%20archived.`);
}
