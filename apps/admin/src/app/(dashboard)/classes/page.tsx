"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { PageHeader, FilterSelect } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { ClassFormModal } from "./class-form-modal";
import { ParticipantsModal } from "./participants-modal";
import { ClassListItem, PaginatedClasses } from "./types";

export default function ClassesPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedClasses | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassListItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ClassListItem | null>(null);
  const [participantsFor, setParticipantsFor] = useState<ClassListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.get<PaginatedClasses>(`classes${qs({ status: status || undefined, page, pageSize: 20 })}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load classes.");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Classes"
        description="Schedule, capacity, and coach assignment. Booking capacity is enforced server-side."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            New Class
          </Button>
        }
      />

      <div className="mb-4">
        <FilterSelect
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "All statuses" },
            { value: "SCHEDULED", label: "Scheduled" },
            { value: "COMPLETED", label: "Completed" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
        />
      </div>

      {loading && <LoadingState label="Loading classes..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No classes found" message="Create a class to get started." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Class</Th>
              <Th>Coach</Th>
              <Th>When</Th>
              <Th>Capacity</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {result.data.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium">{c.title}</Td>
                  <Td className="text-text-secondary">
                    {c.coach ? `${c.coach.user.firstName} ${c.coach.user.lastName}` : <span className="text-text-muted">Unassigned</span>}
                  </Td>
                  <Td className="text-text-secondary">{new Date(c.startTime).toLocaleString()}</Td>
                  <Td className="text-text-secondary">
                    <button className="underline underline-offset-2 hover:text-text-primary" onClick={() => setParticipantsFor(c)}>
                      {c.bookedCount} / {c.capacity}
                    </button>
                  </Td>
                  <Td>
                    <Badge variant={c.status === "SCHEDULED" ? "success" : c.status === "CANCELLED" ? "danger" : "neutral"}>
                      {c.status}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(c);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      {c.status === "SCHEDULED" && (
                        <Button size="sm" variant="ghost" onClick={() => setCancelTarget(c)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={result.meta.page} totalPages={result.meta.totalPages} onChange={setPage} />
        </>
      )}

      <ClassFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} cls={editing} />
      <ParticipantsModal cls={participantsFor} onClose={() => setParticipantsFor(null)} />
      <ConfirmDialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (cancelTarget) await api.patch(`classes/${cancelTarget.id}/cancel`);
          await load();
        }}
        title="Cancel class"
        message={`Cancel "${cancelTarget?.title}"? All active bookings for it will be cancelled too.`}
        confirmLabel="Cancel class"
        danger
      />
    </div>
  );
}
