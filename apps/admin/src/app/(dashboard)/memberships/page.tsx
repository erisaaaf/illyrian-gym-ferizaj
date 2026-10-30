"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { api, ApiError, qs } from "../../../lib/api";
import { useFetch } from "../../../lib/use-fetch";
import { useStaffUser } from "../../../lib/staff-context";
import { formatDate, formatMoney, fullName, PLAN_PERIOD_LABEL, PLAN_TYPE_LABEL } from "../../../lib/format";
import { PageHeader, FilterSelect } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge, MembershipStatusBadge, PaymentStatusBadge } from "../../../components/ui/badge";
import { DataEmptyState, ErrorState, TableSkeleton } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { Tabs } from "../../../components/ui/tabs";
import { Modal } from "../../../components/ui/modal";
import { TextField, CheckboxField } from "../../../components/ui/field";
import { useToast } from "../../../components/ui/toast";
import { SellMembershipModal } from "../../../components/money/sell-membership-modal";
import { PlanModal, PlanRow } from "./plan-modal";

interface MembershipRow {
  id: string;
  startDate: string;
  endDate: string;
  computedStatus: string;
  daysRemaining: number;
  paymentStatus: string;
  priceCents: number | null;
  alreadyRenewed?: boolean;
  user: { id: string; firstName: string; lastName: string; memberNumber: string | null };
  plan: { id: string; name: string; planType: string };
}
interface Paged<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
interface RequestRow {
  id: string;
  type: "RENEWAL" | "FREEZE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  requestedFrom: string | null;
  requestedUntil: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; memberNumber: string | null };
}
interface Promotion {
  id: string;
  name: string;
  percentOff: number | null;
  amountOffCents: number | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
}

