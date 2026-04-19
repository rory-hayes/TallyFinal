import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navigationItems = [
  {
    href: "/app",
    label: "Home",
  },
  {
    href: "/api/health",
    label: "Health API",
  },
  {
    href: "https://supabase.com/docs",
    label: "Supabase Docs",
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
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
                App baseline
              </Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Employee-level payroll review comes later. This shell just proves
              the stack, the shared primitives, and the infrastructure wiring.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {navigationItems.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="outline"
                size="sm"
                className="rounded-md"
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </div>
        </header>

        <div className="grid flex-1 gap-8 py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav className="sticky top-8 space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Foundation
                </p>
                <ul className="space-y-2 text-sm text-foreground">
                  <li>Next.js App Router</li>
                  <li>Tailwind CSS v4</li>
                  <li>shadcn/ui</li>
                  <li>TanStack Table</li>
                </ul>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Next slices
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>P02: tenancy foundation</li>
                  <li>P03: pay run shell</li>
                  <li>P04: import preview</li>
                </ul>
              </div>
            </nav>
          </aside>

          <main className="min-w-0 pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
