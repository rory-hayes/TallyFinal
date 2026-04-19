import { AppShell } from "@/components/layout/app-shell";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { listOrganizationMemberships } from "@/lib/tenancy/service";

export default function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}

async function AuthenticatedShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuthenticatedUser();
  const memberships = await listOrganizationMemberships(user.id);

  return (
    <AppShell memberships={memberships} userEmail={user.email ?? null}>
      {children}
    </AppShell>
  );
}
