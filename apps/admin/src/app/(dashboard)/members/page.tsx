"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { PageHeader, SearchInput, FilterSelect } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { MembershipStatusBadge, UserStatusBadge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { AddMemberModal } from "./add-member-modal";

interface MemberListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  createdAt: string;
  membershipStatus: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "CANCELLED" | "NONE";
  memberships: Array<{ plan: { name: string } }>;
}

interface PaginatedMembers {
  data: MemberListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function MembersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PaginatedMembers>(
        `admin/members${qs({ search: debouncedSearch, status: status || undefined, page })}`,
      );
      setResult(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load members.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  return (
    <div>
      <PageHeader
        title="Members"
        description="Member accounts and who they are. For their commercial membership record, see Memberships."
        action={<Button onClick={() => setAddOpen(true)}>Add Member</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email..." />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "All statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
            { value: "SUSPENDED", label: "Suspended" },
          ]}
        />
      </div>

      {loading && <LoadingState label="Loading members..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No members found" message="Try a different search or filter, or add a new member." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Membership</Th>
              <Th>Account</Th>
              <Th>Joined</Th>
            </Thead>
            <Tbody>
              {result.data.map((m) => (
                <Tr key={m.id} onClick={() => router.push(`/members/${m.id}`)}>
                  <Td className="font-medium">
                    {m.firstName} {m.lastName}
                  </Td>
                  <Td className="text-text-secondary">{m.email}</Td>
                  <Td>
                    <MembershipStatusBadge status={m.membershipStatus} />
                  </Td>
                  <Td>
                    <UserStatusBadge status={m.status} />
                  </Td>
                  <Td className="text-text-secondary">{new Date(m.createdAt).toLocaleDateString()}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={result.meta.page} totalPages={result.meta.totalPages} onChange={setPage} />
        </>
      )}

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
    </div>
  );
}
