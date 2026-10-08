"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { PageHeader, SearchInput, FilterSelect } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { PrHistoryModal } from "./pr-history-modal";
import { CorrectPrModal } from "./correct-pr-modal";
import { ManualPrModal } from "./manual-pr-modal";
import { PaginatedPrs, PrItem } from "./types";

export default function PrsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [verification, setVerification] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedPrs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<PrItem | null>(null);
  const [correcting, setCorrecting] = useState<PrItem | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(
        await api.get<PaginatedPrs>(
          `admin/prs${qs({ search: debouncedSearch, verificationStatus: verification || undefined, page })}`,
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load personal records.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, verification, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function verify(pr: PrItem) {
    await api.patch(`admin/prs/${pr.id}/verify`);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="PR Management"
        description="Every member's current best per exercise. Corrections and manual entries are always audit-logged."
        action={<Button onClick={() => setManualOpen(true)}>Add Manual PR</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search member or exercise..." />
        <FilterSelect
          value={verification}
          onChange={(v) => { setVerification(v); setPage(1); }}
          options={[
            { value: "", label: "All" },
            { value: "VERIFIED", label: "Verified" },
            { value: "UNVERIFIED", label: "Unverified" },
          ]}
        />
      </div>

      {loading && <LoadingState label="Loading personal records..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No personal records yet" message="PRs are detected automatically as members log workouts." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Member</Th>
              <Th>Exercise</Th>
              <Th>Value</Th>
              <Th>Achieved</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {result.data.map((pr) => (
                <Tr key={pr.id}>
                  <Td className="font-medium">
                    {pr.user.firstName} {pr.user.lastName}
                  </Td>
                  <Td className="text-text-secondary">{pr.exercise.name}</Td>
                  <Td className="text-text-secondary">
                    {pr.value} {pr.unit.toLowerCase()}
                  </Td>
                  <Td className="text-text-secondary">{new Date(pr.achievedAt).toLocaleDateString()}</Td>
                  <Td>
                    <Badge variant={pr.verificationStatus === "VERIFIED" ? "info" : "neutral"}>{pr.verificationStatus}</Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setHistoryFor(pr)}>
                        History
                      </Button>
                      {pr.verificationStatus === "UNVERIFIED" && (
                        <Button size="sm" variant="secondary" onClick={() => verify(pr)}>
                          Verify
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setCorrecting(pr)}>
                        Correct
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

      <PrHistoryModal pr={historyFor} onClose={() => setHistoryFor(null)} />
      <CorrectPrModal pr={correcting} onClose={() => setCorrecting(null)} onSaved={load} />
      <ManualPrModal open={manualOpen} onClose={() => setManualOpen(false)} onSaved={load} />
    </div>
  );
}
