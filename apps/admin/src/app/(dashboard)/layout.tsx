import { redirect } from "next/navigation";
import { getCurrentUser, DASHBOARD_ROLES } from "../../lib/session";
import { AppShell } from "../../components/app-shell";
import type { StaffRole } from "../../lib/nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !(DASHBOARD_ROLES as readonly string[]).includes(user.role)) {
    redirect("/login");
  }
  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <AppShell user={{ firstName: user.firstName, lastName: user.lastName, role: user.role as StaffRole }}>{children}</AppShell>
  );
}
