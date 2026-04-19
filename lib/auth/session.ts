import { cache } from "react";
import { redirect } from "next/navigation";

import { readAppEnvironment } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getAuthenticatedUser = cache(async () => {
  if (!readAppEnvironment().services.supabase) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}
