export const ORGANIZATION_ROLES = [
  "admin",
  "reviewer",
  "operator",
  "viewer",
] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type OrganizationMembershipSummary = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrganizationRole;
};

const CLIENT_MUTATION_ROLES = new Set<OrganizationRole>(["admin", "operator"]);

export function canManageClients(role: OrganizationRole) {
  return CLIENT_MUTATION_ROLES.has(role);
}

export function assertCanManageClients(role: OrganizationRole) {
  if (!canManageClients(role)) {
    throw new Error("Client management is not permitted for this role.");
  }
}

export function getDefaultOrganizationMembership(
  memberships: OrganizationMembershipSummary[],
) {
  return memberships[0] ?? null;
}

export function requireOrganizationMembership(
  memberships: OrganizationMembershipSummary[],
  organizationSlug: string,
) {
  const membership = memberships.find(
    (candidate) => candidate.organizationSlug === organizationSlug,
  );

  if (!membership) {
    throw new Error("Organization access denied.");
  }

  return membership;
}

export function assertClientBelongsToOrganization(
  client: { id: string; organizationId: string } | null,
  organizationId: string,
) {
  if (!client || client.organizationId !== organizationId) {
    throw new Error("Client access denied.");
  }

  return client;
}
