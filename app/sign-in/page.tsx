import Link from "next/link";

import { signInWithOtpAction } from "@/lib/auth/actions";
import { readAppEnvironment } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    notice?: string;
  }>;
};

export default async function SignInPage({
  searchParams,
}: SignInPageProps) {
  const params = await searchParams;
  const environment = readAppEnvironment();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,var(--color-canvas)_0%,var(--color-background)_100%)]">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.2fr)_420px]">
          <section className="space-y-6">
            <Badge
              variant="outline"
              className="rounded-md border-emerald-600/25 bg-emerald-500/10 text-emerald-800"
            >
              Tally pay run shell
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground">
                Sign in to manage organizations, clients, and pay runs.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground">
                Tally now has tenant-safe orgs, client records, pay runs, and
                upload lineage for source files. Payroll parsing and review
                logic still come later.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="rounded-md border-border/80">
                <CardHeader>
                  <CardTitle className="text-lg">Signed-in access</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Magic-link sign-in using Supabase Auth.
                </CardContent>
              </Card>
              <Card className="rounded-md border-border/80">
                <CardHeader>
                  <CardTitle className="text-lg">Role-safe</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Server-side permissions gate client and pay run mutations.
                </CardContent>
              </Card>
              <Card className="rounded-md border-border/80">
                <CardHeader>
                  <CardTitle className="text-lg">Lineage-first</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Source file uploads are versioned instead of overwritten in
                  place.
                </CardContent>
              </Card>
            </div>
          </section>

          <Card className="rounded-md border-border/80">
            <CardHeader className="space-y-3">
              <CardTitle className="text-2xl">Email sign-in</CardTitle>
              {!environment.services.supabase ? (
                <p className="text-sm text-amber-800">
                  Supabase auth is not configured yet. The form is wired, but it
                  will not send magic links until the env values are present.
                </p>
              ) : null}
              {params.notice ? (
                <p className="text-sm text-emerald-800">{params.notice}</p>
              ) : null}
              {params.error ? (
                <p className="text-sm text-destructive">{params.error}</p>
              ) : null}
            </CardHeader>
            <CardContent>
              <form action={signInWithOtpAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@payrollbureau.ie"
                    required
                  />
                </div>
                <Button type="submit" className="rounded-md">
                  Send magic link
                </Button>
              </form>
              <div className="mt-6 border-t border-border/80 pt-4 text-sm text-muted-foreground">
                <Link href="/api/health" className="underline underline-offset-4">
                  Check infrastructure health
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
