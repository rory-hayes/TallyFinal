import { prisma } from "@/lib/prisma";

import {
  buildSourceStoragePath,
  createNextSourceFileLineage,
  type SourceFileKind,
} from "@/lib/pay-runs/source-files";

export async function listPayRunsForClient(input: {
  organizationId: string;
  clientId: string;
}) {
  return prisma.payRun.findMany({
    where: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      archivedAt: null,
    },
    include: {
      _count: {
        select: {
          sourceFiles: true,
        },
      },
    },
    orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
  });
}

export async function findPayRunForClient(input: {
  organizationId: string;
  clientId: string;
  payRunId: string;
}) {
  return prisma.payRun.findFirst({
    where: {
      id: input.payRunId,
      organizationId: input.organizationId,
      clientId: input.clientId,
      archivedAt: null,
    },
    include: {
      sourceFiles: {
        orderBy: [{ kind: "asc" }, { version: "desc" }, { createdAt: "desc" }],
      },
    },
  });
}

export async function createPayRunForClient(input: {
  organizationId: string;
  clientId: string;
  createdByUserId: string;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  payDate?: Date;
}) {
  return prisma.payRun.create({
    data: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      title: input.title,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      payDate: input.payDate,
      status: "draft",
      createdByUserId: input.createdByUserId,
      updatedByUserId: input.createdByUserId,
    },
  });
}

export async function registerSourceFileForPayRun(input: {
  organizationId: string;
  clientId: string;
  payRunId: string;
  uploadedByUserId: string;
  kind: SourceFileKind;
  originalFilename: string;
  contentType?: string;
  byteSize?: number;
  checksumSha256: string;
  storageBucket: string;
}) {
  const existingFiles = await prisma.sourceFile.findMany({
    where: {
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      kind: input.kind,
    },
    select: {
      id: true,
      kind: true,
      version: true,
    },
    orderBy: {
      version: "desc",
    },
  });

  const lineage = createNextSourceFileLineage(existingFiles, input.kind);
  const storagePath = buildSourceStoragePath({
    organizationId: input.organizationId,
    clientId: input.clientId,
    payRunId: input.payRunId,
    kind: input.kind,
    version: lineage.version,
    originalFilename: input.originalFilename,
  });

  return prisma.sourceFile.create({
    data: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      payRunId: input.payRunId,
      kind: input.kind,
      status: "registered",
      originalFilename: input.originalFilename,
      storageBucket: input.storageBucket,
      storagePath,
      contentType: input.contentType,
      byteSize: input.byteSize,
      checksumSha256: input.checksumSha256,
      version: lineage.version,
      replacementOfId: lineage.replacementOfId,
      uploadedByUserId: input.uploadedByUserId,
    },
  });
}

export async function confirmSourceFileUpload(input: {
  organizationId: string;
  payRunId: string;
  sourceFileId: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const sourceFile = await transaction.sourceFile.update({
      where: {
        id_payRunId: {
          id: input.sourceFileId,
          payRunId: input.payRunId,
        },
      },
      data: {
        status: "uploaded",
        uploadedAt: new Date(),
      },
    });

    if (sourceFile.organizationId !== input.organizationId) {
      throw new Error("Source file access denied.");
    }

    if (sourceFile.replacementOfId) {
      await transaction.sourceFile.update({
        where: {
          id: sourceFile.replacementOfId,
        },
        data: {
          status: "superseded",
        },
      });
    }

    await transaction.payRun.update({
      where: {
        id_organizationId: {
          id: input.payRunId,
          organizationId: input.organizationId,
        },
      },
      data: {
        status: "collecting_files",
      },
    });

    return sourceFile;
  });
}
