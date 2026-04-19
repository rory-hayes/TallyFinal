import { NextResponse } from "next/server";

import { readAppEnvironment } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeRedirectPath(candidate: string | null) {
  if (candidate && candidate.startsWith("/")) {
    return candidate;
  }

  return "/app";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeRedirectPath(requestUrl.searchParams.get("next"));

  if (!readAppEnvironment().services.supabase || !code) {
    return NextResponse.redirect(
      new URL(
        "/sign-in?error=Unable%20to%20complete%20authentication.",
        requestUrl,
      ),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/sign-in?error=${encodeURIComponent(error.message)}`,
        requestUrl,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, requestUrl));
}
