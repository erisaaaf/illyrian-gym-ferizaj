"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../../lib/api";
import { Modal } from "../../../../components/ui/modal";
import { TextField } from "../../../../components/ui/field";
import { Button } from "../../../../components/ui/button";

export function EditMemberModal({
  open,
  onClose,
  onSaved,
  member,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  member: { id: string; firstName: string; lastName: string; email: string; phone: string | null };
}) {
  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFirstName(member.firstName);
      setLastName(member.lastName);
      setPhone(member.phone ?? "");
      setError(null);
    }
  }, [open, member]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.patch(`admin/members/${member.id}`, { firstName, lastName, phone: phone || undefined });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Member">
      <form onSubmit={onSubmit}>
        {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <TextField label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <TextField label="Email" disabled value={member.email} readOnly hint="Email is the login and can't be changed here." />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
