"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../../../lib/api";
import { PageHeader } from "../../../../components/ui/page-header";
import { TextField, TextAreaField, SelectField } from "../../../../components/ui/field";
import { Button } from "../../../../components/ui/button";
import { LoadingState } from "../../../../components/ui/states";
import { formatStatus } from "../../../../components/ui/badge";
import { SECTION_TYPES, WOD_TYPES, WodDetail, WodSectionItem } from "../types";

interface ExerciseOption {
  id: string;
  name: string;
}

export default function WodEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState(WOD_TYPES[0]);
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<WodSectionItem[]>([]);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: ExerciseOption[] }>("exercises?pageSize=200&active=true")
      .then((r) => setExercises(r.data))
      .catch(() => setExercises([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api
      .get<WodDetail>(`wods/${id}`)
      .then((w) => {
        setTitle(w.title);
        setDate(new Date(w.date).toISOString().slice(0, 10));
        setType(w.type);
        setDescription(w.description ?? "");
        setSections(w.sections);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load this WOD."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function addSection() {
    setSections((s) => [...s, { type: "METCON", order: s.length, notes: "", exercises: [] }]);
  }

  function removeSection(index: number) {
    setSections((s) => s.filter((_, i) => i !== index));
  }

  function updateSection(index: number, patch: Partial<WodSectionItem>) {
    setSections((s) => s.map((sec, i) => (i === index ? { ...sec, ...patch } : sec)));
  }

  function addExercise(sectionIndex: number) {
    if (exercises.length === 0) return;
    setSections((s) =>
      s.map((sec, i) =>
        i === sectionIndex
          ? { ...sec, exercises: [...sec.exercises, { exerciseId: exercises[0].id, order: sec.exercises.length }] }
          : sec,
      ),
    );
  }

  function removeExercise(sectionIndex: number, exIndex: number) {
    setSections((s) =>
      s.map((sec, i) => (i === sectionIndex ? { ...sec, exercises: sec.exercises.filter((_, j) => j !== exIndex) } : sec)),
    );
  }

  function updateExercise(sectionIndex: number, exIndex: number, patch: Partial<WodSectionItem["exercises"][number]>) {
    setSections((s) =>
      s.map((sec, i) =>
        i === sectionIndex
          ? { ...sec, exercises: sec.exercises.map((ex, j) => (j === exIndex ? { ...ex, ...patch } : ex)) }
          : sec,
      ),
    );
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        date,
        type,
        description: description || undefined,
        sections: sections.map((sec, i) => ({
          type: sec.type,
          order: i,
          notes: sec.notes || undefined,
          exercises: sec.exercises.map((ex, j) => ({
            exerciseId: ex.exerciseId,
            order: j,
            sets: numOrUndefined(ex.sets),
            reps: numOrUndefined(ex.reps),
            weightKg: numOrUndefined(ex.weightKg),
            durationSeconds: numOrUndefined(ex.durationSeconds),
            restSeconds: numOrUndefined(ex.restSeconds),
            rounds: numOrUndefined(ex.rounds),
            timeCapSeconds: numOrUndefined(ex.timeCapSeconds),
            instructions: ex.instructions || undefined,
            scalingNotes: ex.scalingNotes || undefined,
          })),
        })),
      };
      if (isNew) {
        const created = await api.post<WodDetail>("wods", payload);
        router.push(`/wods/${created.id}`);
      } else {
        await api.patch(`wods/${id}`, payload);
        router.push("/wods");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this WOD.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading WOD..." />;

  return (
    <div>
      <PageHeader title={isNew ? "Create WOD" : "Edit WOD"} description="Warm-up, strength, metcon, cooldown - add sections and exercises below." />

      {error && <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="mb-6 rounded-lg border border-border bg-surface p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {WOD_TYPES.map((t) => (
              <option key={t} value={t}>
                {formatStatus(t)}
              </option>
            ))}
          </SelectField>
        </div>
        <TextAreaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="mb-4 flex flex-col gap-4">
        {sections.map((sec, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <SelectField label="Section" value={sec.type} onChange={(e) => updateSection(i, { type: e.target.value as WodSectionItem["type"] })}>
                  {SECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatStatus(t)}
                    </option>
                  ))}
                </SelectField>
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeSection(i)}>
                Remove section
              </Button>
            </div>
            <TextField label="Notes" value={sec.notes ?? ""} onChange={(e) => updateSection(i, { notes: e.target.value })} />

            <div className="flex flex-col gap-3">
              {sec.exercises.map((ex, j) => (
                <div key={j} className="rounded-md border border-border/60 bg-surface-elevated p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <SelectField label="Exercise" value={ex.exerciseId} onChange={(e) => updateExercise(i, j, { exerciseId: e.target.value })}>
                      {exercises.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </SelectField>
                    <Button size="sm" variant="ghost" onClick={() => removeExercise(i, j)}>
                      Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    <NumField label="Sets" value={ex.sets} onChange={(v) => updateExercise(i, j, { sets: v })} />
                    <NumField label="Reps" value={ex.reps} onChange={(v) => updateExercise(i, j, { reps: v })} />
                    <NumField label="Weight (kg)" value={ex.weightKg} onChange={(v) => updateExercise(i, j, { weightKg: v })} />
                    <NumField label="Duration (s)" value={ex.durationSeconds} onChange={(v) => updateExercise(i, j, { durationSeconds: v })} />
                    <NumField label="Rest (s)" value={ex.restSeconds} onChange={(v) => updateExercise(i, j, { restSeconds: v })} />
                    <NumField label="Rounds" value={ex.rounds} onChange={(v) => updateExercise(i, j, { rounds: v })} />
                  </div>
                  <TextField
                    label="Scaling options"
                    value={ex.scalingNotes ?? ""}
                    onChange={(e) => updateExercise(i, j, { scalingNotes: e.target.value })}
                  />
                </div>
              ))}
              <Button size="sm" variant="secondary" onClick={() => addExercise(i)} disabled={exercises.length === 0}>
                + Add exercise
              </Button>
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addSection}>
          + Add section
        </Button>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push("/wods")}>
          Cancel
        </Button>
        <Button onClick={onSave} loading={saving} disabled={!title || sections.length === 0}>
          {isNew ? "Create WOD" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function numOrUndefined(v: number | null | undefined): number | undefined {
  return v === null || v === undefined || Number.isNaN(v) ? undefined : v;
}

function NumField({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <TextField
      label={label}
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );
}
