import Link from "next/link";

import { signOutAction } from "@/lib/auth/actions";
import { type OrganizationMembershipSummary } from "@/lib/tenancy/access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type AppShellProps = {
  children: React.ReactNode;
  memberships: OrganizationMembershipSummary[];
  userEmail: string | null;
};

export function AppShell({
  children,
  memberships,
  userEmail,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--color-canvas)_0%,var(--color-background)_28%,var(--color-background)_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 py-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/app"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                Tally
              </Link>
              <Badge
                variant="outline"
                className="rounded-md border-emerald-600/25 bg-emerald-500/10 text-emerald-800"
              >
                Pay run shell
              </Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Employee-level payroll review still comes later. This shell now
              covers signed-in tenancy, client access, pay runs, and source-file
              lineage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {userEmail ? (
              <span className="text-sm text-muted-foreground">{userEmail}</span>
            ) : null}
            <Button asChild variant="outline" size="sm" className="rounded-md">
              <Link href="/api/health">Health API</Link>
            </Button>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm" className="rounded-md">
                Sign out
              </Button>
            </form>
          </div>
        </header>

        <div className="grid flex-1 gap-8 py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav className="sticky top-8 space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Workspace
                </p>
                <ul className="space-y-2 text-sm text-foreground">
                  <li>
                    <Link href="/app" className="hover:text-primary">
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link href="/app/onboarding" className="hover:text-primary">
                      Onboarding
                    </Link>
                  </li>
                </ul>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Organizations
                </p>
                {memberships.length ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {memberships.map((membership) => (
                      <li key={membership.organizationId}>
                        <Link
                          href={`/app/orgs/${membership.organizationSlug}`}
                          className="block hover:text-primary"
                        >
                          <span className="text-foreground">
                            {membership.organizationName}
                          </span>
                          <span className="ml-2 text-xs">
                            {membership.role}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No organizations yet.
                  </p>
                )}
              </div>
            </nav>
          </aside>

          <main className="min-w-0 pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
