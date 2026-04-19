import { CheckCircle2, Clock3, Layers3, ShieldCheck } from "lucide-react";

import { InfrastructureStatusTable } from "@/components/dashboard/infrastructure-status-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createServiceStatusSnapshot,
  readAppEnvironment,
} from "@/lib/env";

const nextSteps = [
  {
    icon: Layers3,
    title: "Tenancy foundation",
    description: "Organizations, memberships, and roles arrive in the next slice.",
  },
  {
    icon: ShieldCheck,
    title: "Auth placeholder",
    description:
      "Supabase helpers are ready, but real session enforcement waits for the tenancy pass.",
  },
  {
    icon: Clock3,
    title: "Jobs scaffolded",
    description:
      "Trigger.dev configuration is in place without committing to payroll workflows yet.",
  },
];

export default function AppHomePage() {
  const environment = readAppEnvironment();
  const serviceStatuses = createServiceStatusSnapshot(environment);
  const configuredCount = serviceStatuses.filter(
    (service) => service.status === "configured",
  ).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <p className="text-sm font-medium text-emerald-700">
            {environment.appName} baseline
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground">
            Clean full-stack baseline, with the payroll product still waiting
            outside the room.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            This page exists to verify the stack, shared UI tokens, and service
            scaffolds before tenancy and payroll-specific features begin.
          </p>
        </div>

        <Card className="rounded-md border-border/80">
          <CardHeader>
            <CardDescription>Infrastructure snapshot</CardDescription>
            <CardTitle className="text-3xl">
              {configuredCount}/{serviceStatuses.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 text-emerald-700" />
              <p>
                Shared primitives, env guards, Prisma wiring, and background job
                scaffolds are present.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 size-4 text-amber-700" />
              <p>
                Real authentication, tenancy, and payroll domain slices begin in
                the next prompts.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {nextSteps.map((item) => (
          <Card key={item.title} className="rounded-md border-border/80">
            <CardHeader className="space-y-3">
              <item.icon className="size-5 text-emerald-700" />
              <div className="space-y-1">
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Service readiness
          </h2>
          <p className="text-sm text-muted-foreground">
            This is intentionally operational, not product-facing.
          </p>
        </div>
        <InfrastructureStatusTable data={serviceStatuses} />
      </section>
    </div>
  );
}
