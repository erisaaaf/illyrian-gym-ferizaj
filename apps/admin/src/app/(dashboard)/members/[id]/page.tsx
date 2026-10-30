"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Pencil, QrCode, ScanLine, Snowflake, KeyRound, Wallet, RotateCw } from "lucide-react";
import { api, ApiError } from "../../../../lib/api";
import { useFetch } from "../../../../lib/use-fetch";
import { useStaffUser } from "../../../../lib/staff-context";
import { formatDate, formatDateTime, formatMoney, fullName, PAYMENT_METHOD_LABEL, PLAN_PERIOD_LABEL, PLAN_TYPE_LABEL } from "../../../../lib/format";
import { ErrorState, Skeleton } from "../../../../components/ui/states";
import { Badge, MembershipStatusBadge, PaymentStatusBadge, UserStatusBadge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Avatar } from "../../../../components/ui/avatar";
import { Tabs } from "../../../../components/ui/tabs";
import { useToast } from "../../../../components/ui/toast";
import { ResetPasswordModal } from "../../../../components/reset-password-modal";
import { SellMembershipModal } from "../../../../components/money/sell-membership-modal";
import { RecordPaymentModal } from "../../../../components/money/record-payment-modal";
import { CancelMembershipDialog, EditMemberModal, FreezeModal, QrCardModal } from "./member-modals";

interface Membership {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  computedStatus: string;
  daysRemaining: number;
  paymentStatus: string;
  priceCents: number | null;
  discountCents: number | null;
  discountNote: string | null;
  frozenFrom: string | null;
  frozenUntil: string | null;
  totalFrozenDays: number;
  renewedFromId: string | null;
  plan: { id: string; name: string; planType: string; period: string; currency: string };
}
interface Invoice {
  id: string;
  number: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  displayStatus: string;
  issuedAt: string;
  dueDate: string;
  status: string;
}
interface MemberDetail {
  id: string;
  memberNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  mustChangePassword: boolean;
  createdAt: string;
  adminNotes?: string | null;
  assignedCoach: { id: string; user: { firstName: string; lastName: string } } | null;
  memberships: Membership[];
  currentMembership: Membership | null;
  invoices: Invoice[];
  payments: Array<{ id: string; amountCents: number; method: string; receivedAt: string; reference: string | null; invoice: { id: string; number: string } | null }>;
  visits: Array<{ id: string; checkedInAt: string; method: string }>;
  bookings: Array<{ id: string; status: string; class: { id: string; title: string; startTime: string } }>;
  attendance: Array<{ id: string; status: string; class: { title: string; startTime: string } }>;
  workoutResults?: Array<{ id: string; completedAt: string; wod: { title: string } | null; exercise: { name: string } | null }>;
  personalRecords?: Array<{ id: string; value: string; unit: string; achievedAt: string; verificationStatus: string; exercise: { name: string } }>;
  balanceCents: number;
  visitCount: number;
  lastVisitAt: string | null;
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-extrabold tracking-heading">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-text-primary">{children}</dd>
    </div>
  );
}

