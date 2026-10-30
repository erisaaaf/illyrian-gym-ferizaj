"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { useFetch } from "../../../lib/use-fetch";
import { formatDateTime, fullName, WEEKDAYS } from "../../../lib/format";
import { SearchInput, DateFilter, FilterBar, dayEndIso, dayStartIso } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { BarChart } from "../../../components/ui/charts";
import { StatCard } from "../../../components/stat-card";
import { DataEmptyState, ErrorState, TableSkeleton, Skeleton } from "../../../components/ui/states";

interface Visits {
  data: Array<{ id: string; checkedInAt: string; method: string; user: { id: string; firstName: string; lastName: string; memberNumber: string | null } }>;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
interface Insight {
  totalVisits: number;
  uniqueMembers: number;
  byHour: Array<{ hour: number; visits: number }>;
  peakHour: { hour: number; visits: number } | null;
  byWeekday: Array<{ weekday: number; visits: number }>;
  topMembers: Array<{ id: string; firstName?: string; lastName?: string; memberNumber?: string | null; visits: number }>;
}

/** Entries to the gym (not class bookings): who came and when, with the busiest hours of the chosen period. */
export function GymVisits() {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [debounced, from, to]);

  const range = { from: dayStartIso(from), to: dayEndIso(to) };
  const visits = useFetch<Visits>(`admin/visits${qs({ search: debounced || undefined, ...range, page, pageSize: 20 })}`);
  const insight = useFetch<Insight>(`admin/reports/attendance${qs(range)}`);
  const peak = insight.data?.peakHour;
  const hours = insight.data?.byHour.filter((h) => h.hour >= 5 && h.hour <= 23) ?? [];

  return (
    <div>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Member name or number" label="Search visits" />
        <DateFilter label="From" value={from} onChange={setFrom} />
        <DateFilter label="To" value={to} onChange={setTo} />
        <span className="text-xs text-text-muted">{from || to ? "Chosen period" : "This month"}</span>
      </FilterBar>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Visits" value={insight.data?.totalVisits} />
        <StatCard label="Different members" value={insight.data?.uniqueMembers} />
        <StatCard label="Busiest hour" value={peak ? `${String(peak.hour).padStart(2, "0")}:00` : insight.data ? "—" : undefined} hint={peak ? `${peak.visits} visits` : undefined} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">Visits by hour of day</h2>
          {insight.error ? (
            <ErrorState message={insight.error} onRetry={insight.reload} />
          ) : insight.data ? (
            <BarChart ariaLabel="Gym visits by hour of the day" labels={hours.map((h) => `${h.hour}h`)} series={[{ name: "Visits", values: hours.map((h) => h.visits) }]} />
          ) : (
            <Skeleton className="h-56 w-full" />
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">Visits by weekday</h2>
          {insight.data ? <BarChart ariaLabel="Gym visits by weekday" labels={WEEKDAYS} series={[{ name: "Visits", values: insight.data.byWeekday.map((d) => d.visits) }]} /> : <Skeleton className="h-56 w-full" />}
        </section>
      </div>

      {visits.error && <ErrorState message={visits.error} onRetry={visits.reload} />}
      {visits.loading && !visits.data && <TableSkeleton cols={4} />}
      {visits.data && visits.data.data.length === 0 && <DataEmptyState title="No visits" message="Gym entries recorded at the front desk or by QR scan appear here." />}
      {visits.data && visits.data.data.length > 0 && (
        <>
          <Table caption="Gym visits">
            <Thead>
              <Th>When</Th>
              <Th>Member</Th>
              <Th>Number</Th>
              <Th>How</Th>
            </Thead>
            <Tbody>
              {visits.data.data.map((v) => (
                <Tr key={v.id}>
                  <Td className="text-text-secondary">{formatDateTime(v.checkedInAt)}</Td>
                  <Td>
                    <Link href={`/members/${v.user.id}`} className="font-semibold hover:underline">
                      {fullName(v.user)}
                    </Link>
                  </Td>
                  <Td className="tabular text-text-secondary">{v.user.memberNumber}</Td>
                  <Td>
                    <Badge variant={v.method === "QR" ? "accent" : "neutral"}>{v.method === "QR" ? "QR scan" : "Front desk"}</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={visits.data.meta.page} totalPages={visits.data.meta.totalPages} total={visits.data.meta.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}
