"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { TextField, SelectField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { CredentialsPanel } from "../../../components/credentials-panel";

interface Plan {
  id: string;
  name: string;
  durationDays: number;
  isActive: boolean;
}

interface CreateMemberResult {
  member: { id: string; firstName: string; lastName: string; email: string };
  temporaryPassword: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function AddMemberModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [assign, setAssign] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("UNPAID");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreateMemberResult | null>(null);
  const [membershipNote, setMembershipNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api
      .get<Plan[]>("membership-plans")
      .then((all) => {
        const active = all.filter((p) => p.isActive);
        setPlans(active);
        setPlanId((current) => current || active[0]?.id || "");
      })
      .catch(() => setPlans([]));
  }, [open]);

  // Suggest an end date from the plan's duration; the admin can still change it.
  useEffect(() => {
    const plan = plans.find((p) => p.id === planId);
    if (plan && startDate) setEndDate(addDays(startDate, plan.durationDays));
  }, [planId, startDate, plans]);

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setAssign(false);
    setStartDate(today());
    setPaymentStatus("UNPAID");
    setError(null);
    setCreated(null);
    setMembershipNote(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<CreateMemberResult>("admin/members", {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
      });
      setCreated(result);

      if (assign) {
        try {
          await api.post("admin/memberships", { userId: result.member.id, planId, startDate, endDate, paymentStatus });
          setMembershipNote("Membership assigned.");
        } catch (err) {
          // The account exists and its credentials are on screen - don't lose them over a membership error.
          setMembershipNote(
            `The account was created, but the membership could not be assigned (${err instanceof ApiError ? err.message : "unknown error"}). Assign it from Memberships.`,
          );
        }
      }
      // Refresh the list only now, so it reflects the membership too.
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create member.");
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <Modal open={open} onClose={handleClose} title="Member created" persistent>
        <CredentialsPanel
          name={`${created.member.firstName} ${created.member.lastName}`}
          email={created.member.email}
          password={created.temporaryPassword}
          audience="member"
        />
        {membershipNote && <p className="mb-4 text-sm text-text-secondary">{membershipNote}</p>}
        <div className="flex justify-end">
          <Button onClick={handleClose}>Done</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Member">
      <form onSubmit={onSubmit}>
        {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <TextField label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <div className="mb-4 rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input type="checkbox" checked={assign} disabled={plans.length === 0} onChange={(e) => setAssign(e.target.checked)} />
            Assign a membership now
          </label>
          {plans.length === 0 && (
            <p className="mt-1 text-xs text-text-muted">No active membership plans yet - create one under Memberships → Plans first.</p>
          )}
          {assign && (
            <div className="mt-3">
              <SelectField label="Plan" required value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.durationDays} days)
                  </option>
                ))}
              </SelectField>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Start date" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <TextField label="End date" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <SelectField label="Payment status" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
              </SelectField>
            </div>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create member
          </Button>
        </div>
      </form>
    </Modal>
  );
}
