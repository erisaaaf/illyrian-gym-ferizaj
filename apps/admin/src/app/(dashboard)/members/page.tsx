"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserPlus } from "lucide-react";
import { qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { useFetch } from "../../../lib/use-fetch";
import { formatDate, formatMoney, fullName } from "../../../lib/format";
import { PageHeader, SearchInput } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { MembershipStatusBadge, UserStatusBadge, Badge } from "../../../components/ui/badge";
import { ErrorState, DataEmptyState, TableSkeleton } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { Tabs } from "../../../components/ui/tabs";
import { AddMemberModal } from "./add-member-modal";

interface MemberRow {
  id: string;
  memberNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  createdAt: string;
  membershipStatus: string;
  currentMembership: { endDate: string; plan: { name: string } } | null;
  lastVisitAt: string | null;
  balanceCents: number;
  assignedCoach: { user: { firstName: string; lastName: string } } | null;
}
interface Page {
  data: MemberRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

// The categories from the requirements, in the order the front desk uses them.
const CATEGORIES = [
  { id: "ALL", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "EXPIRING_SOON", label: "Expiring soon" },
  { id: "EXPIRED", label: "Expired" },
  { id: "NEW", label: "New" },
  { id: "UNPAID", label: "Unpaid" },
  { id: "FROZEN", label: "Frozen" },
  { id: "AT_RISK", label: "Not visiting" },
  { id: "INACTIVE", label: "Inactive" },
];

function MembersView() {
  const router = useRouter();
  const params = useSearchParams();
  const [category, setCategory] = useState(params.get("category") ?? "ALL");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(params.get("add") === "1");

  useEffect(() => setPage(1), [debounced, category]);
  const { data, loading, error, reload } = useFetch<Page>(`admin/members${qs({ search: debounced, category: category === "ALL" ? undefined : category, page, pageSize: 20 })}`);

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Members"
        description="Everyone who trains here. Open a member to sell or renew a membership, take a payment, check them in or see their history."
        action={
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add member
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs label="Member category" items={CATEGORIES} active={category} onChange={setCategory} />
        <SearchInput value={search} onChange={setSearch} placeholder="Name, number, phone or email" label="Search members" />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={7} />}
      {data && data.data.length === 0 && (
        <DataEmptyState title="No members here" message={search || category !== "ALL" ? "No member matches this filter. Try another category or search." : "Add the first member to get started."} />
      )}
      {data && data.data.length > 0 && (
        <div className={loading ? "opacity-60 transition" : "transition"}>
          <Table caption="Members">
            <Thead>
              <Th>Member</Th>
              <Th>No.</Th>
              <Th>Membership</Th>
              <Th>Ends</Th>
              <Th>Last visit</Th>
              <Th align="right">Owes</Th>
              <Th>Trainer</Th>
              <Th>Account</Th>
            </Thead>
            <Tbody>
              {data.data.map((m) => (
                <Tr key={m.id} onClick={() => router.push(`/members/${m.id}`)}>
                  <Td>
                    <p className="font-semibold">{fullName(m)}</p>
                    <p className="text-xs text-text-muted">{m.phone || m.email}</p>
                  </Td>
                  <Td className="tabular text-text-secondary">{m.memberNumber ?? "—"}</Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <MembershipStatusBadge status={m.membershipStatus} />
                      <span className="text-xs text-text-muted">{m.currentMembership?.plan.name ?? "No membership"}</span>
                    </div>
                  </Td>
                  <Td className="text-text-secondary">{formatDate(m.currentMembership?.endDate)}</Td>
                  <Td className="text-text-secondary">{m.lastVisitAt ? formatDate(m.lastVisitAt) : "Never"}</Td>
                  <Td align="right">{m.balanceCents > 0 ? <Badge variant="warning">{formatMoney(m.balanceCents)}</Badge> : <span className="text-text-muted">—</span>}</Td>
                  <Td className="text-text-secondary">{m.assignedCoach ? fullName(m.assignedCoach.user) : "—"}</Td>
                  <Td>
                    <UserStatusBadge status={m.status} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />
        </div>
      )}

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={(id) => router.push(`/members/${id}`)} />
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={<TableSkeleton cols={7} />}>
      <MembersView />
    </Suspense>
  );
}
