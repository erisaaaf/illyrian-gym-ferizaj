"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { PageHeader, SearchInput, DateFilter, dayStartIso, dayEndIso } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { MarkAttendanceModal } from "./mark-attendance-modal";
import { GymVisits } from "./gym-visits";
import { Tabs } from "../../../components/ui/tabs";
import { useStaffUser } from "../../../lib/staff-context";

interface AttendanceItem {
  id: string;
  status: "CHECKED_IN" | "NO_SHOW" | "CANCELLED";
  checkedInAt: string | null;
  createdAt: string;
  markedAt: string | null;
  markedBy: { id: string; firstName: string; lastName: string } | null;
  user: { id: string; firstName: string; lastName: string; email: string };
  class: { id: string; title: string; startTime: string };
}

interface PaginatedAttendance {
  data: AttendanceItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

function ClassAttendance() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markOpen, setMarkOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.get<PaginatedAttendance>(`admin/attendance${qs({ search: debouncedSearch || undefined, from: dayStartIso(from), to: dayEndIso(to), page })}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load attendance.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function correct(a: AttendanceItem, status: AttendanceItem["status"]) {
    if (status === a.status) return;
    setActionError(null);
    try {
      await api.post("admin/attendance", { userId: a.user.id, classId: a.class.id, status });
      await load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Could not update attendance.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Who showed up, who didn't. Every manual change is recorded in the audit log."
        action={<Button onClick={() => setMarkOpen(true)}>Mark Attendance</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search member or class..." />
        <DateFilter label="From" value={from} onChange={(v) => { setFrom(v); setPage(1); }} />
        <DateFilter label="To" value={to} onChange={(v) => { setTo(v); setPage(1); }} />
      </div>
      {actionError && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{actionError}</p>}

      {loading && <LoadingState label="Loading attendance..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No attendance recorded yet" message="Mark attendance for a class to get started." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Member</Th>
              <Th>Class</Th>
              <Th>Status</Th>
              <Th>Marked by</Th>
              <Th>Recorded</Th>
              <Th>Correct</Th>
            </Thead>
            <Tbody>
              {result.data.map((a) => (
                <Tr key={a.id}>
                  <Td className="font-medium">
                    {a.user.firstName} {a.user.lastName}
                  </Td>
                  <Td className="text-text-secondary">
                    {a.class.title} — {new Date(a.class.startTime).toLocaleDateString()}
                  </Td>
                  <Td>
                    <Badge variant={a.status === "CHECKED_IN" ? "success" : a.status === "NO_SHOW" ? "danger" : "neutral"}>
                      {a.status.replace("_", " ")}
                    </Badge>
                  </Td>
                  <Td className="text-text-secondary">
                    {a.markedBy ? `${a.markedBy.firstName} ${a.markedBy.lastName}` : <span className="text-text-muted">—</span>}
                  </Td>
                  <Td className="text-text-secondary">{new Date(a.markedAt ?? a.createdAt).toLocaleString()}</Td>
                  <Td>
                    <select
                      aria-label={`Change status for ${a.user.firstName} ${a.user.lastName}`}
                      value={a.status}
                      onChange={(e) => correct(a, e.target.value as AttendanceItem["status"])}
                      className="rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-ink"
                    >
                      <option value="CHECKED_IN">Checked in</option>
                      <option value="NO_SHOW">No show</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={result.meta.page} totalPages={result.meta.totalPages} onChange={setPage} />
        </>
      )}

      <MarkAttendanceModal open={markOpen} onClose={() => setMarkOpen(false)} onSaved={load} />
    </div>
  );
}

export default function AttendancePage() {
  const { role } = useStaffUser();
  const [tab, setTab] = useState("classes");
  // Gym entries and busy hours are business data for the owner; trainers work with class attendance.
  if (role !== "ADMIN") return <ClassAttendance />;
  return (
    <div>
      <div className="mb-5">
        <Tabs
          label="Attendance sections"
          active={tab}
          onChange={setTab}
          items={[
            { id: "classes", label: "Class attendance" },
            { id: "visits", label: "Gym visits" },
          ]}
        />
      </div>
      {tab === "classes" ? <ClassAttendance /> : <GymVisits />}
    </div>
  );
}
