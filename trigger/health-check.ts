import { logger, task } from "@trigger.dev/sdk";

export const healthCheck = task({
  id: "health-check",
  run: async (payload: { initiatedBy?: string } = {}) => {
    logger.info("Running baseline Trigger.dev health check", {
      initiatedBy: payload.initiatedBy ?? "manual",
    });

    return {
      ok: true,
      initiatedBy: payload.initiatedBy ?? "manual",
      timestamp: new Date().toISOString(),
    };
  },
});
