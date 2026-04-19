import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getImportProfile,
  pickReusableTemplate,
  sanitizeMappingValues,
  validateRequiredMappings,
  type FieldMappingValues,
} from "@/lib/imports/mapping";
import {
  listImportProfilesForSourceKind,
  type ImportProfile,
} from "@/lib/imports/profiles";
import {
  parseSourceFilePreview,
} from "@/lib/imports/preview";
import type { SourceFileKind } from "@/lib/pay-runs/source-files";

type JsonRow = Record<string, string>;

export type ImportWorkspace = {
  availableProfiles: ImportProfile[];
  currentMappingValues: FieldMappingValues;
  hasSavedMapping: boolean;
  previewError: string | null;
  previewHeaders: string[];
  previewRowCount: number;
  previewSampleRows: JsonRow[];
  previewSheetName: string | null;
  previewStatus: "pending" | "ready" | "failed";
  reusedTemplateName: string | null;
  reusedTemplateUpdatedAt: Date | null;
  selectedProfileKey: string | null;
  sourceFileId: string;
  sourceKind: SourceFileKind;
};

function defaultProfileKeyForKind(sourceKind: SourceFileKind) {
  return listImportProfilesForSourceKind(sourceKind)[0]?.key ?? null;
}

function parseHeaders(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function parseSampleRows(value: unknown): JsonRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => {
      return Boolean(entry && typeof entry === "object" && !Array.isArray(entry));
    })
    .map((entry) =>
      Object.fromEntries(
        Object.entries(entry).map(([header, cellValue]) => [
          header,
          typeof cellValue === "string" ? cellValue : String(cellValue ?? ""),
        ]),
      ),
    );
}

function mapSavedSourceColumnMappings(
  mappings: { sourceHeader: string; targetFieldKey: string }[],
) {
  return Object.fromEntries(
    mappings.map((mapping) => [mapping.targetFieldKey, mapping.sourceHeader]),
  );
}

function mapTemplateCandidates(
  templates: {
    columnMappings: unknown;
    importProfileKey: string;
    sourceKind: SourceFileKind;
    templateName: string;
    updatedAt: Date;
    id: string;
  }[],
) {
  return templates.map((template) => ({
    createdAt: template.updatedAt,
    importProfileKey: template.importProfileKey,
    sourceKind: template.sourceKind,
    templateId: template.id,
    templateName: template.templateName,
    updatedAt: template.updatedAt,
    values:
      template.columnMappings && typeof template.columnMappings === "object"
        ? sanitizeMappingValues(
            template.columnMappings as Record<string, string | null | undefined>,
          )
        : {},
  }));
}

