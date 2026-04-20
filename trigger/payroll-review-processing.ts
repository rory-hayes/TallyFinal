import { logger, task } from "@trigger.dev/sdk";

import {
  PAYROLL_REVIEW_PROCESSING_TASK_ID,
  runQueuedPayRunReviewProcessing,
} from "@/lib/pay-runs/processing";

export const payrollReviewProcessing = task({
  id: PAYROLL_REVIEW_PROCESSING_TASK_ID,
  run: async (payload: { reviewProcessingRunId: string }) => {
    logger.info("Running payroll review processing", {
      reviewProcessingRunId: payload.reviewProcessingRunId,
    });

    const run = await runQueuedPayRunReviewProcessing({
      reviewProcessingRunId: payload.reviewProcessingRunId,
    });

    return {
      reviewProcessingRunId: run.id,
      resultingSnapshotVersion: run.resultingSnapshotVersion,
      status: run.status,
    };
  },
});
