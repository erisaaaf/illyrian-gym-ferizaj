"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { TextField, TextAreaField, SelectField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { formatStatus } from "../../../components/ui/badge";
import { CATEGORIES, DIFFICULTIES, ExerciseItem, MEASUREMENT_TYPES, PR_TYPES } from "./types";

function toList(text: string): string[] {
  return text.split(",").map((s) => s.trim()).filter(Boolean);
}

export function ExerciseFormModal({
  open,
  onClose,
  onSaved,
  exercise,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  exercise: ExerciseItem | null;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [equipment, setEquipment] = useState("");
  const [difficulty, setDifficulty] = useState("INTERMEDIATE");
  const [measurementType, setMeasurementType] = useState(MEASUREMENT_TYPES[0]);
  const [prType, setPrType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(exercise?.name ?? "");
      setCategory(exercise?.category ?? CATEGORIES[0]);
      setDescription(exercise?.description ?? "");
      setInstructions(exercise?.instructions ?? "");
      setEquipment((exercise?.equipment ?? []).join(", "));
      setDifficulty(exercise?.difficulty ?? "INTERMEDIATE");
      setMeasurementType(exercise?.measurementType ?? MEASUREMENT_TYPES[0]);
      setPrType(exercise?.prType ?? "");
      setError(null);
    }
  }, [open, exercise]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name,
        category,
        description: description || undefined,
        instructions: instructions || undefined,
        equipment: toList(equipment),
        difficulty,
        measurementType,
        prType: prType || undefined,
      };
      if (exercise) {
        await api.patch(`exercises/${exercise.id}`, payload);
      } else {
        await api.post("exercises", payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this exercise.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={exercise ? "Edit Exercise" : "Add Exercise"}>
      <form onSubmit={onSubmit}>
        {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {formatStatus(c)}
              </option>
            ))}
          </SelectField>
          <SelectField label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {formatStatus(d)}
              </option>
            ))}
          </SelectField>
        </div>
        <TextAreaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <TextAreaField label="Instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        <TextField label="Equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} hint="Comma-separated, e.g. Barbell, Rack" />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Measurement type" required value={measurementType} onChange={(e) => setMeasurementType(e.target.value)}>
            {MEASUREMENT_TYPES.map((m) => (
              <option key={m} value={m}>
                {formatStatus(m)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="PR type"
            value={prType}
            onChange={(e) => setPrType(e.target.value)}
          >
            <option value="">Not PR-tracked</option>
            {PR_TYPES.map((p) => (
              <option key={p} value={p}>
                {formatStatus(p)}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {exercise ? "Save changes" : "Create exercise"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
