"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseEnvironment } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const { anonKey, url } = requireSupabaseEnvironment();

  return createBrowserClient(url, anonKey);
}
