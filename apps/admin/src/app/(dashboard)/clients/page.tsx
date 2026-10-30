"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { useFetch } from "../../../lib/use-fetch";
import { formatDate, fullName } from "../../../lib/format";
import { PageHeader, SearchInput } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { MembershipStatusBadge } from "../../../components/ui/badge";
import { DataEmptyState, ErrorState, TableSkeleton } from "../../../components/ui/states";

interface Clients {
  data: Array<{ id: string; firstName: string; lastName: string; memberNumber: string | null; membershipStatus: string; lastVisitAt: string | null; workoutsLast30Days: number; activePlans: number }>;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

/** A trainer's assigned clients (the owner sees every client). Coaching data only: no payments or contact details. */
export default function ClientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [debounced]);
  const { data, loading, error, reload } = useFetch<Clients>(`clients${qs({ search: debounced, page, pageSize: 20 })}`);

  return (
    <div>
      <PageHeader eyebrow="People" title="Clients" description="Members assigned to a trainer. Open one to see their training, write notes, plan their workouts and read their progress report." />
      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Client name or number" label="Search clients" />
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={6} />}
      {data && data.data.length === 0 && <DataEmptyState title="No clients" message="Members assigned to a trainer appear here. Assign a trainer from the member's profile." />}
      {data && data.data.length > 0 && (
        <>
          <Table caption="Clients">
            <Thead>
              <Th>Client</Th>
              <Th>Membership</Th>
              <Th>Last visit</Th>
              <Th align="right">Workouts (30d)</Th>
              <Th align="right">Active plans</Th>
            </Thead>
            <Tbody>
              {data.data.map((c) => (
                <Tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)}>
                  <Td>
                    <p className="font-semibold">{fullName(c)}</p>
                    <p className="text-xs text-text-muted">{c.memberNumber}</p>
                  </Td>
                  <Td>
                    <MembershipStatusBadge status={c.membershipStatus} />
                  </Td>
                  <Td className="text-text-secondary">{c.lastVisitAt ? formatDate(c.lastVisitAt) : "Never"}</Td>
                  <Td align="right">{c.workoutsLast30Days}</Td>
                  <Td align="right">{c.activePlans}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}
