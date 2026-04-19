import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "tally-dev",
  dirs: ["./trigger"],
  maxDuration: 300,
});
