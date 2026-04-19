export const PAY_RUN_STATUSES = [
  "draft",
  "collecting_files",
  "ready_for_import",
  "archived",
] as const;

export const SOURCE_FILE_KINDS = [
  "current_payroll",
  "previous_payroll",
  "journal",
  "payment",
] as const;

export const SOURCE_FILE_STATUSES = [
  "registered",
  "uploaded",
  "superseded",
] as const;

export type PayRunStatus = (typeof PAY_RUN_STATUSES)[number];
export type SourceFileKind = (typeof SOURCE_FILE_KINDS)[number];
export type SourceFileStatus = (typeof SOURCE_FILE_STATUSES)[number];

export type SourceFileLineageCandidate = {
  id: string;
  kind: SourceFileKind;
  version: number;
};

export function createNextSourceFileLineage(
  existingFiles: SourceFileLineageCandidate[],
  kind: SourceFileKind,
) {
  const latestFile = existingFiles
    .filter((candidate) => candidate.kind === kind)
    .sort((left, right) => right.version - left.version)[0];

  return {
    replacementOfId: latestFile?.id ?? null,
    version: latestFile ? latestFile.version + 1 : 1,
  };
}

function normalizeSourceKindSegment(kind: SourceFileKind) {
  return kind.replace(/_/g, "-");
}

function sanitizeFilename(originalFilename: string) {
  const trimmed = originalFilename.trim().toLowerCase();

  if (!trimmed) {
    return "upload";
  }

  const sanitized = trimmed
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-\./g, ".")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+|\.+$/g, "");

  return sanitized || "upload";
}

export function buildSourceStoragePath(input: {
  organizationId: string;
  clientId: string;
  payRunId: string;
  kind: SourceFileKind;
  version: number;
  originalFilename: string;
}) {
  const kindSegment = normalizeSourceKindSegment(input.kind);
  const safeFilename = sanitizeFilename(input.originalFilename);

  return [
    "organizations",
    input.organizationId,
    "clients",
    input.clientId,
    "pay-runs",
    input.payRunId,
    kindSegment,
    `v${input.version}-${safeFilename}`,
  ].join("/");
}

export function formatSourceFileKindLabel(kind: SourceFileKind) {
  return kind
    .split("_")
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}
