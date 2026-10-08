"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { TextField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { PrItem } from "./types";

export function CorrectPrModal({ pr, onClose, onSaved }: { pr: PrItem | null; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [achievedAt, setAchievedAt] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pr) {
      setValue(pr.value);
      setAchievedAt(new Date(pr.achievedAt).toISOString().slice(0, 10));
      setReason("");
      setError(null);
    }
  }, [pr]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pr) return;
    setLoading(true);
    setError(null);
    try {
      await api.patch(`admin/prs/${pr.id}/correct`, { value: Number(value), achievedAt, reason });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not correct this record.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={pr !== null} onClose={onClose} title={pr ? `Correct ${pr.exercise.name}` : "Correct PR"}>
      <form onSubmit={onSubmit}>
        <p className="mb-3 text-sm text-text-secondary">
          This directly overwrites the current record and is logged to the audit trail with your reason. The previous
          value is preserved in history, never deleted.
        </p>
        {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <TextField label={`New value (${pr?.unit.toLowerCase()})`} type="number" step="0.01" required value={value} onChange={(e) => setValue(e.target.value)} />
          <TextField label="Achieved on" type="date" required value={achievedAt} onChange={(e) => setAchievedAt(e.target.value)} />
        </div>
        <TextField label="Reason for correction" required value={reason} onChange={(e) => setReason(e.target.value)} hint="Required - shown in the audit log." />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save correction
          </Button>
        </div>
      </form>
    </Modal>
  );
}
