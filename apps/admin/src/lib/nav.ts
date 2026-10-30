import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Contact,
  CreditCard,
  Dumbbell,
  FileText,
  Flame,
  HeartPulse,
  LayoutDashboard,
  Library,
  type LucideIcon,
  Medal,
  Megaphone,
  MessageSquare,
  Receipt,
  ScanLine,
  Settings,
  Trophy,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export type StaffRole = "ADMIN" | "RECEPTIONIST" | "COACH";

export const ROLE_LABEL: Record<StaffRole, string> = {
  ADMIN: "Admin / Owner",
  RECEPTIONIST: "Reception",
  COACH: "Trainer",
};

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Roles that see this entry. The API enforces the same rules - hiding a link is never the access control. */
  roles: StaffRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: StaffRole[] = ["ADMIN", "RECEPTIONIST", "COACH"];
const FRONT_DESK: StaffRole[] = ["ADMIN", "RECEPTIONIST"];
const COACHING: StaffRole[] = ["ADMIN", "COACH"];

// Grouped by purpose. Members (people/accounts) and Memberships (their commercial records) are
// separate entries with different icons, and "active" matches a route or its children only -
// never a sibling that merely shares a prefix.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, roles: ALL },
      { label: "Analytics", href: "/analytics", icon: BarChart3, roles: ["ADMIN"] },
      { label: "Business reports", href: "/reports", icon: FileText, roles: ["ADMIN"] },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Members", href: "/members", icon: Users, roles: FRONT_DESK },
      { label: "My clients", href: "/clients", icon: Contact, roles: ["COACH"] },
      { label: "Memberships", href: "/memberships", icon: CreditCard, roles: FRONT_DESK },
      { label: "Staff & trainers", href: "/coaches", icon: UserCog, roles: ["ADMIN"] },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Payments", href: "/payments", icon: Wallet, roles: FRONT_DESK },
      { label: "Invoices", href: "/invoices", icon: Receipt, roles: FRONT_DESK },
      { label: "Expenses", href: "/expenses", icon: FileText, roles: ["ADMIN"] },
    ],
  },
  {
    label: "Gym floor",
    items: [
      { label: "Check-in", href: "/check-in", icon: ScanLine, roles: FRONT_DESK },
      { label: "Attendance", href: "/attendance", icon: CalendarCheck, roles: COACHING },
    ],
  },
  {
    label: "Training",
    items: [
      { label: "Classes", href: "/classes", icon: CalendarDays, roles: ALL },
      { label: "Bookings", href: "/bookings", icon: BookOpen, roles: FRONT_DESK },
      { label: "WODs", href: "/wods", icon: Flame, roles: COACHING },
      { label: "Exercises", href: "/exercises", icon: Library, roles: COACHING },
      { label: "Workout plans", href: "/plans", icon: ClipboardList, roles: COACHING },
      { label: "PR management", href: "/prs", icon: Medal, roles: COACHING },
      { label: "Progress reports", href: "/progress", icon: HeartPulse, roles: COACHING },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Messages", href: "/communications", icon: MessageSquare, roles: ALL },
      { label: "Announcements", href: "/announcements", icon: Megaphone, roles: ["ADMIN"] },
      { label: "Notification log", href: "/notifications", icon: Bell, roles: ["ADMIN"] },
      { label: "Challenges", href: "/challenges", icon: Trophy, roles: ["ADMIN"] },
    ],
  },
  { label: "System", items: [{ label: "Settings", href: "/settings", icon: Settings, roles: ["ADMIN"] }] },
];

export function navFor(role: StaffRole): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length > 0);
}

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** The nav entry that owns a path (longest matching prefix), used for the route guard and the page title. */
export function entryForPath(pathname: string): NavItem | undefined {
  return NAV_GROUPS.flatMap((g) => g.items)
    .filter((i) => isActive(pathname, i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export { Activity, Dumbbell };
