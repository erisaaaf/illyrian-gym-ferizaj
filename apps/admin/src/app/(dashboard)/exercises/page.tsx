"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { PageHeader, SearchInput, FilterSelect } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge, formatStatus } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { ExerciseFormModal } from "./exercise-form-modal";
import { CATEGORIES, ExerciseItem, PaginatedExercises } from "./types";

export default function ExercisesPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedExercises | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExerciseItem | null>(null);
  const [statusTarget, setStatusTarget] = useState<ExerciseItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(
        await api.get<PaginatedExercises>(
          `exercises${qs({ search: debouncedSearch, category: category || undefined, page, pageSize: 20 })}`,
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load exercises.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Exercises"
        description="The exercise library. PR type connects an exercise to the personal-record engine."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add Exercise
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        <FilterSelect
          value={category}
          onChange={(v) => { setCategory(v); setPage(1); }}
          options={[{ value: "", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: formatStatus(c) }))]}
        />
      </div>

      {loading && <LoadingState label="Loading exercises..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No exercises found" message="Add an exercise to get started." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th>Measurement</Th>
              <Th>PR type</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {result.data.map((ex) => (
                <Tr key={ex.id}>
                  <Td className="font-medium">{ex.name}</Td>
                  <Td className="text-text-secondary">{formatStatus(ex.category)}</Td>
                  <Td className="text-text-secondary">{formatStatus(ex.measurementType)}</Td>
                  <Td className="text-text-secondary">{ex.prType ? formatStatus(ex.prType) : <span className="text-text-muted">—</span>}</Td>
                  <Td>
                    <Badge variant={ex.active ? "success" : "neutral"}>{ex.active ? "Active" : "Inactive"}</Badge>
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(ex);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatusTarget(ex)}>
                        {ex.active ? "Deactivate" : "Reactivate"}
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

      <ExerciseFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} exercise={editing} />

      <ConfirmDialog
        open={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        onConfirm={async () => {
          if (statusTarget) {
            await api.patch(`exercises/${statusTarget.id}/${statusTarget.active ? "deactivate" : "reactivate"}`);
          }
          await load();
        }}
        title={statusTarget?.active ? "Deactivate exercise" : "Reactivate exercise"}
        message={
          statusTarget?.active
            ? `"${statusTarget?.name}" will no longer appear when building new WODs. Existing history is preserved.`
            : `"${statusTarget?.name}" will be available again when building WODs.`
        }
        confirmLabel={statusTarget?.active ? "Deactivate" : "Reactivate"}
        danger={!!statusTarget?.active}
      />
    </div>
  );
}