export default function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role } = useStaffUser();
  const toast = useToast();
  const { data: m, loading, error, reload } = useFetch<MemberDetail>(`admin/members/${id}`);
  const [tab, setTab] = useState("overview");
  const [edit, setEdit] = useState(false);
  const [sell, setSell] = useState(false);
  const [renew, setRenew] = useState<Membership | null>(null);
  const [freeze, setFreeze] = useState<string | null>(null);
  const [cancel, setCancel] = useState<string | null>(null);
  const [pay, setPay] = useState<string | undefined | false>(false);
  const [qr, setQr] = useState(false);
  const [reset, setReset] = useState(false);
  const [status, setStatus] = useState<null | "ACTIVE" | "INACTIVE" | "SUSPENDED">(null);
  const [checkInBusy, setCheckInBusy] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !m) return <Skeleton className="h-64 w-full" />;
  if (!m) return null;

  const cur = m.currentMembership;
  const picked = { id: m.id, firstName: m.firstName, lastName: m.lastName, memberNumber: m.memberNumber };
  const isAdmin = role === "ADMIN";

  async function checkIn() {
    setCheckInBusy(true);
    try {
      const r = await api.post<{ outcome: string; allowed: boolean; message: string }>("admin/check-in", { userId: id });
      (r.allowed ? toast.success : toast.error)(r.message);
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Check-in failed");
    } finally {
      setCheckInBusy(false);
    }
  }

  return (
    <div>
      <Link href="/members" className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Members
      </Link>

      <div className="card mb-5 flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar firstName={m.firstName} lastName={m.lastName} size="lg" />
          <div className="min-w-0">
            <h1 className="heading-display text-2xl">{fullName(m)}</h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              {m.memberNumber && <span className="tabular mr-2 font-bold text-text-primary">{m.memberNumber}</span>}
              {m.email}
              {m.phone && ` · ${m.phone}`}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <UserStatusBadge status={m.status} />
              <MembershipStatusBadge status={cur?.computedStatus ?? "NONE"} />
              {m.mustChangePassword && <Badge variant="info">Not signed in yet</Badge>}
              {m.balanceCents > 0 && <Badge variant="warning">Owes {formatMoney(m.balanceCents)}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={checkIn} loading={checkInBusy}>
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            Check in
          </Button>
          <Button variant="secondary" onClick={() => setSell(true)}>
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Sell membership
          </Button>
          <Button variant="secondary" onClick={() => setPay(undefined)}>
            <Wallet className="h-4 w-4" aria-hidden="true" />
            Record payment
          </Button>
          <Button variant="secondary" onClick={() => setQr(true)}>
            <QrCode className="h-4 w-4" aria-hidden="true" />
            QR card
          </Button>
          <Button variant="ghost" onClick={() => setEdit(true)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <Tabs
          label="Member sections"
          active={tab}
          onChange={setTab}
          items={[
            { id: "overview", label: "Overview" },
            { id: "memberships", label: "Memberships", count: m.memberships.length },
            { id: "money", label: "Payments", count: m.invoices.length },
            { id: "visits", label: "Visits", count: m.visitCount },
            ...(isAdmin ? [{ id: "training", label: "Training" }] : []),
            { id: "account", label: "Account" },
          ]}
        />
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Section
              title="Current membership"
              action={
                cur && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setRenew(cur)}>
                      <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Renew
                    </Button>
                  </div>
                )
              }
            >
              {!cur ? (
                <p className="text-sm text-text-muted">This member has no membership yet. Sell one to give them access.</p>
              ) : (
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Fact label="Package">{cur.plan.name}</Fact>
                  <Fact label="Type">{PLAN_TYPE_LABEL[cur.plan.planType] ?? cur.plan.planType}</Fact>
                  <Fact label="Starts">{formatDate(cur.startDate)}</Fact>
                  <Fact label="Ends">
                    {formatDate(cur.endDate)} <span className="font-medium text-text-muted">({cur.daysRemaining} days)</span>
                  </Fact>
                  <Fact label="Payment">
                    <PaymentStatusBadge status={cur.paymentStatus} />
                  </Fact>
                  <Fact label="Price">{formatMoney(cur.priceCents, cur.plan.currency)}</Fact>
                  <Fact label="Frozen days">{cur.totalFrozenDays}</Fact>
                  {cur.frozenFrom && cur.frozenUntil && (
                    <Fact label="Frozen">
                      {formatDate(cur.frozenFrom)} – {formatDate(cur.frozenUntil)}
                    </Fact>
                  )}
                </dl>
              )}
            </Section>
          </div>
          <Section title="At a glance">
            <dl className="space-y-3">
              <Fact label="Member since">{formatDate(m.createdAt)}</Fact>
              <Fact label="Visits">{m.visitCount}</Fact>
              <Fact label="Last visit">{m.lastVisitAt ? formatDateTime(m.lastVisitAt) : "Never"}</Fact>
              <Fact label="Trainer">{m.assignedCoach ? fullName(m.assignedCoach.user) : "None assigned"}</Fact>
            </dl>
          </Section>
          <div className="lg:col-span-3">
            <Section title="Staff notes" action={<Button size="sm" variant="ghost" onClick={() => setEdit(true)}>Edit</Button>}>
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{m.adminNotes || "No notes. Notes are visible to staff only, never to the member."}</p>
            </Section>
          </div>
        </div>
      )}

      {tab === "memberships" && (
        <Section title="Membership history" action={<Button size="sm" variant="primary" onClick={() => setSell(true)}>Sell membership</Button>}>
          {m.memberships.length === 0 && <p className="text-sm text-text-muted">No memberships yet.</p>}
          <ul className="divide-y divide-border">
            {m.memberships.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {x.plan.name} <span className="font-medium text-text-muted">· {PLAN_PERIOD_LABEL[x.plan.period] ?? x.plan.period}</span>
                    {x.renewedFromId && <span className="ml-2"><Badge variant="info">Renewal</Badge></span>}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatDate(x.startDate)} – {formatDate(x.endDate)} · {formatMoney(x.priceCents, x.plan.currency)}
                    {x.discountCents ? ` (${formatMoney(x.discountCents)} discount${x.discountNote ? `: ${x.discountNote}` : ""})` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PaymentStatusBadge status={x.paymentStatus} />
                  <MembershipStatusBadge status={x.computedStatus} />
                  {x.status === "ACTIVE" && x.computedStatus !== "EXPIRED" && (
                    <>
                      {x.computedStatus === "FROZEN" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await api.post(`admin/memberships/${x.id}/unfreeze`, {});
                              toast.success("Membership unfrozen");
                              reload();
                            } catch (e) {
                              toast.error(e instanceof ApiError ? e.message : "Could not unfreeze");
                            }
                          }}
                        >
                          Unfreeze
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setFreeze(x.id)}>
                          <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
                          Freeze
                        </Button>
                      )}
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => setCancel(x.id)}>
                          Cancel
                        </Button>
                      )}
                    </>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setRenew(x)}>
                    Renew
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tab === "money" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Section title="Invoices" action={<Link href={`/invoices?userId=${m.id}`} className="text-xs font-bold text-accent-text hover:underline">All invoices</Link>}>
            {m.invoices.length === 0 && <p className="text-sm text-text-muted">No invoices.</p>}
            <ul className="divide-y divide-border">
              {m.invoices.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{i.number}</p>
                    <p className="text-xs text-text-muted">
                      {formatDate(i.issuedAt)} · {formatMoney(i.totalCents)} · due {formatDate(i.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {i.balanceCents > 0 && i.status === "OPEN" ? <span className="tabular text-xs font-bold">{formatMoney(i.balanceCents)} left</span> : null}
                    <PaymentStatusBadge status={i.displayStatus} />
                    {i.balanceCents > 0 && i.status === "OPEN" && (
                      <Button size="sm" variant="secondary" onClick={() => setPay(i.id)}>
                        Pay
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Payments received">
            {m.payments.length === 0 && <p className="text-sm text-text-muted">No payments yet.</p>}
            <ul className="divide-y divide-border">
              {m.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{formatMoney(p.amountCents)}</p>
                    <p className="text-xs text-text-muted">
                      {PAYMENT_METHOD_LABEL[p.method] ?? p.method} · {formatDateTime(p.receivedAt)}
                      {p.invoice && ` · ${p.invoice.number}`}
                    </p>
                  </div>
                  {p.reference && <span className="text-xs text-text-muted">{p.reference}</span>}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {tab === "visits" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Section title="Gym visits">
            {m.visits.length === 0 && <p className="text-sm text-text-muted">No visits recorded.</p>}
            <ul className="divide-y divide-border">
              {m.visits.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{formatDateTime(v.checkedInAt)}</span>
                  <Badge variant={v.method === "QR" ? "accent" : "neutral"}>{v.method === "QR" ? "QR scan" : "Front desk"}</Badge>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Classes">
            {m.bookings.length === 0 && m.attendance.length === 0 && <p className="text-sm text-text-muted">No class bookings.</p>}
            <ul className="divide-y divide-border">
              {m.bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    <span className="font-semibold">{b.class.title}</span> <span className="text-xs text-text-muted">{formatDateTime(b.class.startTime)}</span>
                  </span>
                  <Badge variant={b.status === "BOOKED" ? "success" : "neutral"}>{b.status === "WAITLISTED" ? "Waitlist" : "Booked"}</Badge>
                </li>
              ))}
              {m.attendance.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    {a.class.title} <span className="text-xs text-text-muted">{formatDateTime(a.class.startTime)}</span>
                  </span>
                  <Badge variant={a.status === "CHECKED_IN" ? "success" : a.status === "NO_SHOW" ? "danger" : "neutral"}>{a.status.replace("_", " ").toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {tab === "training" && isAdmin && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Section title="Recent workouts">
            {(m.workoutResults ?? []).length === 0 && <p className="text-sm text-text-muted">No workouts logged.</p>}
            <ul className="divide-y divide-border">
              {m.workoutResults?.map((w) => (
                <li key={w.id} className="flex justify-between py-2.5 text-sm">
                  <span className="font-semibold">{w.wod?.title ?? w.exercise?.name ?? "Workout"}</span>
                  <span className="text-xs text-text-muted">{formatDate(w.completedAt)}</span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Personal records">
            {(m.personalRecords ?? []).length === 0 && <p className="text-sm text-text-muted">No records yet.</p>}
            <ul className="divide-y divide-border">
              {m.personalRecords?.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    <span className="font-semibold">{p.exercise.name}</span> <span className="text-xs text-text-muted">{p.value} {p.unit.toLowerCase()} · {formatDate(p.achievedAt)}</span>
                  </span>
                  <Badge variant={p.verificationStatus === "VERIFIED" ? "success" : "neutral"}>{p.verificationStatus.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {tab === "account" && (
        <Section title="Account">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setReset(true)}>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Reset password
            </Button>
            {isAdmin && m.status !== "ACTIVE" && <Button variant="secondary" onClick={() => setStatus("ACTIVE")}>Reactivate</Button>}
            {isAdmin && m.status === "ACTIVE" && <Button variant="secondary" onClick={() => setStatus("INACTIVE")}>Deactivate</Button>}
            {isAdmin && m.status !== "SUSPENDED" && <Button variant="danger" onClick={() => setStatus("SUSPENDED")}>Suspend</Button>}
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Resetting issues a one-time temporary password; the member chooses a new one the next time they sign in. Suspending blocks sign-in and check-in; history is kept.
          </p>
        </Section>
      )}

      <EditMemberModal open={edit} onClose={() => setEdit(false)} onSaved={reload} member={m} />
      <SellMembershipModal open={sell} onClose={() => setSell(false)} onDone={reload} member={picked} />
      {renew && <SellMembershipModal open onClose={() => setRenew(null)} onDone={reload} member={picked} renewFrom={{ id: renew.id, planId: renew.plan.id, endDate: renew.endDate }} />}
      {freeze && <FreezeModal open onClose={() => setFreeze(null)} onDone={reload} membershipId={freeze} />}
      {cancel && <CancelMembershipDialog open onClose={() => setCancel(null)} onDone={reload} membershipId={cancel} />}
      <RecordPaymentModal open={pay !== false} onClose={() => setPay(false)} onDone={reload} member={picked} invoiceId={pay || undefined} />
      <QrCardModal open={qr} onClose={() => setQr(false)} memberId={m.id} canReissue />
      <ResetPasswordModal open={reset} onClose={() => setReset(false)} name={fullName(m)} path={`admin/members/${m.id}/reset-password`} audience="member" />
      <ConfirmDialog
        open={status !== null}
        onClose={() => setStatus(null)}
        onConfirm={async () => {
          await api.patch(`admin/members/${id}/status`, { status });
          toast.success("Account updated");
          reload();
        }}
        title={`Set account to ${status?.toLowerCase() ?? ""}`}
        message={status === "SUSPENDED" ? "The member is blocked from signing in, booking and checking in until reactivated. Their history is kept." : status === "INACTIVE" ? "The account is marked inactive. History is kept." : "The account is reactivated."}
        danger={status === "SUSPENDED"}
      />
    </div>
  );
}
