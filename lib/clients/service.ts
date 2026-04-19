import { prisma } from "@/lib/prisma";

function slugify(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "client";
}

async function createUniqueClientSlug(
  organizationId: string,
  clientName: string,
  clientIdToIgnore?: string,
) {
  const base = slugify(clientName);
  let slug = base;
  let suffix = 2;

  while (
    await prisma.client.findFirst({
      where: {
        organizationId,
        slug,
        ...(clientIdToIgnore
          ? {
              NOT: {
                id: clientIdToIgnore,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    })
  ) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function listClientsForOrganization(organizationId: string) {
  return prisma.client.findMany({
    where: {
      organizationId,
      archivedAt: null,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function findClientForOrganization(input: {
  organizationId: string;
  clientId: string;
}) {
  return prisma.client.findFirst({
    where: {
      id: input.clientId,
      organizationId: input.organizationId,
      archivedAt: null,
    },
  });
}

export async function createClientForOrganization(input: {
  organizationId: string;
  createdByUserId: string;
  name: string;
  legalName?: string;
  countryCode?: string;
  notes?: string;
}) {
  const slug = await createUniqueClientSlug(input.organizationId, input.name);

  return prisma.client.create({
    data: {
      organizationId: input.organizationId,
      createdByUserId: input.createdByUserId,
      name: input.name,
      slug,
      legalName: input.legalName || undefined,
      countryCode: input.countryCode?.toUpperCase() || "IE",
      notes: input.notes || undefined,
      updatedByUserId: input.createdByUserId,
    },
  });
}

export async function updateClientForOrganization(input: {
  organizationId: string;
  clientId: string;
  updatedByUserId: string;
  name: string;
  legalName?: string;
  countryCode?: string;
  notes?: string;
}) {
  const slug = await createUniqueClientSlug(
    input.organizationId,
    input.name,
    input.clientId,
  );

  return prisma.client.update({
    where: {
      id_organizationId: {
        id: input.clientId,
        organizationId: input.organizationId,
      },
    },
    data: {
      name: input.name,
      slug,
      legalName: input.legalName || null,
      countryCode: input.countryCode?.toUpperCase() || "IE",
      notes: input.notes || null,
      updatedByUserId: input.updatedByUserId,
    },
  });
}

export async function archiveClientForOrganization(input: {
  organizationId: string;
  clientId: string;
  updatedByUserId: string;
}) {
  return prisma.client.update({
    where: {
      id_organizationId: {
        id: input.clientId,
        organizationId: input.organizationId,
      },
    },
    data: {
      archivedAt: new Date(),
      updatedByUserId: input.updatedByUserId,
    },
  });
}
