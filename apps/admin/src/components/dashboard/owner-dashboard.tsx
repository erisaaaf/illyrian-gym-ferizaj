"use client";

import Link from "next/link";
import { AlertTriangle, CreditCard, ScanLine, UserPlus, Users, Wallet, Snowflake, Receipt } from "lucide-react";
import { useFetch } from "../../lib/use-fetch";
import { formatDate, formatDateTime, formatMoney, fullName, PAYMENT_METHOD_LABEL, PLAN_TYPE_LABEL, shortPeriod } from "../../lib/format";
import { StatCard, BarRow } from "../stat-card";
import { BarChart, DonutChart, LineChart } from "../ui/charts";
import { DataEmptyState, ErrorState, StatSkeleton, Skeleton } from "../ui/states";
import { PageHeader } from "../ui/page-header";
import { Badge } from "../ui/badge";

interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
}

interface Dashboard {
  generatedAt: string;
  kpis: {
    activeMembers: number;
    frozenMembers: number;
    newMembersThisMonth: number;
    monthlyRevenueCents: number;
    monthlyRevenueChangePercent: number | null;
    monthlyExpensesCents: number;
    monthlyNetCents: number;
    outstandingCents: number;
    overdueCents: number;
    expiringSoon: number;
    expiringSoonDays: number;
    todaysCheckIns: number;
    atRiskCount: number;
    atRiskDays: number;
  };
  revenueSeries: Array<{ bucket: string; receivedCents: number; expensesCents: number }>;
  membershipGrowth: Array<{ month: string; newMembers: number; newMemberships: number; renewals: number; lost: number; activeAtEnd: number }>;
  attendanceTrend: Array<{ date: string; visits: number }>;
  distribution: { byPlan: Array<{ plan: string; type: string; members: number }>; byType: Array<{ type: string; members: number }> };
  recentPayments: Array<{ id: string; amountCents: number; method: string; receivedAt: string; user: PersonRef; invoice: { number: string } | null }>;
  upcomingExpirations: Array<{ id: string; endDate: string; daysRemaining: number; alreadyRenewed: boolean; user: PersonRef; plan: { name: string } }>;
  atRiskMembers: Array<PersonRef & { daysSinceLastVisit: number | null; plan: string | null; assignedTrainer: string | null }>;
  outstandingBalances: Array<PersonRef & { balanceCents: number; overdueCents: number; openInvoices: number }>;
}

