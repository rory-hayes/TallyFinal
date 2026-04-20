import { requireAuthenticatedUser } from "@/lib/auth/session";
import { findClientForOrganization } from "@/lib/clients/service";
import { findPayRunForClient } from "@/lib/pay-runs/service";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";

export async function requireAuthorizedPayRunContext(input: {
  clientId: string;
  orgSlug: string;
  payRunId: string;
}) {
  const user = await requireAuthenticatedUser();
  const organizationContext = await findOrganizationContextForUser(
    user.id,
    input.orgSlug,
  );

  if (!organizationContext) {
    throw new Error("Organization access denied.");
  }

  const client = await findClientForOrganization({
    organizationId: organizationContext.organization.id,
    clientId: input.clientId,
  });

  if (!client) {
    throw new Error("Client access denied.");
  }

  const payRun = await findPayRunForClient({
    organizationId: organizationContext.organization.id,
    clientId: client.id,
    payRunId: input.payRunId,
  });

  if (!payRun) {
    throw new Error("Pay run access denied.");
  }

  return {
    client,
    organizationContext,
    payRun,
    user,
  };
}
