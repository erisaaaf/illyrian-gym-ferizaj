"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { TextField, TextAreaField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { CredentialsPanel } from "../../../components/credentials-panel";
import { CoachListItem } from "./types";

function toList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CoachFormModal({
  open,
  onClose,
  onSaved,
  coach,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  coach: CoachListItem | null;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [certifications, setCertifications] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFirstName(coach?.user.firstName ?? "");
      setLastName(coach?.user.lastName ?? "");
      setEmail(coach?.user.email ?? "");
      setPhone(coach?.user.phone ?? "");
      setBio(coach?.bio ?? "");
      setCertifications((coach?.certifications ?? []).join(", "));
      setSpecialties((coach?.specialties ?? []).join(", "));
      setError(null);
      setTempPassword(null);
    }
  }, [open, coach]);

  function handleClose() {
    setTempPassword(null);
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (coach) {
        await api.patch(`coaches/${coach.id}`, {
          firstName,
          lastName,
          phone: phone || undefined,
          bio: bio || undefined,
          certifications: toList(certifications),
          specialties: toList(specialties),
        });
        onSaved();
        handleClose();
      } else {
        const result = await api.post<{ temporaryPassword: string }>("coaches", {
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          bio: bio || undefined,
          certifications: toList(certifications),
          specialties: toList(specialties),
        });
        setTempPassword(result.temporaryPassword);
        onSaved();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this trainer.");
    } finally {
      setLoading(false);
    }
  }

  if (tempPassword) {
    return (
      <Modal open={open} onClose={handleClose} title="Trainer created" persistent>
        <CredentialsPanel name={`${firstName} ${lastName}`} email={email} password={tempPassword} audience="trainer" />
        <div className="flex justify-end">
          <Button onClick={handleClose}>Done</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title={coach ? "Edit Trainer" : "Add Trainer"}>
      <form onSubmit={onSubmit}>
        {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <TextField label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <TextField label="Email" type="email" required disabled={!!coach} value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <TextAreaField label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} />
        <TextField
          label="Certifications"
          value={certifications}
          onChange={(e) => setCertifications(e.target.value)}
          hint="Comma-separated. Enter this trainer's real certifications - none are pre-filled."
        />
        <TextField
          label="Specialties"
          value={specialties}
          onChange={(e) => setSpecialties(e.target.value)}
          hint="Comma-separated, e.g. Weightlifting, Mobility"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {coach ? "Save changes" : "Create trainer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
