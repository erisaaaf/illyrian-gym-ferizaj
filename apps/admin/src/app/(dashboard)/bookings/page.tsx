"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { PageHeader, FilterSelect, SearchInput, DateFilter, dayStartIso, dayEndIso } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";

interface BookingItem {
  id: string;
  status: "BOOKED" | "WAITLISTED" | "CANCELLED" | "ATTENDED" | "NO_SHOW";
  bookedAt: string;
  user: { id: string; firstName: string; lastName: string; email: string };
  class: { id: string; title: string; startTime: string };
}

interface PaginatedBookings {
  data: BookingItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function BookingsPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedBookings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const upcoming = status === "UPCOMING";
      setResult(
        await api.get<PaginatedBookings>(
          `admin/bookings${qs({
            status: upcoming ? undefined : status || undefined,
            upcoming: upcoming ? "true" : undefined,
            search: debouncedSearch || undefined,
            from: dayStartIso(from),
            to: dayEndIso(to),
            page,
          })}`,
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, [status, debouncedSearch, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  const statusVariant = (s: string) =>
    s === "BOOKED" || s === "ATTENDED" ? "success" : s === "WAITLISTED" ? "warning" : s === "NO_SHOW" ? "danger" : "neutral";

  return (
    <div>
      <PageHeader title="Bookings" description="Every class booking, across all members. Cancelling here follows the same rules as a member cancelling their own booking." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search member or class..."
        />
        <DateFilter label="From" value={from} onChange={(v) => { setFrom(v); setPage(1); }} />
        <DateFilter label="To" value={to} onChange={(v) => { setTo(v); setPage(1); }} />
        <FilterSelect
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "All statuses" },
            { value: "UPCOMING", label: "Upcoming (booked + waitlist)" },
            { value: "BOOKED", label: "Booked" },
            { value: "WAITLISTED", label: "Waitlisted" },
            { value: "ATTENDED", label: "Attended" },
            { value: "NO_SHOW", label: "No show" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
        />
      </div>

      {loading && <LoadingState label="Loading bookings..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No bookings found" message="Bookings will appear here once members start booking classes." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Member</Th>
              <Th>Class</Th>
              <Th>When</Th>
              <Th>Booked at</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {result.data.map((b) => (
                <Tr key={b.id}>
                  <Td className="font-medium">
                    {b.user.firstName} {b.user.lastName}
                  </Td>
                  <Td className="text-text-secondary">{b.class.title}</Td>
                  <Td className="text-text-secondary">{new Date(b.class.startTime).toLocaleString()}</Td>
                  <Td className="text-text-secondary">{new Date(b.bookedAt).toLocaleDateString()}</Td>
                  <Td>
                    <Badge variant={statusVariant(b.status)}>{b.status.replace("_", " ")}</Badge>
                  </Td>
                  <Td>
                    {(b.status === "BOOKED" || b.status === "WAITLISTED") && (
                      <Button size="sm" variant="ghost" onClick={() => setCancelTarget(b)}>
                        Cancel
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={result.meta.page} totalPages={result.meta.totalPages} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (cancelTarget) await api.patch(`admin/bookings/${cancelTarget.id}/cancel`);
          await load();
        }}
        title="Cancel booking"
        message={`Cancel ${cancelTarget?.user.firstName} ${cancelTarget?.user.lastName}'s booking for "${cancelTarget?.class.title}"?`}
        confirmLabel="Cancel booking"
        danger
      />
    </div>
  );
}
