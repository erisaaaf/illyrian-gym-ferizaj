"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { PageHeader, SearchInput, FilterSelect } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { MembershipStatusBadge, Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { AssignMembershipModal } from "./assign-membership-modal";
import { PlanModal } from "./plan-modal";
import { MembershipListItem, MembershipPlan, PaginatedMemberships } from "./types";

export default function MembershipsPage() {
  const [tab, setTab] = useState<"memberships" | "plans">("memberships");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);

  const loadPlans = useCallback(async () => {
    setPlans(await api.get<MembershipPlan[]>("membership-plans"));
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  return (
    <div>
      <PageHeader
        title="Memberships"
        description="Commercial membership records and plan catalog - not member accounts (see Members)."
      />

      <SummaryCards />

      <div className="mb-4 flex gap-1 border-b border-border">
        <TabButton active={tab === "memberships"} onClick={() => setTab("memberships")}>
          Memberships
        </TabButton>
        <TabButton active={tab === "plans"} onClick={() => setTab("plans")}>
          Plans
        </TabButton>
      </div>

      {tab === "memberships" ? <MembershipsTab plans={plans} /> : <PlansTab plans={plans} onChanged={loadPlans} />}
    </div>
  );
}

function SummaryCards() {
  const [overview, setOverview] = useState<{ memberships: { expiringSoon: number; expired: number } } | null>(null);

  useEffect(() => {
    api
      .get<{ memberships: { expiringSoon: number; expired: number } }>("admin/analytics/overview")
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
      <StatCard label="Expiring within 7 days" value={overview?.memberships.expiringSoon} variant="warning" />
      <StatCard label="Expired (active plan, past due)" value={overview?.memberships.expired} variant="danger" />
    </div>
  );
}

function StatCard({ label, value, variant }: { label: string; value?: number; variant: "warning" | "danger" }) {
  const color = variant === "warning" ? "text-warning" : "text-danger";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${value ? color : "text-text-muted"}`}>{value ?? "—"}</p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active ? "border-accent text-text-primary" : "border-transparent text-text-muted hover:text-text-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function MembershipsTab({ plans }: { plans: MembershipPlan[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedMemberships | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<MembershipListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.get<PaginatedMemberships>(`admin/memberships${qs({ search, status: status || undefined, page })}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load memberships.");
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search member..." />
          <FilterSelect
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[
              { value: "", label: "All statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "EXPIRING_SOON", label: "Expiring soon" },
              { value: "EXPIRED", label: "Expired" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
          />
        </div>
        <Button onClick={() => setAssignOpen(true)} disabled={plans.length === 0}>
          Assign Membership
        </Button>
      </div>
      {plans.length === 0 && <p className="mb-3 text-xs text-warning">Create a membership plan first, under the Plans tab.</p>}

      {loading && <LoadingState label="Loading memberships..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && result && result.data.length === 0 && (
        <DataEmptyState title="No memberships found" message="Assign a membership to a member to get started." />
      )}
      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <Thead>
              <Th>Member</Th>
              <Th>Plan</Th>
              <Th>Start</Th>
              <Th>End</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {result.data.map((m) => (
                <Tr key={m.id}>
                  <Td className="font-medium">
                    {m.user.firstName} {m.user.lastName}
                  </Td>
                  <Td className="text-text-secondary">{m.plan.name}</Td>
                  <Td className="text-text-secondary">{new Date(m.startDate).toLocaleDateString()}</Td>
                  <Td className="text-text-secondary">{new Date(m.endDate).toLocaleDateString()}</Td>
                  <Td>
                    <Badge variant={m.paymentStatus === "PAID" ? "success" : m.paymentStatus === "PARTIAL" ? "warning" : "neutral"}>
                      {m.paymentStatus}
                    </Badge>
                  </Td>
                  <Td>
                    <MembershipStatusBadge status={m.computedStatus} />
                  </Td>
                  <Td>
                    {m.computedStatus !== "CANCELLED" && (
                      <Button size="sm" variant="ghost" onClick={() => setCancelTarget(m)}>
                        Cancel
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={result.meta.page} totalPages={result.meta.totalPages} onChange={setPage} />
        </>
      )}

      <AssignMembershipModal open={assignOpen} onClose={() => setAssignOpen(false)} onCreated={load} plans={plans} />
      <ConfirmDialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (cancelTarget) await api.patch(`admin/memberships/${cancelTarget.id}/cancel`);
          await load();
        }}
        title="Cancel membership"
        message={`Cancel ${cancelTarget?.user.firstName} ${cancelTarget?.user.lastName}'s ${cancelTarget?.plan.name} membership? This cannot be undone from here.`}
        confirmLabel="Cancel membership"
        danger
      />
    </div>
  );
}

function PlansTab({ plans, onChanged }: { plans: MembershipPlan[]; onChanged: () => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          New Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <DataEmptyState
          title="No membership plans yet"
          message="Create a plan (name + duration). Pricing is optional until real Illyrian Gym pricing is confirmed."
        />
      ) : (
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>Duration</Th>
            <Th>Price</Th>
            <Th>Status</Th>
            <Th></Th>
          </Thead>
          <Tbody>
            {plans.map((p) => (
              <Tr key={p.id}>
                <Td className="font-medium">{p.name}</Td>
                <Td className="text-text-secondary">{p.durationDays} days</Td>
                <Td className="text-text-secondary">
                  {p.priceCents != null ? `${(p.priceCents / 100).toFixed(2)} ${p.currency}` : "Not set"}
                </Td>
                <Td>
                  <Badge variant={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                </Td>
                <Td>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(p);
                      setModalOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <PlanModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={onChanged} plan={editing} />
    </div>
  );
}
