"use client";

import Link from "next/link";
import { ClipboardList, Contact, MessageSquare } from "lucide-react";
import { useFetch } from "../../lib/use-fetch";
import { formatDate, fullName } from "../../lib/format";
import { StatCard } from "../stat-card";
import { DataEmptyState, ErrorState, StatSkeleton } from "../ui/states";
import { PageHeader } from "../ui/page-header";
import { MembershipStatusBadge } from "../ui/badge";

interface Clients {
  data: Array<{ id: string; firstName: string; lastName: string; memberNumber: string | null; membershipStatus: string; lastVisitAt: string | null; workoutsLast30Days: number; activePlans: number }>;
  meta: { total: number };
}

/** Trainer home: their own clients only (the API scopes it), with who needs attention first. */
export function TrainerHome() {
  const { data, loading, error, reload } = useFetch<Clients>("clients?pageSize=100");
  const noPlan = data?.data.filter((c) => c.activePlans === 0).length;
  const quiet = data?.data.filter((c) => c.workoutsLast30Days === 0).length;

  return (
    <div>
      <PageHeader
        eyebrow="Trainer portal"
        title="My clients"
        description="You see the members assigned to you: their training, plans and the progress they have chosen to share."
        action={
          <Link href="/plans" className="inline-flex h-10 items-center gap-2 rounded-pill bg-accent px-5 text-sm font-bold text-accent-contrast hover:bg-accent-hover">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Workout plans
          </Link>
        }
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading && !data ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Assigned clients" value={data?.meta.total} icon={<Contact className="h-4 w-4" />} />
            <StatCard label="Without an active plan" value={noPlan} tone={noPlan ? "warning" : "neutral"} icon={<ClipboardList className="h-4 w-4" />} />
            <StatCard label="No workout in 30 days" value={quiet} tone={quiet ? "warning" : "neutral"} icon={<MessageSquare className="h-4 w-4" />} />
          </>
        )}
      </div>

      {data && data.data.length === 0 ? (
        <DataEmptyState title="No clients assigned yet" message="The gym owner or reception assigns members to you from the member profile." icon={<Contact className="h-5 w-5" />} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data?.data.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`} className="card block p-4 transition hover:border-border-strong hover:shadow-popover">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-heading text-base font-extrabold tracking-heading">{fullName(c)}</p>
                    <p className="text-xs text-text-muted">{c.memberNumber ?? "No member number"}</p>
                  </div>
                  <MembershipStatusBadge status={c.membershipStatus} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-text-muted">Last visit</dt>
                    <dd className="font-semibold">{c.lastVisitAt ? formatDate(c.lastVisitAt) : "Never"}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Workouts (30d)</dt>
                    <dd className="tabular font-semibold">{c.workoutsLast30Days}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Active plans</dt>
                    <dd className="tabular font-semibold">{c.activePlans}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
