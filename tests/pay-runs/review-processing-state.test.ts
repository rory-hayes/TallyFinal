import { describe, expect, it } from "vitest";

import {
  deriveReviewProcessingState,
  type ReviewProcessingInputs,
} from "../../lib/pay-runs/review-processing-state";

function createBaseInputs(): ReviewProcessingInputs {
  return {
    activeReviewSnapshotVersion: 2,
    currentPayroll: {
      id: "source_current_v2",
      mappingSignature: "map-current-v2",
      status: "uploaded",
      version: 2,
    },
    latestRun: null,
    previousPayroll: {
      id: "source_previous_v1",
      mappingSignature: "map-previous-v1",
      status: "uploaded",
      version: 1,
    },
  };
}

describe("deriveReviewProcessingState", () => {
  it("returns not_ready when a required payroll source is still missing", () => {
    const state = deriveReviewProcessingState({
      ...createBaseInputs(),
      previousPayroll: null,
    });

    expect(state).toEqual({
      code: "not_ready",
      detail: "Upload and map both current and previous payroll files to build the reviewer dataset.",
    });
  });

  it("returns queued when a matching processing run is waiting to start", () => {
    const state = deriveReviewProcessingState({
      ...createBaseInputs(),
      latestRun: {
        completedAt: null,
        currentMappingSignature: "map-current-v2",
        currentSourceFileId: "source_current_v2",
        errorMessage: null,
        previousMappingSignature: "map-previous-v1",
        previousSourceFileId: "source_previous_v1",
        resultingSnapshotVersion: null,
        startedAt: null,
        status: "queued",
      },
    });

    expect(state).toEqual({
      code: "queued",
      detail: "Reviewer processing is queued for the latest mapped payroll files.",
    });
  });

  it("returns stale when the latest mapped payroll inputs differ from the last completed run", () => {
    const state = deriveReviewProcessingState({
      ...createBaseInputs(),
      latestRun: {
        completedAt: new Date("2026-04-20T10:00:00.000Z"),
        currentMappingSignature: "map-current-v1",
        currentSourceFileId: "source_current_v1",
        errorMessage: null,
        previousMappingSignature: "map-previous-v1",
        previousSourceFileId: "source_previous_v1",
        resultingSnapshotVersion: 2,
        startedAt: new Date("2026-04-20T09:58:00.000Z"),
        status: "completed",
      },
    });

    expect(state).toEqual({
      code: "stale",
      detail: "Latest payroll uploads or mappings have changed since the active reviewer snapshot was built.",
    });
  });

  it("returns completed when the active snapshot matches the latest completed processing inputs", () => {
    const state = deriveReviewProcessingState({
      ...createBaseInputs(),
      latestRun: {
        completedAt: new Date("2026-04-20T10:00:00.000Z"),
        currentMappingSignature: "map-current-v2",
        currentSourceFileId: "source_current_v2",
        errorMessage: null,
        previousMappingSignature: "map-previous-v1",
        previousSourceFileId: "source_previous_v1",
        resultingSnapshotVersion: 2,
        startedAt: new Date("2026-04-20T09:58:00.000Z"),
        status: "completed",
      },
    });

    expect(state).toEqual({
      code: "completed",
      detail: "Reviewer queue and drilldown are aligned to the latest mapped payroll files.",
    });
  });
});
