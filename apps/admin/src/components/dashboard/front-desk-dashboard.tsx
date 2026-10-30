"use client";

import Link from "next/link";
import { CreditCard, ScanLine, UserPlus, Users, Wallet } from "lucide-react";
import { useFetch } from "../../lib/use-fetch";
import { formatDate, formatMoney, formatTime, fullName } from "../../lib/format";
import { StatCard } from "../stat-card";
import { DataEmptyState, ErrorState, StatSkeleton } from "../ui/states";
import { PageHeader } from "../ui/page-header";
import { Badge } from "../ui/badge";

interface Today {
  count: number;
  uniqueMembers: number;
  recent: Array<{ id: string; checkedInAt: string; method: string; user: { id: string; firstName: string; lastName: string; memberNumber: string | null }; membership: { plan: { name: string } } | null }>;
}
interface Expiring {
  data: Array<{ id: string; endDate: string; daysRemaining: number; alreadyRenewed: boolean; user: { id: string; firstName: string; lastName: string; memberNumber: string | null }; plan: { name: string } }>;
  meta: { total: number };
  days: number;
}
interface Invoices {
  data: Array<{ id: string; number: string; balanceCents: number; displayStatus: string; dueDate: string; user: { id: string; firstName: string; lastName: string } }>;
  meta: { total: number };
}

/** Front-desk home: what reception needs right now - who is in, who is about to expire, who owes money. */
export function FrontDeskDashboard() {
  const today = useFetch<Today>("admin/check-in/today");
  const expiring = useFetch<Expiring>("admin/memberships/expiring?pageSize=8");
  const unpaid = useFetch<Invoices>("admin/invoices?status=OUTSTANDING&pageSize=8");
  const error = today.error ?? expiring.error ?? unpaid.error;

  return (
    <div>
      <PageHeader
        eyebrow="Front desk"
        title="Today at the gym"
        description="Check members in, sell and renew memberships, and take payments."
        action={
          <>
            <Link href="/check-in" className="inline-flex h-10 items-center gap-2 rounded-pill bg-accent px-5 text-sm font-bold text-accent-contrast transition hover:bg-accent-hover">
              <ScanLine className="h-4 w-4" aria-hidden="true" />
              Open check-in
            </Link>
            <Link href="/members?add=1" className="inline-flex h-10 items-center gap-2 rounded-pill border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-sunken">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add member
            </Link>
          </>
        }
      />
      {error && <ErrorState message={error} onRetry={() => (today.reload(), expiring.reload(), unpaid.reload())} />}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {today.loading && !today.data ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Check-ins today" value={today.data?.count} icon={<ScanLine className="h-4 w-4" />} hint={today.data ? `${today.data.uniqueMembers} different members` : undefined} />
            <StatCard label="Expiring soon" value={expiring.data?.meta.total} tone={expiring.data?.meta.total ? "warning" : "neutral"} icon={<CreditCard className="h-4 w-4" />} hint={expiring.data ? `within ${expiring.data.days} days` : undefined} />
            <StatCard label="Invoices to collect" value={unpaid.data?.meta.total} tone={unpaid.data?.meta.total ? "warning" : "neutral"} icon={<Wallet className="h-4 w-4" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">Latest check-ins</h2>
          {today.data && today.data.recent.length === 0 ? (
            <DataEmptyState title="Nobody yet" message="Check-ins appear here as members arrive." icon={<Users className="h-5 w-5" />} />
          ) : (
            <ul className="divide-y divide-border">
              {today.data?.recent.slice(0, 8).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/members/${v.user.id}`} className="font-semibold hover:underline">
                    {fullName(v.user)}
                  </Link>
                  <span className="tabular text-xs text-text-muted">{formatTime(v.checkedInAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-base font-extrabold tracking-heading">Ending soon</h2>
            <Link href="/memberships?tab=expiring" className="text-xs font-bold text-accent-text hover:underline">
              See all
            </Link>
          </div>
          {expiring.data && expiring.data.data.length === 0 && <p className="text-sm text-text-muted">Nothing is ending soon.</p>}
          <ul className="divide-y divide-border">
            {expiring.data?.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/members/${m.user.id}`} className="font-semibold hover:underline">
                    {fullName(m.user)}
                  </Link>
                  <p className="text-xs text-text-muted">{m.plan.name} · {formatDate(m.endDate)}</p>
                </div>
                {m.alreadyRenewed ? <Badge variant="success">Renewed</Badge> : <Badge variant="warning">{m.daysRemaining}d</Badge>}
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-base font-extrabold tracking-heading">To collect</h2>
            <Link href="/invoices" className="text-xs font-bold text-accent-text hover:underline">
              Invoices
            </Link>
          </div>
          {unpaid.data && unpaid.data.data.length === 0 && <p className="text-sm text-text-muted">No unpaid invoices.</p>}
          <ul className="divide-y divide-border">
            {unpaid.data?.data.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/members/${i.user.id}`} className="font-semibold hover:underline">
                    {fullName(i.user)}
                  </Link>
                  <p className="text-xs text-text-muted">{i.number} · due {formatDate(i.dueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="tabular font-bold">{formatMoney(i.balanceCents)}</p>
                  {i.displayStatus === "OVERDUE" && <Badge variant="danger">Overdue</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
