import { describe, expect, it } from "vitest";

import {
  assertClientBelongsToOrganization,
  assertPayRunBelongsToOrganization,
  canManageClients,
  canManagePayRuns,
  getDefaultOrganizationMembership,
  requireOrganizationMembership,
  type OrganizationMembershipSummary,
} from "../../lib/tenancy/access";

const memberships: OrganizationMembershipSummary[] = [
  {
    organizationId: "org_alpha",
    organizationName: "Alpha Payroll",
    organizationSlug: "alpha-payroll",
    role: "admin",
  },
  {
    organizationId: "org_bravo",
    organizationName: "Bravo Payroll",
    organizationSlug: "bravo-payroll",
    role: "reviewer",
  },
];

describe("canManageClients", () => {
  it("allows admins and operators to manage clients", () => {
    expect(canManageClients("admin")).toBe(true);
    expect(canManageClients("operator")).toBe(true);
  });

  it("blocks reviewers and viewers from mutating clients", () => {
    expect(canManageClients("reviewer")).toBe(false);
    expect(canManageClients("viewer")).toBe(false);
  });
});

describe("canManagePayRuns", () => {
  it("allows admins and operators to manage pay runs", () => {
    expect(canManagePayRuns("admin")).toBe(true);
    expect(canManagePayRuns("operator")).toBe(true);
  });

  it("blocks reviewers and viewers from mutating pay runs", () => {
    expect(canManagePayRuns("reviewer")).toBe(false);
    expect(canManagePayRuns("viewer")).toBe(false);
  });
});

describe("requireOrganizationMembership", () => {
  it("returns the matching membership for an org slug", () => {
    expect(
      requireOrganizationMembership(memberships, "alpha-payroll"),
    ).toEqual(memberships[0]);
  });

  it("throws when the user is not a member of the target org", () => {
    expect(() =>
      requireOrganizationMembership(memberships, "missing-org"),
    ).toThrowError("Organization access denied.");
  });
});

describe("tenant isolation helpers", () => {
  it("keeps the default org deterministic", () => {
    expect(getDefaultOrganizationMembership(memberships)).toEqual(
      memberships[0],
    );
  });

  it("rejects clients from another organization", () => {
    expect(() =>
      assertClientBelongsToOrganization(
        {
          id: "client_123",
          organizationId: "org_bravo",
        },
        "org_alpha",
      ),
    ).toThrowError("Client access denied.");
  });

  it("rejects pay runs from another organization", () => {
    expect(() =>
      assertPayRunBelongsToOrganization(
        {
          id: "run_123",
          organizationId: "org_bravo",
        },
        "org_alpha",
      ),
    ).toThrowError("Pay run access denied.");
  });
});
