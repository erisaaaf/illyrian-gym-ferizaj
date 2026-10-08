"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { PageHeader, FilterSelect } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge, formatStatus } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string };
}

interface PaginatedNotifications {
  data: NotificationItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface SystemInfo {
  integrations: { pushNotifications: boolean };
}

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedNotifications | null>(null);
  const [pushConfigured, setPushConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.get<PaginatedNotifications>(`admin/notifications${qs({ unreadOnly: unreadOnly || undefined, page })}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get<SystemInfo>("admin/settings/system")
      .then((s) => setPushConfigured(s.integrations.pushNotifications))
      .catch(() => setPushConfigured(null));
  }, []);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Activity log of in-app notifications the system has created for members: booking confirmations, waitlist promotions, new PRs."
      />

      {pushConfigured === false && (
        <p className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          Push delivery isn&apos;t configured (no Firebase credentials). Notifications below are stored and appear inside
          the app, but nothing is pushed to phones yet.
        </p>
      )}

      <div className="mb-4">
        <FilterSelect
          value={unreadOnly}
          onChange={(v) => {
            setUnreadOnly(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "All" },
            { value: "true", label: "Unread only" },
          ]}
        />
      </div>

      {loading && <LoadingState label="Loading notifications..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No notifications yet" message="They appear here as members book classes and set PRs." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Recipient</Th>
              <Th>Type</Th>
              <Th>Message</Th>
              <Th>Sent</Th>
              <Th>Read</Th>
            </Thead>
            <Tbody>
              {result.data.map((n) => (
                <Tr key={n.id}>
                  <Td className="font-medium">
                    {n.user.firstName} {n.user.lastName}
                  </Td>
                  <Td>
                    <Badge>{formatStatus(n.type)}</Badge>
                  </Td>
                  <Td className="text-text-secondary">
                    <span className="text-text-primary">{n.title}</span> — {n.body}
                  </Td>
                  <Td className="text-text-secondary">{new Date(n.createdAt).toLocaleString()}</Td>
                  <Td>{n.readAt ? <Badge variant="success">Read</Badge> : <Badge variant="neutral">Unread</Badge>}</Td>
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
