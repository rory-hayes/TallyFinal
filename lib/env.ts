export type AppEnvironment = {
  appName: string;
  services: {
    supabase: boolean;
    database: boolean;
    trigger: boolean;
  };
};

export type ServiceStatus = {
  label: string;
  status: "configured" | "needs setup";
  detail: string;
};

type EnvironmentSource = Partial<Record<string, string | undefined>>;

function hasValue(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

export function readAppEnvironment(
  env: EnvironmentSource = process.env,
): AppEnvironment {
  const appName = env.NEXT_PUBLIC_APP_NAME?.trim() || "Tally";

  return {
    appName,
    services: {
      supabase:
        hasValue(env.NEXT_PUBLIC_SUPABASE_URL) &&
        hasValue(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      database: hasValue(env.DATABASE_URL),
      trigger:
        hasValue(env.TRIGGER_PROJECT_REF) && hasValue(env.TRIGGER_SECRET_KEY),
    },
  };
}

export function createServiceStatusSnapshot(
  environment: AppEnvironment,
): ServiceStatus[] {
  return [
    {
      label: "Supabase",
      status: environment.services.supabase ? "configured" : "needs setup",
      detail: environment.services.supabase
        ? "Auth, storage, and server helpers are ready to wire."
        : "Add public Supabase keys before enabling auth and storage.",
    },
    {
      label: "Prisma",
      status: environment.services.database ? "configured" : "needs setup",
      detail: environment.services.database
        ? "Prisma can generate a client and connect to Postgres."
        : "Add DATABASE_URL before running migrations.",
    },
    {
      label: "Trigger.dev",
      status: environment.services.trigger ? "configured" : "needs setup",
      detail: environment.services.trigger
        ? "Background job scaffolding is in place."
        : "Add Trigger.dev credentials before running job workers.",
    },
  ];
}

export function requireSupabaseEnvironment(
  env: EnvironmentSource = process.env,
) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasValue(url) || !hasValue(anonKey)) {
    throw new Error(
      "Supabase environment is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return {
    url: url.trim(),
    anonKey: anonKey.trim(),
  };
}

export function requireDatabaseUrl(env: EnvironmentSource = process.env) {
  const databaseUrl = env.DATABASE_URL;

  if (!hasValue(databaseUrl)) {
    throw new Error("DATABASE_URL is missing.");
  }

  return databaseUrl.trim();
}
