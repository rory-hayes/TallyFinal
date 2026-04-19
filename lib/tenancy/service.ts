import { prisma } from "@/lib/prisma";
import {
  type OrganizationMembershipSummary,
  type OrganizationRole,
} from "@/lib/tenancy/access";

function slugify(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "org";
}

async function createUniqueOrganizationSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;

  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function listOrganizationMemberships(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId,
    },
    orderBy: {
      organization: {
        name: "asc",
      },
    },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return memberships.map<OrganizationMembershipSummary>((membership) => ({
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: membership.role,
  }));
}

export async function listOrganizationReviewAssignees(organizationId: string) {
  return prisma.organizationMember.findMany({
    where: {
      organizationId,
      role: {
        in: ["admin", "operator", "reviewer"],
      },
    },
    orderBy: [{ displayName: "asc" }, { email: "asc" }, { userId: "asc" }],
    select: {
      displayName: true,
      email: true,
      role: true,
      userId: true,
    },
  });
}

export async function findOrganizationContextForUser(
  userId: string,
  organizationSlug: string,
) {
  return prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: {
        slug: organizationSlug,
      },
    },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              clients: {
                where: {
                  archivedAt: null,
                },
              },
              members: true,
            },
          },
        },
      },
    },
  });
}

export async function createOrganizationForUser(input: {
  name: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
}) {
  const slug = await createUniqueOrganizationSlug(input.name);

  return prisma.$transaction(async (transaction) => {
    const organization = await transaction.organization.create({
      data: {
        name: input.name,
        slug,
        createdByUserId: input.userId,
      },
    });

    await transaction.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: input.userId,
        email: input.email ?? undefined,
        displayName: input.displayName ?? undefined,
        role: "admin",
      },
    });

    return organization;
  });
}

export async function updateOrganizationMemberRole(input: {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}) {
  return prisma.organizationMember.update({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
    data: {
      role: input.role,
    },
  });
}
