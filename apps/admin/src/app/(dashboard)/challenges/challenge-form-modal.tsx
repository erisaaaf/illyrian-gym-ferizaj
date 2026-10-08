"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { TextField, TextAreaField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { ChallengeItem } from "./types";

export function ChallengeFormModal({
  open,
  onClose,
  onSaved,
  challenge,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  challenge: ChallengeItem | null;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [pointsLabel, setPointsLabel] = useState("points");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(challenge?.title ?? "");
      setDescription(challenge?.description ?? "");
      setRules(challenge?.rules ?? "");
      setPointsLabel(challenge?.pointsLabel ?? "points");
      setStartDate(challenge ? new Date(challenge.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setEndDate(challenge ? new Date(challenge.endDate).toISOString().slice(0, 10) : "");
      setError(null);
    }
  }, [open, challenge]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = { title, description: description || undefined, rules: rules || undefined, pointsLabel, startDate, endDate };
      if (challenge) {
        await api.patch(`challenges/${challenge.id}`, payload);
      } else {
        await api.post("challenges", payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this challenge.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={challenge ? "Edit Challenge" : "New Challenge"}>
      <form onSubmit={onSubmit}>
        {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextAreaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <TextAreaField label="Rules" value={rules} onChange={(e) => setRules(e.target.value)} />
        <TextField label="Points label" value={pointsLabel} onChange={(e) => setPointsLabel(e.target.value)} hint="e.g. points, reps, miles" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Start date" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <TextField label="End date" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {challenge ? "Save changes" : "Create challenge"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