function Packages() {
  const { role } = useStaffUser();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<PlanRow[]>("membership-plans");
  const [edit, setEdit] = useState<PlanRow | null | undefined>(undefined);
  const isAdmin = role === "ADMIN";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-secondary">Packages are what you sell. Prices are only what the owner enters here; a package without a price is never given an invented one.</p>
        {isAdmin && (
          <Button variant="primary" onClick={() => setEdit(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New package
          </Button>
        )}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={6} rows={4} />}
      {data && data.length === 0 && <DataEmptyState title="No packages yet" message="Create the packages you sell (Gym, CrossFit or both; monthly, 3, 6 or 12 months)." />}
      {data && data.length > 0 && (
        <Table caption="Membership packages">
          <Thead>
            <Th>Package</Th>
            <Th>Includes</Th>
            <Th>Period</Th>
            <Th>Length</Th>
            <Th align="right">Price</Th>
            <Th>Status</Th>
            {isAdmin && <Th />}
          </Thead>
          <Tbody>
            {data.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <p className="font-semibold">{p.name}</p>
                  {p.description && <p className="max-w-xs truncate text-xs text-text-muted">{p.description}</p>}
                </Td>
                <Td>{PLAN_TYPE_LABEL[p.planType] ?? p.planType}</Td>
                <Td>{PLAN_PERIOD_LABEL[p.period] ?? p.period}</Td>
                <Td className="tabular">{p.durationDays} days</Td>
                <Td align="right">{p.priceCents === null ? <Badge variant="warning">Not set</Badge> : formatMoney(p.priceCents, p.currency)}</Td>
                <Td>
                  <Badge variant={p.isActive ? "success" : "neutral"}>{p.isActive ? "On sale" : "Retired"}</Badge>
                </Td>
                {isAdmin && (
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEdit(p)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await api.patch(`membership-plans/${p.id}`, { isActive: !p.isActive });
                            reload();
                          } catch (e) {
                            toast.error(e instanceof ApiError ? e.message : "Could not update");
                          }
                        }}
                      >
                        {p.isActive ? "Retire" : "Restore"}
                      </Button>
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <PlanModal open={edit !== undefined} onClose={() => setEdit(undefined)} onSaved={reload} plan={edit ?? null} />
    </div>
  );
}

function MembershipList({ mode }: { mode: "all" | "expiring" }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [renew, setRenew] = useState<MembershipRow | null>(null);
  useEffect(() => setPage(1), [status, mode]);
  const path = mode === "expiring" ? `admin/memberships/expiring${qs({ page, pageSize: 20 })}` : `admin/memberships${qs({ status: status || undefined, page, pageSize: 20 })}`;
  const { data, loading, error, reload } = useFetch<Paged<MembershipRow>>(path);

  return (
    <div>
      {mode === "all" && (
        <div className="mb-4">
          <FilterSelect
            value={status}
            onChange={setStatus}
            label="Status"
            options={[
              { value: "", label: "All statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "EXPIRING_SOON", label: "Expiring soon" },
              { value: "FROZEN", label: "Frozen" },
              { value: "EXPIRED", label: "Expired" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
          />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={6} />}
      {data && data.data.length === 0 && <DataEmptyState title={mode === "expiring" ? "Nothing is ending soon" : "No memberships"} message={mode === "expiring" ? "Memberships ending within the reminder window show up here." : "Sell a membership from a member's profile."} />}
      {data && data.data.length > 0 && (
        <>
          <Table caption="Memberships">
            <Thead>
              <Th>Member</Th>
              <Th>Package</Th>
              <Th>Ends</Th>
              <Th>Status</Th>
              <Th>Payment</Th>
              <Th align="right">Price</Th>
              <Th />
            </Thead>
            <Tbody>
              {data.data.map((m) => (
                <Tr key={m.id} onClick={() => router.push(`/members/${m.user.id}`)}>
                  <Td>
                    <p className="font-semibold">{fullName(m.user)}</p>
                    <p className="text-xs text-text-muted">{m.user.memberNumber}</p>
                  </Td>
                  <Td>{m.plan.name}</Td>
                  <Td>
                    {formatDate(m.endDate)} <span className="text-xs text-text-muted">({m.daysRemaining}d)</span>
                  </Td>
                  <Td>
                    <MembershipStatusBadge status={m.computedStatus} />
                  </Td>
                  <Td>
                    <PaymentStatusBadge status={m.paymentStatus} />
                  </Td>
                  <Td align="right">{formatMoney(m.priceCents)}</Td>
                  <Td>
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                      {m.alreadyRenewed ? <Badge variant="success">Renewed</Badge> : (
                        <Button size="sm" variant="secondary" onClick={() => setRenew(m)}>
                          Renew
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />
        </>
      )}
      {renew && (
        <SellMembershipModal
          open
          onClose={() => setRenew(null)}
          onDone={reload}
          member={{ id: renew.user.id, firstName: renew.user.firstName, lastName: renew.user.lastName, memberNumber: renew.user.memberNumber }}
          renewFrom={{ id: renew.id, planId: renew.plan.id, endDate: renew.endDate }}
        />
      )}
    </div>
  );
}

function Requests() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<Paged<RequestRow>>("admin/membership-requests?status=PENDING&pageSize=50");
  const [renewFor, setRenewFor] = useState<RequestRow | null>(null);

  async function handle(r: RequestRow, action: "approve" | "reject") {
    try {
      await api.post(`admin/membership-requests/${r.id}/${action}`, {});
      toast.success(action === "approve" ? "Request approved" : "Request declined");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update the request");
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-text-secondary">Members can ask for a renewal or a freeze from the app. Nothing changes until you approve it. Online payment is not set up, so a renewal request is settled at the desk.</p>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={4} rows={3} />}
      {data && data.data.length === 0 && <DataEmptyState title="No pending requests" message="New renewal and freeze requests from members appear here." />}
      <ul className="space-y-3">
        {data?.data.map((r) => (
          <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                <Link href={`/members/${r.user.id}`} className="hover:underline">{fullName(r.user)}</Link>{" "}
                <Badge variant={r.type === "RENEWAL" ? "accent" : "frozen"}>{r.type === "RENEWAL" ? "Renewal" : "Freeze"}</Badge>
              </p>
              <p className="text-xs text-text-muted">
                Asked {formatDate(r.createdAt)}
                {r.requestedFrom && r.requestedUntil && ` · ${formatDate(r.requestedFrom)} – ${formatDate(r.requestedUntil)}`}
              </p>
              {r.note && <p className="mt-1 text-sm text-text-secondary">&ldquo;{r.note}&rdquo;</p>}
            </div>
            <div className="flex gap-2">
              {r.type === "RENEWAL" && (
                <Button size="sm" variant="primary" onClick={() => setRenewFor(r)}>
                  Renew now
                </Button>
              )}
              {r.type === "FREEZE" && (
                <Button size="sm" variant="primary" onClick={() => handle(r, "approve")}>
                  Approve
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => handle(r, "reject")}>
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {renewFor && <RenewFromRequest request={renewFor} onClose={() => setRenewFor(null)} onDone={reload} />}
    </div>
  );
}

/** Renewal requests are settled by selling the renewal, then marking the request handled. */
function RenewFromRequest({ request, onClose, onDone }: { request: RequestRow; onClose: () => void; onDone: () => void }) {
  const { data } = useFetch<{ data: Array<{ id: string; endDate: string; plan: { id: string } }> }>(`admin/memberships${qs({ userId: request.user.id, pageSize: 1 })}`);
  const latest = data?.data[0];
  if (!latest) return null;
  return (
    <SellMembershipModal
      open
      onClose={onClose}
      onDone={async () => {
        await api.post(`admin/membership-requests/${request.id}/approve`, {}).catch(() => undefined);
        onDone();
      }}
      member={{ id: request.user.id, firstName: request.user.firstName, lastName: request.user.lastName, memberNumber: request.user.memberNumber }}
      renewFrom={{ id: latest.id, planId: latest.plan.id, endDate: latest.endDate }}
    />
  );
}

function Promotions() {
  const { role } = useStaffUser();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<Promotion[]>("promotions");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const isAdmin = role === "ADMIN";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await api.post("promotions", {
        name,
        ...(percent ? { percentOff: Number(percent) } : {}),
        ...(amount ? { amountOffCents: Math.round(Number(amount.replace(",", ".")) * 100) } : {}),
        isActive: active,
      });
      toast.success("Promotion created");
      setOpen(false);
      setName("");
      setPercent("");
      setAmount("");
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? (err.errors?.validation?.[0] ?? err.message) : "Could not save");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-secondary">Discounts the front desk can apply when selling a membership. Every discount is shown on the invoice.</p>
        {isAdmin && (
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New promotion
          </Button>
        )}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={4} rows={3} />}
      {data && data.length === 0 && <DataEmptyState title="No promotions" message="Create one (for example a percentage for students) and it becomes selectable when selling." />}
      {data && data.length > 0 && (
        <Table caption="Promotions">
          <Thead>
            <Th>Name</Th>
            <Th>Discount</Th>
            <Th>Valid</Th>
            <Th>Status</Th>
            {isAdmin && <Th />}
          </Thead>
          <Tbody>
            {data.map((p) => (
              <Tr key={p.id}>
                <Td className="font-semibold">{p.name}</Td>
                <Td>{p.percentOff ? `${p.percentOff}%` : formatMoney(p.amountOffCents)}</Td>
                <Td className="text-text-secondary">{p.validFrom || p.validTo ? `${formatDate(p.validFrom)} – ${formatDate(p.validTo)}` : "Always"}</Td>
                <Td>
                  <Badge variant={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Off"}</Badge>
                </Td>
                {isAdmin && (
                  <Td>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await api.patch(`promotions/${p.id}`, { isActive: !p.isActive }).catch(() => undefined);
                          reload();
                        }}
                      >
                        {p.isActive ? "Turn off" : "Turn on"}
                      </Button>
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New promotion"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="promo-form">
              Create
            </Button>
          </>
        }
      >
        <form id="promo-form" onSubmit={save}>
          {formError && <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{formError}</p>}
          <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <TextField label="Percent off" type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} />
            <TextField label="Or amount off (EUR)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <CheckboxField label="Active" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </form>
      </Modal>
    </div>
  );
}

function MembershipsView() {
  const params = useSearchParams();
  const router = useRouter();
  const { role } = useStaffUser();
  const [tab, setTab] = useState(params.get("tab") ?? "packages");
  const [sell, setSell] = useState(false);
  const [bump, setBump] = useState(0);

  function change(id: string) {
    setTab(id);
    router.replace(`/memberships?tab=${id}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Memberships"
        description="The packages you sell and every member's membership record. Members themselves are under Members."
        action={
          <Button variant="primary" onClick={() => setSell(true)}>
            Sell membership
          </Button>
        }
      />
      <div className="mb-5">
        <Tabs
          label="Membership sections"
          active={tab}
          onChange={change}
          items={[
            { id: "packages", label: "Packages" },
            { id: "all", label: "All memberships" },
            { id: "expiring", label: "Expiring" },
            { id: "requests", label: "Requests" },
            { id: "promotions", label: "Promotions" },
          ]}
        />
      </div>
      {tab === "packages" && <Packages />}
      {tab === "all" && <MembershipList key={bump} mode="all" />}
      {tab === "expiring" && <MembershipList key={bump} mode="expiring" />}
      {tab === "requests" && <Requests />}
      {tab === "promotions" && <Promotions />}
      <SellMembershipModal open={sell} onClose={() => setSell(false)} onDone={() => setBump((b) => b + 1)} />
      {role === "RECEPTIONIST" && tab === "packages" && <p className="mt-4 text-xs text-text-muted">Only the owner can change packages and prices.</p>}
    </div>
  );
}

export default function MembershipsPage() {
  return (
    <Suspense fallback={<TableSkeleton cols={6} />}>
      <MembershipsView />
    </Suspense>
  );
}
