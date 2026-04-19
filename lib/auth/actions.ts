"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { readAppEnvironment } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.string().trim().email(),
});

function sanitizeMessage(message: string) {
  return encodeURIComponent(message);
}

function getSiteUrl(originHeader: string | null) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    originHeader ||
    "http://127.0.0.1:3000"
  );
}

export async function signInWithOtpAction(formData: FormData) {
  if (!readAppEnvironment().services.supabase) {
    redirect(
      `/sign-in?error=${sanitizeMessage(
        "Supabase auth is not configured in this environment.",
      )}`,
    );
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect(
      `/sign-in?error=${sanitizeMessage("Enter a valid email address.")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const headerStore = await headers();
  const emailRedirectTo = new URL(
    "/auth/callback",
    getSiteUrl(headerStore.get("origin")),
  ).toString();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    redirect(`/sign-in?error=${sanitizeMessage(error.message)}`);
  }

  redirect(
    `/sign-in?notice=${sanitizeMessage(
      `Magic link sent to ${parsed.data.email}.`,
    )}`,
  );
}

export async function signOutAction() {
  if (readAppEnvironment().services.supabase) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  redirect("/sign-in");
}