export async function persistSourceFilePreview(input: {
  file: File;
  organizationId: string;
  sourceFileId: string;
}) {
  const sourceFile = await prisma.sourceFile.findFirst({
    where: {
      id: input.sourceFileId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      kind: true,
    },
  });

  if (!sourceFile) {
    throw new Error("Source file access denied.");
  }

  try {
    const preview = await parseSourceFilePreview({
      bytes: await input.file.arrayBuffer(),
      contentType: input.file.type,
      filename: input.file.name,
    });
    const defaultProfileKey = defaultProfileKeyForKind(sourceFile.kind);

    await prisma.sourceFile.update({
      where: {
        id: sourceFile.id,
      },
      data: {
        importProfileKey: defaultProfileKey,
        previewError: null,
        previewHeaders: preview.headers,
        previewRowCount: preview.rowCount,
        previewSampleRows: preview.sampleRows,
        previewSheetName: preview.sheetName,
        previewStatus: "ready",
      },
    });

    return {
      ok: true as const,
      preview,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Preview parsing failed.";

    await prisma.sourceFile.update({
      where: {
        id: sourceFile.id,
      },
      data: {
        importProfileKey: defaultProfileKeyForKind(sourceFile.kind),
        previewError: message,
        previewHeaders: Prisma.JsonNull,
        previewRowCount: null,
        previewSampleRows: Prisma.JsonNull,
        previewSheetName: null,
        previewStatus: "failed",
      },
    });

    return {
      error: message,
      ok: false as const,
    };
  }
}

export async function listImportWorkspacesForPayRun(input: {
  organizationId: string;
  payRunId: string;
}) {
  const sourceFiles = await prisma.sourceFile.findMany({
    where: {
      organizationId: input.organizationId,
      payRunId: input.payRunId,
      status: "uploaded",
    },
    include: {
      sourceColumnMappings: {
        orderBy: {
          targetFieldKey: "asc",
        },
      },
    },
    orderBy: [{ kind: "asc" }, { version: "desc" }],
  });

  if (!sourceFiles.length) {
    return [];
  }

  const templates = await prisma.mappingTemplate.findMany({
    where: {
      organizationId: input.organizationId,
      clientId: sourceFiles[0].clientId,
      archivedAt: null,
    },
    select: {
      columnMappings: true,
      id: true,
      importProfileKey: true,
      sourceKind: true,
      templateName: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const templateCandidates = mapTemplateCandidates(templates);

  return sourceFiles.map<ImportWorkspace>((sourceFile) => {
    const availableProfiles = listImportProfilesForSourceKind(sourceFile.kind);
    const previewHeaders = parseHeaders(sourceFile.previewHeaders);
    const selectedProfileKey =
      sourceFile.importProfileKey ?? availableProfiles[0]?.key ?? null;
    const savedMappings = mapSavedSourceColumnMappings(
      sourceFile.sourceColumnMappings,
    );
    const reusableTemplate =
      !Object.keys(savedMappings).length && selectedProfileKey && previewHeaders.length
        ? pickReusableTemplate({
            availableHeaders: previewHeaders,
            importProfileKey: selectedProfileKey,
            sourceKind: sourceFile.kind,
            templates: templateCandidates,
          })
        : null;

    return {
      availableProfiles,
      currentMappingValues:
        Object.keys(savedMappings).length > 0 ? savedMappings : reusableTemplate?.values ?? {},
      hasSavedMapping: Object.keys(savedMappings).length > 0,
      previewError: sourceFile.previewError,
      previewHeaders,
      previewRowCount: sourceFile.previewRowCount ?? 0,
      previewSampleRows: parseSampleRows(sourceFile.previewSampleRows),
      previewSheetName: sourceFile.previewSheetName,
      previewStatus: sourceFile.previewStatus,
      reusedTemplateName:
        reusableTemplate && "templateName" in reusableTemplate
          ? reusableTemplate.templateName ?? null
          : null,
      reusedTemplateUpdatedAt:
        reusableTemplate && "updatedAt" in reusableTemplate
          ? reusableTemplate.updatedAt ?? null
          : null,
      selectedProfileKey,
      sourceFileId: sourceFile.id,
      sourceKind: sourceFile.kind,
    };
  });
}

export async function saveSourceFileMappings(input: {
  clientId: string;
  importProfileKey: string;
  organizationId: string;
  saveTemplate: boolean;
  sourceFileId: string;
  userId: string;
  values: Record<string, string | null | undefined>;
}) {
  const sourceFile = await prisma.sourceFile.findFirst({
    where: {
      id: input.sourceFileId,
      organizationId: input.organizationId,
      clientId: input.clientId,
      status: "uploaded",
    },
    select: {
      clientId: true,
      id: true,
      kind: true,
      previewHeaders: true,
      previewStatus: true,
    },
  });

  if (!sourceFile) {
    return {
      error: "Source file access denied.",
      ok: false as const,
    };
  }

  if (sourceFile.previewStatus !== "ready") {
    return {
      error: "This file cannot be mapped until a preview is available.",
      ok: false as const,
    };
  }

  const profile = getImportProfile(input.importProfileKey);

  if (!profile.sourceKinds.includes(sourceFile.kind)) {
    return {
      error: "The chosen import profile does not match this source kind.",
      ok: false as const,
    };
  }

  const previewHeaders = parseHeaders(sourceFile.previewHeaders);
  const allowedFieldKeys = new Set(profile.fields.map((field) => field.key));
  const sanitizedValues = sanitizeMappingValues(
    Object.fromEntries(
      Object.entries(input.values).filter(([fieldKey]) => allowedFieldKeys.has(fieldKey)),
    ),
  );
  const missingFieldKeys = validateRequiredMappings(profile, sanitizedValues);

  if (missingFieldKeys.length) {
    return {
      missingFields: profile.fields
        .filter((field) => missingFieldKeys.includes(field.key))
        .map((field) => field.label),
      ok: false as const,
    };
  }

  const previewHeaderSet = new Set(previewHeaders);
  const unknownHeaders = Object.values(sanitizedValues).filter(
    (header) => !previewHeaderSet.has(header),
  );

  if (unknownHeaders.length) {
    return {
      error: "One or more mapped headers are not present in the uploaded file preview.",
      ok: false as const,
    };
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.sourceColumnMapping.deleteMany({
      where: {
        sourceFileId: sourceFile.id,
      },
    });

    const entries = Object.entries(sanitizedValues);

    if (entries.length) {
      await transaction.sourceColumnMapping.createMany({
        data: entries.map(([targetFieldKey, sourceHeader]) => ({
          organizationId: input.organizationId,
          sourceFileId: sourceFile.id,
          sourceHeader,
          targetFieldKey,
        })),
      });
    }

    await transaction.sourceFile.update({
      where: {
        id: sourceFile.id,
      },
      data: {
        importProfileKey: profile.key,
      },
    });

    if (input.saveTemplate) {
      await transaction.mappingTemplate.upsert({
        where: {
          organizationId_clientId_sourceKind_importProfileKey: {
            clientId: sourceFile.clientId,
            importProfileKey: profile.key,
            organizationId: input.organizationId,
            sourceKind: sourceFile.kind,
          },
        },
        update: {
          columnMappings: sanitizedValues,
          sourceHeaders: previewHeaders,
          templateName: profile.label,
          updatedByUserId: input.userId,
        },
        create: {
          clientId: sourceFile.clientId,
          columnMappings: sanitizedValues,
          createdByUserId: input.userId,
          importProfileKey: profile.key,
          organizationId: input.organizationId,
          sourceHeaders: previewHeaders,
          sourceKind: sourceFile.kind,
          templateName: profile.label,
          updatedByUserId: input.userId,
        },
      });
    }
  });

  return {
    ok: true as const,
    templateSaved: input.saveTemplate,
  };
}
