"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, qs } from "../../../lib/api";
import { PageHeader, FilterSelect } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { PaginatedWods } from "./types";

export default function WodsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedWods | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.get<PaginatedWods>(`wods${qs({ status: status || undefined, page })}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load WODs.");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function setWodStatus(id: string, action: "publish" | "unpublish" | "archive") {
    await api.patch(`wods/${id}/${action}`);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="WODs"
        description="Workout of the day programming. Members only ever see published WODs."
        action={<Button onClick={() => router.push("/wods/new")}>Create WOD</Button>}
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
            { value: "DRAFT", label: "Draft" },
            { value: "PUBLISHED", label: "Published" },
            { value: "ARCHIVED", label: "Archived" },
          ]}
        />
      </div>

      {loading && <LoadingState label="Loading WODs..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No WODs found" message="Create a WOD to get started." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Title</Th>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {result.data.map((w) => (
                <Tr key={w.id}>
                  <Td className="font-medium">
                    <button className="hover:underline" onClick={() => router.push(`/wods/${w.id}`)}>
                      {w.title}
                    </button>
                  </Td>
                  <Td className="text-text-secondary">{new Date(w.date).toLocaleDateString()}</Td>
                  <Td className="text-text-secondary">{w.type.replace("_", " ")}</Td>
                  <Td>
                    <Badge variant={w.status === "PUBLISHED" ? "success" : w.status === "ARCHIVED" ? "neutral" : "warning"}>
                      {w.status}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => router.push(`/wods/${w.id}`)}>
                        Edit
                      </Button>
                      {w.status !== "PUBLISHED" && (
                        <Button size="sm" variant="secondary" onClick={() => setWodStatus(w.id, "publish")}>
                          Publish
                        </Button>
                      )}
                      {w.status === "PUBLISHED" && (
                        <Button size="sm" variant="ghost" onClick={() => setWodStatus(w.id, "unpublish")}>
                          Unpublish
                        </Button>
                      )}
                      {w.status !== "ARCHIVED" && (
                        <Button size="sm" variant="ghost" onClick={() => setWodStatus(w.id, "archive")}>
                          Archive
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
    </div>
  );
}
