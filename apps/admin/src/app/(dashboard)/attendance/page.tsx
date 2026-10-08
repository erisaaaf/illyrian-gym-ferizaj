"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { MarkAttendanceModal } from "./mark-attendance-modal";

interface AttendanceItem {
  id: string;
  status: "CHECKED_IN" | "NO_SHOW" | "CANCELLED";
  checkedInAt: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string };
  class: { id: string; title: string; startTime: string };
}

interface PaginatedAttendance {
  data: AttendanceItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function AttendancePage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markOpen, setMarkOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.get<PaginatedAttendance>(`admin/attendance${qs({ page })}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load attendance.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Who showed up, who didn't. Every manual change is recorded in the audit log."
        action={<Button onClick={() => setMarkOpen(true)}>Mark Attendance</Button>}
      />

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
              <Th>Recorded</Th>
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
                  <Td className="text-text-secondary">{new Date(a.createdAt).toLocaleString()}</Td>
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
