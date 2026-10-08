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

interface ClassOption {
  id: string;
  title: string;
  startTime: string;
}

export function MarkAttendanceModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [memberSearch, setMemberSearch] = useState("");
  const debouncedSearch = useDebouncedValue(memberSearch);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [userId, setUserId] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("CHECKED_IN");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      api
        .get<{ data: ClassOption[] }>("classes?pageSize=50")
        .then((r) => setClasses(r.data))
        .catch(() => setClasses([]));
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
    setClassId("");
    setStatus("CHECKED_IN");
    setError(null);
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId || !classId) {
      setError("Select a member and a class.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("admin/attendance", { userId, classId, status });
      onSaved();
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record attendance.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Mark Attendance">
      <form onSubmit={onSubmit}>
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

        <SelectField label="Class" required value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Select a class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} — {new Date(c.startTime).toLocaleString()}
            </option>
          ))}
        </SelectField>

        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="CHECKED_IN">Checked in</option>
          <option value="NO_SHOW">No show</option>
          <option value="CANCELLED">Cancelled</option>
        </SelectField>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
