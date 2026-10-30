"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldAlert, X } from "lucide-react";
import { entryForPath, isActive, navFor, ROLE_LABEL, StaffRole } from "../lib/nav";
import { StaffProvider } from "../lib/staff-context";
import { Avatar } from "./ui/avatar";
import { ToastProvider } from "./ui/toast";

const COLLAPSE_KEY = "illyrian.sidebar.collapsed";

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-lg px-1 py-1" aria-label="Illyrian Gym - dashboard">
      <Image src="/brand/logo.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full" priority />
      {!collapsed && (
        <span className="leading-tight">
          <span className="block font-heading text-[15px] font-extrabold tracking-heading text-mint">Illyrian Gym</span>
          <span className="block text-[10px] font-bold uppercase tracking-eyebrow text-lime">&amp; CrossFit</span>
        </span>
      )}
    </Link>
  );
}

function Nav({ role, collapsed, onNavigate }: { role: StaffRole; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
      {navFor(role).map((group) => (
        <div key={group.label} className="mb-5">
          {collapsed ? <div className="mx-3 mb-2 h-px bg-sidebar-line" aria-hidden="true" /> : <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-eyebrow text-sidebar-muted">{group.label}</p>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center gap-3 rounded-pill px-3 py-2 text-[13px] font-semibold transition ${collapsed ? "justify-center" : ""} ${
                      active ? "bg-lime text-ink" : "text-sidebar-text hover:bg-sidebar-surface hover:text-mint"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-ink" : "text-sidebar-muted group-hover:text-lime"}`} aria-hidden="true" />
                    {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserBlock({ user, collapsed, onSignOut, busy }: { user: ShellUser; collapsed: boolean; onSignOut: () => void; busy: boolean }) {
  return (
    <div className="border-t border-sidebar-line p-3">
      <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
        <Avatar firstName={user.firstName} lastName={user.lastName} size="sm" />
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-bold text-mint">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[11px] text-sidebar-muted">{ROLE_LABEL[user.role]}</p>
          </div>
        )}
        <button
          onClick={onSignOut}
          disabled={busy}
          aria-label="Sign out"
          title="Sign out"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-sidebar-text transition hover:bg-sidebar-surface hover:text-mint disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export interface ShellUser {
  firstName: string;
  lastName: string;
  role: StaffRole;
}

/**
 * Role-aware application frame: dark navigation rail (collapsible on desktop, a drawer on phones) around a light
 * canvas. Pages a role cannot use show an explanation instead of a broken screen; the API enforces the same rules.
 */
export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // storage unavailable (private mode): default expanded
    }
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        // ignore
      }
      return !c;
    });
  }

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  const entry = entryForPath(pathname);
  const allowed = !entry || entry.roles.includes(user.role);

  return (
    <ToastProvider>
      <StaffProvider user={user}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-pill focus:bg-lime focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-ink">
        Skip to content
      </a>
      <div className="flex min-h-screen">
        {/* Desktop rail */}
        <aside className={`no-print sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar transition-[width] duration-200 lg:flex ${collapsed ? "w-[76px]" : "w-64"}`}>
          <div className={`flex items-center py-5 ${collapsed ? "justify-center px-3" : "justify-between px-4"}`}>
            <Brand collapsed={collapsed} />
          </div>
          <Nav role={user.role} collapsed={collapsed} />
          <button
            onClick={toggleCollapsed}
            className="mx-3 mb-2 inline-flex items-center justify-center gap-2 rounded-pill py-2 text-xs font-semibold text-sidebar-muted transition hover:bg-sidebar-surface hover:text-mint"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && "Collapse"}
          </button>
          <UserBlock user={user} collapsed={collapsed} onSignOut={signOut} busy={signingOut} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="no-print fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 animate-fade-in bg-ink/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in-left flex-col bg-sidebar" aria-label="Navigation">
              <div className="flex items-center justify-between px-4 py-5">
                <Brand collapsed={false} />
                <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="inline-flex h-9 w-9 items-center justify-center rounded-pill text-sidebar-text hover:bg-sidebar-surface">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Nav role={user.role} collapsed={false} onNavigate={() => setMobileOpen(false)} />
              <UserBlock user={user} collapsed={false} onSignOut={signOut} busy={signingOut} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
            <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} className="inline-flex h-10 w-10 items-center justify-center rounded-pill text-text-primary hover:bg-surface-sunken">
              <Menu className="h-5 w-5" />
            </button>
            <Image src="/brand/logo.png" alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
            <span className="font-heading text-sm font-extrabold tracking-heading">{entry?.label ?? "Illyrian Gym"}</span>
          </header>
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {allowed ? (
              children
            ) : (
              <div role="alert" className="card mx-auto mt-16 max-w-md p-8 text-center">
                <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-warning" aria-hidden="true" />
                <h1 className="heading-display text-2xl">No access to this page</h1>
                <p className="mt-2 text-sm text-text-secondary">
                  Your role ({ROLE_LABEL[user.role]}) does not include {entry?.label ?? "this section"}. If you need it, ask the gym owner.
                </p>
                <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-pill bg-accent px-5 text-sm font-bold text-accent-contrast hover:bg-accent-hover">
                  Back to dashboard
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
      </StaffProvider>
    </ToastProvider>
  );
}
