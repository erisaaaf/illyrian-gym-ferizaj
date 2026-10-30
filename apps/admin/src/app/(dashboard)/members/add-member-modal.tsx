"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { useStaffUser } from "../../../lib/staff-context";
import { Modal } from "../../../components/ui/modal";
import { TextField, SelectField, TextAreaField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { CredentialsPanel } from "../../../components/credentials-panel";

interface CreateMemberResult {
  member: { id: string; firstName: string; lastName: string; email: string; memberNumber: string | null };
  temporaryPassword: string;
}
interface Trainer {
  id: string;
  isActive: boolean;
  user: { firstName: string; lastName: string };
}

/**
 * Creates the member's account (the member number is assigned automatically). Memberships are sold afterwards
 * from the member's profile, so the invoice and payment are created in one place.
 */
export function AddMemberModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { role } = useStaffUser();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [coachId, setCoachId] = useState("");
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreateMemberResult | null>(null);

  useEffect(() => {
    if (!open || role !== "ADMIN") return;
    api
      .get<{ data: Trainer[] }>("coaches?pageSize=100")
      .then((r) => setTrainers(r.data.filter((t) => t.isActive)))
      .catch(() => setTrainers([]));
  }, [open, role]);

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setCoachId("");
    setError(null);
    setCreated(null);
  }

  function close() {
    const id = created?.member.id;
    reset();
    onClose();
    if (id) onCreated(id);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setCreated(
        await api.post<CreateMemberResult>("admin/members", {
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          adminNotes: notes || undefined,
          assignedCoachId: coachId || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.validation?.[0] ?? err.message) : "Could not create the member.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Modal open={open} onClose={close} title={`Member ${created.member.memberNumber ?? ""} created`} persistent footer={<Button variant="primary" onClick={close}>Open profile</Button>}>
        <CredentialsPanel name={`${created.member.firstName} ${created.member.lastName}`} email={created.member.email} password={created.temporaryPassword} audience="member" />
        <p className="text-xs text-text-muted">The member is asked to choose their own password the first time they sign in. Next step: sell them a membership from their profile.</p>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add a member"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="add-member" loading={busy}>
            Create member
          </Button>
        </>
      }
    >
      <form id="add-member" onSubmit={submit}>
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <TextField label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" />
          <TextField label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
        </div>
        <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" hint="Used to sign in to the member app." />
        <TextField label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {role === "ADMIN" && (
          <SelectField label="Assigned trainer" value={coachId} onChange={(e) => setCoachId(e.target.value)} hint="Optional. The trainer sees this member as a client.">
            <option value="">No trainer</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.user.firstName} {t.user.lastName}
              </option>
            ))}
          </SelectField>
        )}
        <TextAreaField label="Internal notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} hint="Visible to staff only, never to the member." />
      </form>
    </Modal>
  );
}
