"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../../../lib/api";
import { LoadingState, ErrorState } from "../../../../components/ui/states";
import { MembershipStatusBadge, UserStatusBadge, Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { ResetPasswordModal } from "../../../../components/reset-password-modal";
import { AssignMembershipModal } from "../../memberships/assign-membership-modal";
import { MembershipPlan } from "../../memberships/types";
import { EditMemberModal } from "./edit-member-modal";

interface MemberDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  emailVerifiedAt: string | null;
  createdAt: string;
  memberships: Array<{
    id: string;
    startDate: string;
    endDate: string;
    paymentStatus: string;
    computedStatus: string;
    plan: { name: string };
  }>;
  bookings: Array<{ id: string; status: string; class: { id: string; title: string; startTime: string } }>;
  attendance: Array<{ id: string; status: string; checkedInAt: string | null; class: { title: string; startTime: string } }>;
  workoutResults: Array<{ id: string; completedAt: string; wod: { title: string } | null; exercise: { name: string } | null }>;
  personalRecords: Array<{
    id: string;
    value: string;
    unit: string;
    achievedAt: string;
    verificationStatus: string;
    exercise: { id: string; name: string };
  }>;
}

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusDialog, setStatusDialog] = useState<null | "ACTIVE" | "INACTIVE" | "SUSPENDED">(null);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMember(await api.get<MemberDetail>(`admin/members/${id}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load this member.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get<MembershipPlan[]>("membership-plans")
      .then((all) => setPlans(all.filter((p) => p.isActive)))
      .catch(() => setPlans([]));
  }, []);

  async function applyStatus() {
    if (!statusDialog) return;
    await api.patch(`admin/members/${id}/status`, { status: statusDialog });
    await load();
  }

  if (loading) return <LoadingState label="Loading member..." />;
  if (error || !member) return <ErrorState message={error ?? "Member not found."} onRetry={load} />;

  return (
    <div>
      <Link href="/members" className="mb-4 inline-block text-xs text-text-secondary hover:text-text-primary">
        ← Back to Members
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-surface p-5">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            {member.firstName} {member.lastName}
          </h1>
          <p className="text-sm text-text-secondary">{member.email}</p>
          {member.phone && <p className="text-sm text-text-secondary">{member.phone}</p>}
          <div className="mt-2 flex items-center gap-2">
            <UserStatusBadge status={member.status} />
            {!member.emailVerifiedAt && <Badge variant="warning">Email unverified</Badge>}
            <span className="text-xs text-text-muted">Joined {new Date(member.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button variant="secondary" onClick={() => setAssignOpen(true)} disabled={plans.length === 0}>
            Assign membership
          </Button>
          <Button variant="secondary" onClick={() => setResetOpen(true)}>
            Reset password
          </Button>
          {member.status !== "ACTIVE" && (
            <Button variant="secondary" onClick={() => setStatusDialog("ACTIVE")}>
              Reactivate
            </Button>
          )}
          {member.status !== "SUSPENDED" && (
            <Button variant="danger" onClick={() => setStatusDialog("SUSPENDED")}>
              Suspend
            </Button>
          )}
          {member.status !== "INACTIVE" && (
            <Button variant="ghost" onClick={() => setStatusDialog("INACTIVE")}>
              Deactivate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Memberships">
          {member.memberships.length === 0 && <Empty text="No membership on file yet." />}
          {member.memberships.map((m) => (
            <Row key={m.id}>
              <div>
                <p className="text-sm text-text-primary">{m.plan.name}</p>
                <p className="text-xs text-text-muted">
                  {new Date(m.startDate).toLocaleDateString()} – {new Date(m.endDate).toLocaleDateString()}
                </p>
              </div>
              <MembershipStatusBadge status={m.computedStatus} />
            </Row>
          ))}
        </Section>

        <Section title="Upcoming bookings">
          {member.bookings.length === 0 && <Empty text="No upcoming bookings." />}
          {member.bookings.map((b) => (
            <Row key={b.id}>
              <div>
                <p className="text-sm text-text-primary">{b.class.title}</p>
                <p className="text-xs text-text-muted">{new Date(b.class.startTime).toLocaleString()}</p>
              </div>
              <Badge variant={b.status === "BOOKED" ? "success" : "neutral"}>{b.status}</Badge>
            </Row>
          ))}
        </Section>

        <Section title="Recent attendance">
          {member.attendance.length === 0 && <Empty text="No attendance recorded yet." />}
          {member.attendance.map((a) => (
            <Row key={a.id}>
              <div>
                <p className="text-sm text-text-primary">{a.class.title}</p>
                <p className="text-xs text-text-muted">{new Date(a.class.startTime).toLocaleString()}</p>
              </div>
              <Badge variant={a.status === "CHECKED_IN" ? "success" : a.status === "NO_SHOW" ? "danger" : "neutral"}>
                {a.status.replace("_", " ")}
              </Badge>
            </Row>
          ))}
        </Section>

        <Section title="Recent workouts">
          {member.workoutResults.length === 0 && <Empty text="No workouts recorded yet." />}
          {member.workoutResults.map((w) => (
            <Row key={w.id}>
              <div>
                <p className="text-sm text-text-primary">{w.wod?.title ?? w.exercise?.name ?? "Workout"}</p>
                <p className="text-xs text-text-muted">{new Date(w.completedAt).toLocaleDateString()}</p>
              </div>
            </Row>
          ))}
        </Section>

        <Section title="Personal records" full>
          {member.personalRecords.length === 0 && <Empty text="No personal records yet." />}
          {member.personalRecords.map((pr) => (
            <Row key={pr.id}>
              <div>
                <p className="text-sm text-text-primary">{pr.exercise.name}</p>
                <p className="text-xs text-text-muted">
                  {pr.value} {pr.unit.toLowerCase()} · {new Date(pr.achievedAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={pr.verificationStatus === "VERIFIED" ? "info" : "neutral"}>{pr.verificationStatus}</Badge>
            </Row>
          ))}
        </Section>
      </div>

      <EditMemberModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} member={member} />
      <AssignMembershipModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onCreated={load}
        plans={plans}
        presetMember={{ id: member.id, label: `${member.firstName} ${member.lastName} · ${member.email}` }}
      />
      <ResetPasswordModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        name={`${member.firstName} ${member.lastName}`}
        path={`admin/members/${member.id}/reset-password`}
        audience="member"
      />
      <ConfirmDialog
        open={statusDialog !== null}
        onClose={() => setStatusDialog(null)}
        onConfirm={applyStatus}
        title={`Set account to ${statusDialog ?? ""}`}
        message={
          statusDialog === "SUSPENDED"
            ? "The member will be blocked from booking classes and logging in until reactivated. Their training history is preserved."
            : statusDialog === "INACTIVE"
              ? "The member's account will be marked inactive. Their training history is preserved."
              : "The member's account will be reactivated."
        }
        confirmLabel="Confirm"
        danger={statusDialog === "SUSPENDED"}
      />
    </div>
  );
}

function Section({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${full ? "lg:col-span-2" : ""}`}>
      <h2 className="mb-3 text-sm font-semibold text-text-primary">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-surface-elevated px-3 py-2">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-text-muted">{text}</p>;
}
