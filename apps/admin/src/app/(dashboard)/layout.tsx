import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { SidebarNav } from "../../components/sidebar-nav";
import { LogoutButton } from "../../components/logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-border bg-surface p-4">
        <div className="mb-6 px-2">
          <p className="text-sm font-semibold text-text-primary">Illyrian Gym Ferizaj</p>
          <p className="text-xs text-text-muted">Staff Dashboard</p>
        </div>
        <SidebarNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-sm font-medium text-text-primary">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-text-muted">Administrator</p>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
