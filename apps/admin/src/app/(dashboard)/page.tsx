"use client";

import Link from "next/link";
import { useOverview } from "../../lib/use-overview";
import { StatCard } from "../../components/stat-card";
import { ErrorState } from "../../components/ui/states";

const SETUP_STEPS = [
  { href: "/memberships", title: "1. Create a membership plan", body: "Name + duration. Add pricing only once it's confirmed." },
  { href: "/coaches", title: "2. Add your trainers", body: "Creates their login and coach profile together." },
  { href: "/members", title: "3. Add members", body: "Create the account, assign a membership, hand over the credentials." },
  { href: "/classes", title: "4. Schedule classes", body: "Assign a trainer and set capacity." },
];

export default function DashboardHomePage() {
  const { overview, error, reload } = useOverview();

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-text-primary">Dashboard</h1>
      <p className="mb-6 text-sm text-text-secondary">Live from the database. Full breakdown under Analytics.</p>

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active members" value={overview?.members.active} />
        <StatCard label="Classes in next 7 days" value={overview?.classes.upcoming} />
        <StatCard
          label="Booking utilization"
          value={overview ? (overview.bookings.utilizationPercent === null ? null : `${overview.bookings.utilizationPercent}%`) : undefined}
        />
        <StatCard label="New PRs (30 days)" value={overview?.training.newPrsLast30Days} />
        <StatCard
          label="Expiring in 7 days"
          value={overview?.memberships.expiringSoon}
          tone={overview?.memberships.expiringSoon ? "warning" : "neutral"}
        />
        <StatCard label="Expired memberships" value={overview?.memberships.expired} tone={overview?.memberships.expired ? "danger" : "neutral"} />
        <StatCard label="Workouts (30 days)" value={overview?.training.workoutsLast30Days} />
        <StatCard label="Active challenges" value={overview?.challenges.active} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-text-primary">Getting a gym set up</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SETUP_STEPS.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-lg border border-border bg-surface p-4 transition hover:bg-surface-elevated">
            <p className="text-sm font-medium text-text-primary">{s.title}</p>
            <p className="mt-1 text-xs text-text-muted">{s.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
