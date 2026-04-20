export type ReviewProcessingRunSnapshot = {
  completedAt: Date | null;
  currentMappingSignature: string;
  currentSourceFileId: string;
  errorMessage: string | null;
  previousMappingSignature: string;
  previousSourceFileId: string;
  resultingSnapshotVersion: number | null;
  startedAt: Date | null;
  status: "completed" | "failed" | "processing" | "queued";
};

export type ReviewProcessingSourceSnapshot = {
  id: string;
  mappingSignature: string;
  status: "uploaded";
  version: number;
};

export type ReviewProcessingInputs = {
  activeReviewSnapshotVersion: number;
  currentPayroll: ReviewProcessingSourceSnapshot | null;
  latestRun: ReviewProcessingRunSnapshot | null;
  previousPayroll: ReviewProcessingSourceSnapshot | null;
};

export type ReviewProcessingState = {
  code: "completed" | "failed" | "not_ready" | "processing" | "queued" | "stale";
  detail: string;
};

function runMatchesLatestInputs(
  run: ReviewProcessingRunSnapshot,
  currentPayroll: ReviewProcessingSourceSnapshot,
  previousPayroll: ReviewProcessingSourceSnapshot,
) {
  return (
    run.currentSourceFileId === currentPayroll.id &&
    run.previousSourceFileId === previousPayroll.id &&
    run.currentMappingSignature === currentPayroll.mappingSignature &&
    run.previousMappingSignature === previousPayroll.mappingSignature
  );
}

export function deriveReviewProcessingState(
  input: ReviewProcessingInputs,
): ReviewProcessingState {
  if (!input.currentPayroll || !input.previousPayroll) {
    return {
      code: "not_ready",
      detail:
        "Upload and map both current and previous payroll files to build the reviewer dataset.",
    };
  }

  if (!input.latestRun) {
    return {
      code: "stale",
      detail:
        "Latest payroll uploads or mappings have changed since the active reviewer snapshot was built.",
    };
  }

  if (!runMatchesLatestInputs(input.latestRun, input.currentPayroll, input.previousPayroll)) {
    return {
      code: "stale",
      detail:
        "Latest payroll uploads or mappings have changed since the active reviewer snapshot was built.",
    };
  }

  if (input.latestRun.status === "queued") {
    return {
      code: "queued",
      detail: "Reviewer processing is queued for the latest mapped payroll files.",
    };
  }

  if (input.latestRun.status === "processing") {
    return {
      code: "processing",
      detail: "Reviewer processing is running for the latest mapped payroll files.",
    };
  }

  if (input.latestRun.status === "failed") {
    return {
      code: "failed",
      detail:
        input.latestRun.errorMessage ??
        "Reviewer processing failed for the latest mapped payroll files.",
    };
  }

  if (input.latestRun.resultingSnapshotVersion === input.activeReviewSnapshotVersion) {
    return {
      code: "completed",
      detail:
        "Reviewer queue and drilldown are aligned to the latest mapped payroll files.",
    };
  }

  return {
    code: "stale",
    detail:
      "Latest payroll uploads or mappings have changed since the active reviewer snapshot was built.",
  };
}
