import type { SourceFileKind } from "@/lib/pay-runs/source-files";

import { getImportProfile, type ImportProfile } from "@/lib/imports/profiles";

export type FieldMappingValues = Record<string, string>;

export type MappingTemplateCandidate = {
  createdAt: Date;
  importProfileKey: string;
  sourceKind: SourceFileKind;
  templateId: string;
  templateName?: string;
  updatedAt?: Date;
  values: FieldMappingValues;
};

export function validateRequiredMappings(
  profile: ImportProfile,
  values: FieldMappingValues,
) {
  return profile.fields
    .filter((field) => field.required)
    .map((field) => field.key)
    .filter((fieldKey) => !values[fieldKey]?.trim());
}

export function sanitizeMappingValues(values: Record<string, string | null | undefined>) {
  return Object.fromEntries(
    Object.entries(values)
      .map(([fieldKey, sourceHeader]) => [fieldKey, sourceHeader?.trim() ?? ""])
      .filter((entry) => entry[1].length > 0),
  ) as FieldMappingValues;
}

export function pickReusableTemplate(input: {
  availableHeaders: string[];
  importProfileKey: string;
  sourceKind: SourceFileKind;
  templates: MappingTemplateCandidate[];
}) {
  const availableHeaderSet = new Set(input.availableHeaders.map((header) => header.trim()));

  const matchingTemplates = input.templates
    .filter((template) => template.importProfileKey === input.importProfileKey)
    .filter((template) => template.sourceKind === input.sourceKind)
    .filter((template) =>
      Object.values(template.values).every((header) => availableHeaderSet.has(header)),
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return matchingTemplates[0] ?? null;
}

export { getImportProfile };