function Panel({ title, action, children }: { title: string; action?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-extrabold tracking-heading text-text-primary">{title}</h2>
        {action && (
          <Link href={action.href} className="text-xs font-bold text-accent-text hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function PersonLink({ p }: { p: PersonRef }) {
  return (
    <Link href={`/members/${p.id}`} className="font-semibold text-text-primary hover:underline">
      {fullName(p)}
      {p.memberNumber && <span className="ml-2 text-xs font-medium text-text-muted">{p.memberNumber}</span>}
    </Link>
  );
}

const QUICK = [
  { href: "/check-in", label: "Check-in", icon: ScanLine },
  { href: "/members?add=1", label: "Add member", icon: UserPlus },
  { href: "/payments?record=1", label: "Record payment", icon: Wallet },
  { href: "/memberships", label: "Sell membership", icon: CreditCard },
];

export function OwnerDashboard() {
  const { data, loading, error, reload } = useFetch<Dashboard>("admin/reports/dashboard");
  const k = data?.kpis;

  return (
    <div>
      <PageHeader
        eyebrow="Owner overview"
        title="Dashboard"
        description="Every number here is calculated from the gym's own records when you open the page. Revenue counts money actually received."
        action={QUICK.map((q) => (
          <Link key={q.href} href={q.href} className="inline-flex h-10 items-center gap-2 rounded-pill border border-border-strong bg-surface px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-sunken">
            <q.icon className="h-4 w-4" aria-hidden="true" />
            {q.label}
          </Link>
        ))}
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Active members" value={k?.activeMembers} icon={<Users className="h-4 w-4" />} hint={k ? `${k.newMembersThisMonth} joined this month` : undefined} />
            <StatCard
              label="Monthly revenue"
              value={k ? formatMoney(k.monthlyRevenueCents) : undefined}
              icon={<Wallet className="h-4 w-4" />}
              trend={k ? { percent: k.monthlyRevenueChangePercent, label: "vs the same period last month" } : undefined}
              hint={k && k.monthlyRevenueChangePercent === null ? "Money received this month" : undefined}
            />
            <StatCard
              label="Expiring soon"
              value={k?.expiringSoon}
              tone={k?.expiringSoon ? "warning" : "neutral"}
              icon={<AlertTriangle className="h-4 w-4" />}
              hint={k ? `within ${k.expiringSoonDays} days` : undefined}
            />
            <StatCard label="Today's check-ins" value={k?.todaysCheckIns} icon={<ScanLine className="h-4 w-4" />} hint="Gym visits since midnight" />
          </>
        )}
      </div>

      {k && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Expenses this month", value: formatMoney(k.monthlyExpensesCents), icon: Receipt },
            { label: "Net this month", value: formatMoney(k.monthlyNetCents), icon: Wallet },
            { label: "Outstanding", value: formatMoney(k.outstandingCents), icon: CreditCard },
            { label: "Overdue", value: formatMoney(k.overdueCents), icon: AlertTriangle, danger: k.overdueCents > 0 },
            { label: "Frozen memberships", value: String(k.frozenMembers), icon: Snowflake },
            { label: `Not seen in ${k.atRiskDays} days`, value: String(k.atRiskCount), icon: Users },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-border bg-surface px-4 py-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                <m.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {m.label}
              </p>
              <p className={`tabular mt-1 font-heading text-lg font-extrabold tracking-heading ${m.danger ? "text-danger" : "text-text-primary"}`}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Revenue received vs expenses (6 months)" action={{ href: "/payments", label: "Payments" }}>
          {loading && !data ? (
            <Skeleton className="h-56 w-full" />
          ) : data && data.revenueSeries.length > 0 ? (
            <BarChart
              ariaLabel="Money received and expenses per month"
              labels={data.revenueSeries.map((r) => shortPeriod(r.bucket))}
              series={[
                { name: "Received", values: data.revenueSeries.map((r) => r.receivedCents / 100) },
                { name: "Expenses", values: data.revenueSeries.map((r) => r.expensesCents / 100), color: "#9fa89f" },
              ]}
              format={(n) => formatMoney(Math.round(n * 100))}
            />
          ) : (
            <DataEmptyState title="No payments yet" message="Revenue appears here as soon as the first payment is recorded." />
          )}
        </Panel>

        <Panel title="Members: new, renewed and lost" action={{ href: "/analytics", label: "Analytics" }}>
          {loading && !data ? (
            <Skeleton className="h-56 w-full" />
          ) : data ? (
            <LineChart
              ariaLabel="New members, renewals and lost members per month"
              labels={data.membershipGrowth.map((g) => shortPeriod(g.month))}
              series={[
                { name: "New members", values: data.membershipGrowth.map((g) => g.newMembers) },
                { name: "Renewals", values: data.membershipGrowth.map((g) => g.renewals), color: "#6e9900" },
                { name: "Lost", values: data.membershipGrowth.map((g) => g.lost), color: "#9fa89f" },
              ]}
            />
          ) : null}
        </Panel>

        <Panel title="Visits per day (last 30 days)" action={{ href: "/attendance", label: "Attendance" }}>
          {loading && !data ? (
            <Skeleton className="h-56 w-full" />
          ) : data && data.attendanceTrend.length > 0 ? (
            <LineChart ariaLabel="Gym visits per day" labels={data.attendanceTrend.map((d) => shortPeriod(d.date))} series={[{ name: "Visits", values: data.attendanceTrend.map((d) => d.visits) }]} />
          ) : (
            <DataEmptyState title="No visits yet" message="Check-ins from the front desk or the member QR code show up here." />
          )}
        </Panel>

        <Panel title="Active members by membership type">
          {data ? (
            <>
              <DonutChart
                ariaLabel="Active members by membership type"
                centerLabel="members"
                segments={data.distribution.byType.map((t) => ({ label: PLAN_TYPE_LABEL[t.type] ?? t.type, value: t.members }))}
              />
              {data.distribution.byPlan.length > 0 && (
                <div className="mt-5 border-t border-border pt-4">
                  {data.distribution.byPlan.slice(0, 6).map((p) => (
                    <BarRow key={p.plan} label={p.plan} value={p.members} max={Math.max(...data.distribution.byPlan.map((x) => x.members))} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Memberships ending soon" action={{ href: "/memberships?tab=expiring", label: "See all" }}>
          {data && data.upcomingExpirations.length === 0 && <p className="text-sm text-text-muted">Nothing is ending in the next {k?.expiringSoonDays} days.</p>}
          <ul className="divide-y divide-border">
            {data?.upcomingExpirations.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <PersonLink p={m.user} />
                  <p className="text-xs text-text-muted">{m.plan.name}</p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <p className="font-semibold text-text-primary">{formatDate(m.endDate)}</p>
                  {m.alreadyRenewed ? <Badge variant="success">Renewed</Badge> : <Badge variant="warning">{m.daysRemaining} days left</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Unpaid balances" action={{ href: "/invoices?status=unpaid", label: "Invoices" }}>
          {data && data.outstandingBalances.length === 0 && <p className="text-sm text-text-muted">No member owes anything right now.</p>}
          <ul className="divide-y divide-border">
            {data?.outstandingBalances.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <PersonLink p={d} />
                  <p className="text-xs text-text-muted">{d.openInvoices} open {d.openInvoices === 1 ? "invoice" : "invoices"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular font-bold text-text-primary">{formatMoney(d.balanceCents)}</p>
                  {d.overdueCents > 0 && <Badge variant="danger">{formatMoney(d.overdueCents)} overdue</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent payments" action={{ href: "/payments", label: "See all" }}>
          {data && data.recentPayments.length === 0 && <p className="text-sm text-text-muted">No payments recorded yet.</p>}
          <ul className="divide-y divide-border">
            {data?.recentPayments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <PersonLink p={p.user} />
                  <p className="text-xs text-text-muted">
                    {PAYMENT_METHOD_LABEL[p.method] ?? p.method} · {formatDateTime(p.receivedAt)}
                    {p.invoice && ` · ${p.invoice.number}`}
                  </p>
                </div>
                <p className="tabular shrink-0 font-bold text-text-primary">{formatMoney(p.amountCents)}</p>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={`Active members not seen in ${k?.atRiskDays ?? 14}+ days`} action={{ href: "/analytics?tab=at-risk", label: "See all" }}>
          {data && data.atRiskMembers.length === 0 && <p className="text-sm text-text-muted">Everyone with an active membership has visited recently.</p>}
          <ul className="divide-y divide-border">
            {data?.atRiskMembers.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <PersonLink p={m} />
                  <p className="text-xs text-text-muted">{m.plan ?? "No plan"}{m.assignedTrainer && ` · ${m.assignedTrainer}`}</p>
                </div>
                <Badge variant="warning">{m.daysSinceLastVisit === null ? "Never visited" : `${m.daysSinceLastVisit} days ago`}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
