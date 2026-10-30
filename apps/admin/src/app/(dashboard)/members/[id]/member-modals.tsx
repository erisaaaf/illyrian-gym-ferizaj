"use client";

import { FormEvent, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, RefreshCw } from "lucide-react";
import { api, ApiError } from "../../../../lib/api";
import { useStaffUser } from "../../../../lib/staff-context";
import { Modal } from "../../../../components/ui/modal";
import { SelectField, TextAreaField, TextField } from "../../../../components/ui/field";
import { Button } from "../../../../components/ui/button";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { useToast } from "../../../../components/ui/toast";

export function EditMemberModal({
  open,
  onClose,
  onSaved,
  member,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  member: { id: string; firstName: string; lastName: string; phone: string | null; adminNotes?: string | null; assignedCoach: { id: string } | null };
}) {
  const { role } = useStaffUser();
  const toast = useToast();
  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [notes, setNotes] = useState(member.adminNotes ?? "");
  const [coachId, setCoachId] = useState(member.assignedCoach?.id ?? "");
  const [trainers, setTrainers] = useState<Array<{ id: string; isActive: boolean; user: { firstName: string; lastName: string } }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName(member.firstName);
    setLastName(member.lastName);
    setPhone(member.phone ?? "");
    setNotes(member.adminNotes ?? "");
    setCoachId(member.assignedCoach?.id ?? "");
    setError(null);
    if (role === "ADMIN") {
      api
        .get<{ data: typeof trainers }>("coaches?pageSize=100")
        .then((r) => setTrainers(r.data.filter((t) => t.isActive)))
        .catch(() => setTrainers([]));
    }
  }, [open, member, role]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch(`admin/members/${member.id}`, {
        firstName,
        lastName,
        phone,
        adminNotes: notes,
        ...(role === "ADMIN" ? { assignedCoachId: coachId || null } : {}),
      });
      toast.success("Member updated");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit member"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="edit-member" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-member" onSubmit={submit}>
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <TextField label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <TextField label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <TextField label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {role === "ADMIN" && (
          <SelectField label="Assigned trainer" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
            <option value="">No trainer</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.user.firstName} {t.user.lastName}
              </option>
            ))}
          </SelectField>
        )}
        <TextAreaField label="Internal notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} hint="Visible to staff only." />
      </form>
    </Modal>
  );
}

export function FreezeModal({ open, onClose, onDone, membershipId }: { open: boolean; onClose: () => void; onDone: () => void; membershipId: string }) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`admin/memberships/${membershipId}/freeze`, {
        from: new Date(`${from}T00:00:00`).toISOString(),
        until: new Date(`${until}T23:59:59`).toISOString(),
        reason,
      });
      toast.success("Membership frozen. Its end date moved by the frozen days.");
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not freeze the membership.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Freeze membership"
      description="Check-in is blocked while frozen, and the end date moves later by the number of frozen days."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="freeze" loading={busy}>
            Freeze
          </Button>
        </>
      }
    >
      <form id="freeze" onSubmit={submit}>
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <TextField label="From" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="Until" type="date" required value={until} min={from} onChange={(e) => setUntil(e.target.value)} />
        </div>
        <TextAreaField label="Reason" required rows={2} minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} hint="Recorded in the audit log. Any limit on freezing is set by the gym's rules." />
      </form>
    </Modal>
  );
}

export function CancelMembershipDialog({ open, onClose, onDone, membershipId }: { open: boolean; onClose: () => void; onDone: () => void; membershipId: string }) {
  const toast = useToast();
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Cancel this membership?"
      message="The member loses access immediately. Payments already received stay in the books; refunds are handled separately by the owner."
      confirmLabel="Cancel membership"
      danger
      onConfirm={async () => {
        await api.patch(`admin/memberships/${membershipId}/cancel`);
        toast.success("Membership cancelled");
        onDone();
      }}
    />
  );
}

/** The member's QR card for printing or showing at the desk. Reissuing invalidates the old one. */
export function QrCardModal({ open, onClose, memberId, canReissue }: { open: boolean; onClose: () => void; memberId: string; canReissue: boolean }) {
  const toast = useToast();
  const [card, setCard] = useState<{ memberNumber: string | null; name: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCard(null);
    setError(null);
    api
      .get<NonNullable<typeof card>>(`admin/members/${memberId}/qr`)
      .then(setCard)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the QR card."));
  }, [open, memberId]);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Member QR card"
        width="max-w-sm"
        footer={
          <>
            {canReissue && (
              <Button variant="ghost" onClick={() => setConfirm(true)}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reissue
              </Button>
            )}
            <Button variant="secondary" onClick={() => window.print()} disabled={!card}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print
            </Button>
          </>
        }
      >
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {card && (
          <div className="print-area flex flex-col items-center rounded-xl bg-ink p-6 text-center text-mint">
            <p className="font-heading text-sm font-extrabold tracking-heading">Illyrian Gym &amp; CrossFit</p>
            <div className="my-4 rounded-lg bg-white p-3">
              <QRCodeSVG value={card.token} size={176} level="M" aria-label={`QR code for ${card.name}`} />
            </div>
            <p className="font-heading text-lg font-extrabold tracking-heading">{card.name}</p>
            <p className="tabular text-sm text-lime">{card.memberNumber}</p>
          </div>
        )}
        <p className="mt-3 text-xs text-text-muted">The code only identifies the member. Entry is always checked against their live membership.</p>
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reissue QR code?"
        message="The old code stops working at once (use this if a phone was lost or a screenshot was shared). The member's app shows the new code automatically."
        confirmLabel="Reissue"
        onConfirm={async () => {
          await api.post(`admin/members/${memberId}/qr/reissue`);
          toast.success("New QR code issued");
          setCard(await api.get(`admin/members/${memberId}/qr`));
        }}
      />
    </>
  );
}
