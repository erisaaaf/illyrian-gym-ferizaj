"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { qs } from "../../../lib/api";
import { useFetch } from "../../../lib/use-fetch";
import { formatDate, fullName, shortPeriod } from "../../../lib/format";
import { PageHeader, FilterSelect } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { BarChart, LineChart } from "../../../components/ui/charts";
import { StatCard } from "../../../components/stat-card";
import { Tabs } from "../../../components/ui/tabs";
import { DataEmptyState, ErrorState, Skeleton, TableSkeleton } from "../../../components/ui/states";

interface Growth {
  month: string;
  newMembers: number;
  newMemberships: number;
  renewals: number;
  lost: number;
  expiring: number;
  renewed: number;
  renewalRatePercent: number | null;
  activeAtEnd: number;
  newMembersChangePercent: number | null;
}
interface AtRisk {
  data: Array<{ id: string; firstName: string; lastName: string; memberNumber: string | null; phone: string | null; assignedTrainer: string | null; plan: string | null; membershipEnds: string | null; daysSinceLastVisit: number | null }>;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  days: number;
}
interface TrainerReport {
  trainers: Array<{ coachId: string; name: string; isActive: boolean; assignedClients: number; classesScheduled: number; totalBookings: number; totalCapacity: number; checkedInAttendees: number; wodsWritten: number }>;
}

function GrowthTab() {
  const [months, setMonths] = useState("12");
  const { data, loading, error, reload } = useFetch<Growth[]>(`admin/reports/membership-growth${qs({ months })}`);
  const last = data?.[data.length - 1];
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-secondary">New members, renewals and members lost, month by month. &ldquo;Lost&rdquo; means a membership ended and the member did not continue.</p>
        <FilterSelect value={months} onChange={setMonths} label="Period" options={[{ value: "6", label: "6 months" }, { value: "12", label: "12 months" }, { value: "24", label: "24 months" }]} />
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-64 w-full" />}
      {data && last && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="New members (this month)" value={last.newMembers} trend={{ percent: last.newMembersChangePercent, label: "vs last month" }} />
            <StatCard label="Renewals (this month)" value={last.renewals} />
            <StatCard label="Active at month end" value={last.activeAtEnd} />
            <StatCard label="Renewal rate" value={last.renewalRatePercent === null ? null : `${last.renewalRatePercent}%`} hint={last.expiring ? `${last.renewed} of ${last.expiring} ending` : "Nothing ended yet"} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">New, renewed and lost</h2>
              <BarChart
                ariaLabel="New members, renewals and lost members per month"
                labels={data.map((g) => shortPeriod(g.month))}
                series={[
                  { name: "New", values: data.map((g) => g.newMembers) },
                  { name: "Renewals", values: data.map((g) => g.renewals), color: "#6e9900" },
                  { name: "Lost", values: data.map((g) => g.lost), color: "#9fa89f" },
                ]}
              />
            </section>
            <section className="card p-5">
              <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">Active members</h2>
              <LineChart ariaLabel="Members with an active membership at the end of each month" labels={data.map((g) => shortPeriod(g.month))} series={[{ name: "Active members", values: data.map((g) => g.activeAtEnd) }]} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function AtRiskTab() {
  const [days, setDays] = useState("14");
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch<AtRisk>(`admin/reports/at-risk${qs({ days, page, pageSize: 20 })}`);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-secondary">Members with a running membership who have not been to the gym for a while: the ones most likely to leave. Reach out before they do.</p>
        <FilterSelect
          value={days}
          onChange={(v) => {
            setDays(v);
            setPage(1);
          }}
          label="Not seen for"
          options={[{ value: "14", label: "14+ days" }, { value: "30", label: "30+ days" }, { value: "60", label: "60+ days" }]}
        />
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={5} />}
      {data && data.data.length === 0 && <DataEmptyState title="Nobody is drifting away" message={`Every member with an active membership has visited in the last ${days} days.`} />}
      {data && data.data.length > 0 && (
        <>
          <Table caption="At-risk members">
            <Thead>
              <Th>Member</Th>
              <Th>Package</Th>
              <Th>Ends</Th>
              <Th>Trainer</Th>
              <Th>Last visit</Th>
            </Thead>
            <Tbody>
              {data.data.map((m) => (
                <Tr key={m.id}>
                  <Td>
                    <Link href={`/members/${m.id}`} className="font-semibold hover:underline">
                      {fullName(m)}
                    </Link>
                    <p className="text-xs text-text-muted">{m.phone ?? m.memberNumber}</p>
                  </Td>
                  <Td>{m.plan ?? "—"}</Td>
                  <Td className="text-text-secondary">{formatDate(m.membershipEnds)}</Td>
                  <Td className="text-text-secondary">{m.assignedTrainer ?? "—"}</Td>
                  <Td>
                    <Badge variant="warning">{m.daysSinceLastVisit === null ? "Never visited" : `${m.daysSinceLastVisit} days ago`}</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />
          <p className="mt-3 text-xs text-text-muted">
            To message them, use <Link href="/communications" className="font-bold text-accent-text hover:underline">Messages</Link> and choose &ldquo;Members not visiting&rdquo;.
          </p>
        </>
      )}
    </div>
  );
}

function TrainersTab() {
  const { data, loading, error, reload } = useFetch<TrainerReport>("admin/reports/trainers");
  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-text-secondary">Workload and activity of each trainer this month: clients, classes, how full they were, and WODs written.</p>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={6} rows={4} />}
      {data && data.trainers.length === 0 && <DataEmptyState title="No trainers" message="Add trainers under Staff & trainers." />}
      {data && data.trainers.length > 0 && (
        <Table caption="Trainer activity">
          <Thead>
            <Th>Trainer</Th>
            <Th align="right">Clients</Th>
            <Th align="right">Classes</Th>
            <Th align="right">Booked / capacity</Th>
            <Th align="right">Attended</Th>
            <Th align="right">WODs</Th>
          </Thead>
          <Tbody>
            {data.trainers.map((t) => (
              <Tr key={t.coachId}>
                <Td>
                  <p className="font-semibold">{t.name}</p>
                  {!t.isActive && <Badge>Inactive</Badge>}
                </Td>
                <Td align="right">{t.assignedClients}</Td>
                <Td align="right">{t.classesScheduled}</Td>
                <Td align="right">
                  {t.totalBookings} / {t.totalCapacity}
                </Td>
                <Td align="right">{t.checkedInAttendees}</Td>
                <Td align="right">{t.wodsWritten}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}

function AnalyticsView() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState(params.get("tab") ?? "growth");
  return (
    <div>
      <PageHeader eyebrow="Overview" title="Analytics" description="How the gym is growing, who is drifting away, and how the team is doing. Calculated from stored records only." />
      <div className="mb-5">
        <Tabs
          label="Analytics sections"
          active={tab}
          onChange={(t) => {
            setTab(t);
            router.replace(`/analytics?tab=${t}`, { scroll: false });
          }}
          items={[
            { id: "growth", label: "Membership growth" },
            { id: "at-risk", label: "At-risk members" },
            { id: "trainers", label: "Trainers" },
          ]}
        />
      </div>
      {tab === "growth" && <GrowthTab />}
      {tab === "at-risk" && <AtRiskTab />}
      {tab === "trainers" && <TrainersTab />}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<TableSkeleton cols={5} />}>
      <AnalyticsView />
    </Suspense>
  );
}
