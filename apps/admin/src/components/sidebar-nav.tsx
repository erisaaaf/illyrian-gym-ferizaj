"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Grouped by purpose, not one flat list - Members (people/accounts) and
// Memberships (their commercial records) are visually distinct sections
// with their own icons/labels rather than looking like duplicate entries.
const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/" }, { label: "Analytics", href: "/analytics" }] },
  {
    label: "People",
    items: [
      { label: "Members", href: "/members" },
      { label: "Memberships", href: "/memberships" },
      { label: "Coaches", href: "/coaches" },
    ],
  },
  {
    label: "Training",
    items: [
      { label: "Classes", href: "/classes" },
      { label: "Bookings", href: "/bookings" },
      { label: "WODs", href: "/wods" },
      { label: "Exercises", href: "/exercises" },
      { label: "PR Management", href: "/prs" },
      { label: "Attendance", href: "/attendance" },
    ],
  },
  {
    label: "Engagement",
    items: [
      { label: "Challenges", href: "/challenges" },
      { label: "Announcements", href: "/announcements" },
      { label: "Notifications", href: "/notifications" },
    ],
  },
  { label: "System", items: [{ label: "Settings", href: "/settings" }] },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              // Match the exact route or a child of it ("/members/123"), never a
              // sibling that merely shares a prefix ("/members" vs "/memberships").
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md border-l-2 px-2.5 py-1.5 text-sm transition ${
                    active
                      ? "border-l-accent bg-surface-elevated font-medium text-text-primary"
                      : "border-l-transparent text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
