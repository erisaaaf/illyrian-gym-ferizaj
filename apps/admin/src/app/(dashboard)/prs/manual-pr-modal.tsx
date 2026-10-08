"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { Modal } from "../../../components/ui/modal";
import { TextField, SelectField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";

interface MemberOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ExerciseOption {
  id: string;
  name: string;
  prType: string | null;
}

export function ManualPrModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [memberSearch, setMemberSearch] = useState("");
  const debouncedSearch = useDebouncedValue(memberSearch);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [userId, setUserId] = useState("");
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [exerciseId, setExerciseId] = useState("");
  const [value, setValue] = useState("");
  const [achievedAt, setAchievedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      api
        .get<{ data: ExerciseOption[] }>("exercises?pageSize=200&active=true")
        .then((r) => setExercises(r.data.filter((e) => e.prType)))
        .catch(() => setExercises([]));
    }
  }, [open]);

  useEffect(() => {
    if (!open || debouncedSearch.length < 2) {
      setMemberOptions([]);
      return;
    }
    api
      .get<{ data: MemberOption[] }>(`admin/members${qs({ search: debouncedSearch, pageSize: 10 })}`)
      .then((r) => setMemberOptions(r.data))
      .catch(() => setMemberOptions([]));
  }, [open, debouncedSearch]);

  function handleClose() {
    setMemberSearch("");
    setMemberOptions([]);
    setUserId("");
    setExerciseId("");
    setValue("");
    setReason("");
    setError(null);
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId || !exerciseId) {
      setError("Select a member and an exercise.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("admin/prs/manual", { userId, exerciseId, value: Number(value), achievedAt, reason });
      onSaved();
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this record.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Manual PR">
      <form onSubmit={onSubmit}>
        <p className="mb-3 text-sm text-text-secondary">
          For a member who has no digital record yet (e.g. bringing in paper records). If a record already exists for
          this member/exercise, use Correct on it instead.
        </p>
        {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}

        <TextField
          label="Member"
          required
          placeholder="Search by name or email..."
          value={userId ? memberOptions.find((m) => m.id === userId)?.email ?? memberSearch : memberSearch}
          onChange={(e) => {
            setUserId("");
            setMemberSearch(e.target.value);
          }}
        />
        {memberOptions.length > 0 && !userId && (
          <div className="-mt-3 mb-4 rounded-md border border-border bg-surface-elevated">
            {memberOptions.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => {
                  setUserId(m.id);
                  setMemberOptions([]);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface"
              >
                {m.firstName} {m.lastName} <span className="text-text-muted">· {m.email}</span>
              </button>
            ))}
          </div>
        )}

        <SelectField label="Exercise" required value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
          <option value="">Select an exercise</option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Value" type="number" step="0.01" required value={value} onChange={(e) => setValue(e.target.value)} />
          <TextField label="Achieved on" type="date" required value={achievedAt} onChange={(e) => setAchievedAt(e.target.value)} />
        </div>
        <TextField label="Note" required value={reason} onChange={(e) => setReason(e.target.value)} hint="Required - shown in the audit log." />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Add record
          </Button>
        </div>
      </form>
    </Modal>
  );
}
