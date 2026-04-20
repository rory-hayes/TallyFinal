import { createClient } from "@supabase/supabase-js";

import { requireSupabaseAdminEnvironment } from "@/lib/env";

export function createSupabaseAdminClient() {
  const { serviceRoleKey, url } = requireSupabaseAdminEnvironment();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
