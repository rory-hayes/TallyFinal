import { describe, expect, it } from "vitest";

import {
  createServiceStatusSnapshot,
  hasSupabaseServiceRoleKey,
  readAppEnvironment,
  requireSupabaseAdminEnvironment,
} from "../lib/env";

describe("readAppEnvironment", () => {
  it("reports which infrastructure services are configured", () => {
    const environment = readAppEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/tally",
      TRIGGER_PROJECT_REF: "proj_123",
      TRIGGER_SECRET_KEY: "tr_dev_123",
    });

    expect(environment.appName).toBe("Tally");
    expect(environment.services.supabase).toBe(true);
    expect(environment.services.database).toBe(true);
    expect(environment.services.trigger).toBe(true);
  });

  it("marks missing credentials as unconfigured", () => {
    const environment = readAppEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      DATABASE_URL: "",
      TRIGGER_PROJECT_REF: "",
      TRIGGER_SECRET_KEY: "",
    });

    expect(environment.services.supabase).toBe(false);
    expect(environment.services.database).toBe(false);
    expect(environment.services.trigger).toBe(false);
  });
});

describe("createServiceStatusSnapshot", () => {
  it("creates stable labels for the shell health table", () => {
    const snapshot = createServiceStatusSnapshot({
      appName: "Tally",
      sourceFilesBucket: "tally-source-files",
      services: {
        supabase: true,
        database: false,
        trigger: true,
      },
    });

    expect(snapshot).toEqual([
      {
        detail: "Auth, storage, and server helpers are ready to wire.",
        label: "Supabase",
        status: "configured",
      },
      {
        detail: "Add DATABASE_URL before running migrations.",
        label: "Prisma",
        status: "needs setup",
      },
      {
        detail: "Background job scaffolding is in place.",
        label: "Trigger.dev",
        status: "configured",
      },
    ]);
  });
});

describe("requireSupabaseAdminEnvironment", () => {
  it("returns the project URL and service role key for detached background work", () => {
    expect(
      requireSupabaseAdminEnvironment({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    ).toEqual({
      serviceRoleKey: "service-role-key",
      url: "https://example.supabase.co",
    });
  });

  it("reports whether the service role key is configured", () => {
    expect(
      hasSupabaseServiceRoleKey({
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    ).toBe(true);
    expect(
      hasSupabaseServiceRoleKey({
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toBe(false);
  });
});
