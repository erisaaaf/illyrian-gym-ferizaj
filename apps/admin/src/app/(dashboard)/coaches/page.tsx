"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { PageHeader, SearchInput } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge, UserStatusBadge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { ResetPasswordModal } from "../../../components/reset-password-modal";
import { CoachFormModal } from "./coach-form-modal";
import { CoachListItem, PaginatedCoaches } from "./types";

export default function CoachesPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedCoaches | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CoachListItem | null>(null);
  const [statusTarget, setStatusTarget] = useState<CoachListItem | null>(null);
  const [resetTarget, setResetTarget] = useState<CoachListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.get<PaginatedCoaches>(`coaches${qs({ search: debouncedSearch, page })}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load coaches.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Coaches"
        description="Trainer accounts and profiles. Creating a trainer here creates both their login and coach profile together."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add Trainer
          </Button>
        }
      />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name or email..."
        />
      </div>

      {loading && <LoadingState label="Loading coaches..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No coaches found" message="Add a trainer to get started." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Specialties</Th>
              <Th>Status</Th>
              <Th>Account</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {result.data.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium">
                    {c.user.firstName} {c.user.lastName}
                  </Td>
                  <Td className="text-text-secondary">{c.user.email}</Td>
                  <Td className="text-text-secondary">
                    {c.specialties.length > 0 ? c.specialties.join(", ") : <span className="text-text-muted">—</span>}
                  </Td>
                  <Td>
                    <Badge variant={c.isActive ? "success" : "neutral"}>{c.isActive ? "Active" : "Inactive"}</Badge>
                  </Td>
                  <Td>
                    <UserStatusBadge status={c.user.status} />
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
                      <Button size="sm" variant="ghost" onClick={() => setResetTarget(c)}>
                        Reset password
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatusTarget(c)}>
                        {c.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={result.meta.page} totalPages={result.meta.totalPages} onChange={setPage} />
        </>
      )}

      <CoachFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} coach={editing} />

      <ResetPasswordModal
        open={resetTarget !== null}
        onClose={() => setResetTarget(null)}
        name={resetTarget ? `${resetTarget.user.firstName} ${resetTarget.user.lastName}` : ""}
        path={resetTarget ? `coaches/${resetTarget.id}/reset-password` : ""}
        audience="trainer"
      />

      <ConfirmDialog
        open={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        onConfirm={async () => {
          if (statusTarget) {
            await api.patch(`coaches/${statusTarget.id}/${statusTarget.isActive ? "deactivate" : "reactivate"}`);
          }
          await load();
        }}
        title={statusTarget?.isActive ? "Deactivate trainer" : "Reactivate trainer"}
        message={
          statusTarget?.isActive
            ? `${statusTarget?.user.firstName} ${statusTarget?.user.lastName} will no longer be able to log in or be assigned to new classes. Existing classes and history are preserved.`
            : `${statusTarget?.user.firstName} ${statusTarget?.user.lastName} will be able to log in again.`
        }
        confirmLabel={statusTarget?.isActive ? "Deactivate" : "Reactivate"}
        danger={!!statusTarget?.isActive}
      />
    </div>
  );
}
