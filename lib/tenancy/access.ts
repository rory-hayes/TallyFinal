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
const PAY_RUN_MUTATION_ROLES = new Set<OrganizationRole>(["admin", "operator"]);
const REVIEW_MUTATION_ROLES = new Set<OrganizationRole>([
  "admin",
  "operator",
  "reviewer",
]);

export function canManageClients(role: OrganizationRole) {
  return CLIENT_MUTATION_ROLES.has(role);
}

export function canManagePayRuns(role: OrganizationRole) {
  return PAY_RUN_MUTATION_ROLES.has(role);
}

export function canManageReviewExceptions(role: OrganizationRole) {
  return REVIEW_MUTATION_ROLES.has(role);
}

export function assertCanManageClients(role: OrganizationRole) {
  if (!canManageClients(role)) {
    throw new Error("Client management is not permitted for this role.");
  }
}

export function assertCanManagePayRuns(role: OrganizationRole) {
  if (!canManagePayRuns(role)) {
    throw new Error("Pay run management is not permitted for this role.");
  }
}

export function assertCanManageReviewExceptions(role: OrganizationRole) {
  if (!canManageReviewExceptions(role)) {
    throw new Error("Review exception changes are not permitted for this role.");
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

export function assertPayRunBelongsToOrganization(
  payRun: { id: string; organizationId: string } | null,
  organizationId: string,
) {
  if (!payRun || payRun.organizationId !== organizationId) {
    throw new Error("Pay run access denied.");
  }

  return payRun;
}
