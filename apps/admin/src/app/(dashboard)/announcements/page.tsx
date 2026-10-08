"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { AnnouncementFormModal } from "./announcement-form-modal";
import { AnnouncementItem, PaginatedAnnouncements } from "./types";

const PRIORITY_VARIANT = { NORMAL: "neutral", IMPORTANT: "warning", URGENT: "danger" } as const;

export default function AnnouncementsPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedAnnouncements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.get<PaginatedAnnouncements>(`announcements${qs({ page })}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load announcements.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(a: AnnouncementItem, action: "publish" | "unpublish" | "archive") {
    await api.patch(`announcements/${a.id}/${action}`);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Published announcements are visible to members on their Home screen."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            New Announcement
          </Button>
        }
      />

      {loading && <LoadingState label="Loading announcements..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No announcements yet" message="Create an announcement to get started." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Title</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {result.data.map((a) => (
                <Tr key={a.id}>
                  <Td className="font-medium">{a.title}</Td>
                  <Td>
                    <Badge variant={PRIORITY_VARIANT[a.priority]}>{a.priority}</Badge>
                  </Td>
                  <Td>
                    <Badge variant={a.status === "PUBLISHED" ? "success" : a.status === "ARCHIVED" ? "neutral" : "warning"}>
                      {a.status}
                    </Badge>
                  </Td>
                  <Td className="text-text-secondary">{new Date(a.createdAt).toLocaleDateString()}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(a);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      {a.status !== "PUBLISHED" && (
                        <Button size="sm" variant="secondary" onClick={() => setStatus(a, "publish")}>
                          Publish
                        </Button>
                      )}
                      {a.status === "PUBLISHED" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(a, "unpublish")}>
                          Unpublish
                        </Button>
                      )}
                      {a.status !== "ARCHIVED" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(a, "archive")}>
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

      <AnnouncementFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} announcement={editing} />
    </div>
  );
}
