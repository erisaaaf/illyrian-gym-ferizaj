"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { ChallengeFormModal } from "./challenge-form-modal";
import { LeaderboardModal } from "./leaderboard-modal";
import { ChallengeItem, PaginatedChallenges } from "./types";

const STATUS_VARIANT = { UPCOMING: "info", ACTIVE: "success", COMPLETED: "neutral", CANCELLED: "danger" } as const;

export default function ChallengesPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedChallenges | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChallengeItem | null>(null);
  const [leaderboardFor, setLeaderboardFor] = useState<ChallengeItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.get<PaginatedChallenges>(`challenges${qs({ page })}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load challenges.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(c: ChallengeItem, status: string) {
    await api.patch(`challenges/${c.id}`, { status });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Challenges"
        description="Time-boxed participation challenges with a points leaderboard."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            New Challenge
          </Button>
        }
      />

      {loading && <LoadingState label="Loading challenges..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No challenges yet" message="Create a challenge to get started." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Title</Th>
              <Th>Dates</Th>
              <Th>Participants</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {result.data.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium">{c.title}</Td>
                  <Td className="text-text-secondary">
                    {new Date(c.startDate).toLocaleDateString()} – {new Date(c.endDate).toLocaleDateString()}
                  </Td>
                  <Td>
                    <button className="underline underline-offset-2 hover:text-text-primary" onClick={() => setLeaderboardFor(c)}>
                      {c._count.participants}
                    </button>
                  </Td>
                  <Td>
                    <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
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
                      {c.status !== "ACTIVE" && c.status !== "CANCELLED" && (
                        <Button size="sm" variant="secondary" onClick={() => setStatus(c, "ACTIVE")}>
                          Activate
                        </Button>
                      )}
                      {c.status === "ACTIVE" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(c, "CANCELLED")}>
                          Deactivate
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

      <ChallengeFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} challenge={editing} />
      <LeaderboardModal challenge={leaderboardFor} onClose={() => setLeaderboardFor(null)} />
    </div>
  );
}
