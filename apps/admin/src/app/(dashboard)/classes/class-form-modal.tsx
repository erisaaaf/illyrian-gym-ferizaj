"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { TextField, TextAreaField, SelectField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { ClassListItem } from "./types";

interface CoachOption {
  id: string;
  user: { firstName: string; lastName: string };
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ClassFormModal({
  open,
  onClose,
  onSaved,
  cls,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  cls: ClassListItem | null;
}) {
  const [title, setTitle] = useState("CrossFit Group Class");
  const [description, setDescription] = useState("");
  const [coachId, setCoachId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState("15");
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      api
        .get<{ data: CoachOption[] }>("coaches?pageSize=100")
        .then((r) => setCoaches(r.data))
        .catch(() => setCoaches([]));

      if (cls) {
        setTitle(cls.title);
        setDescription(cls.description ?? "");
        setCoachId(cls.coach?.id ?? "");
        setStartTime(toLocalInput(cls.startTime));
        setEndTime(toLocalInput(cls.endTime));
        setCapacity(String(cls.capacity));
      } else {
        setTitle("CrossFit Group Class");
        setDescription("");
        setCoachId("");
        setStartTime("");
        setEndTime("");
        setCapacity("15");
      }
      setError(null);
    }
  }, [open, cls]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        title,
        description: description || undefined,
        coachId: coachId || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        capacity: Number(capacity),
      };
      if (cls) {
        await api.patch(`classes/${cls.id}`, payload);
      } else {
        await api.post("classes", payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this class.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={cls ? "Edit Class" : "New Class"}>
      <form onSubmit={onSubmit}>
        {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextAreaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <SelectField label="Coach" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
          <option value="">Unassigned</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.user.firstName} {c.user.lastName}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Start" type="datetime-local" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <TextField label="End" type="datetime-local" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <TextField label="Capacity" type="number" min={1} required value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {cls ? "Save changes" : "Create class"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
