"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { TextField, TextAreaField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { MembershipPlan } from "./types";

export function PlanModal({
  open,
  onClose,
  onSaved,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  plan: MembershipPlan | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [priceCents, setPriceCents] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(plan?.name ?? "");
      setDescription(plan?.description ?? "");
      setDurationDays(String(plan?.durationDays ?? 30));
      setPriceCents(plan?.priceCents != null ? (plan.priceCents / 100).toString() : "");
      setError(null);
    }
  }, [open, plan]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name,
        description: description || undefined,
        durationDays: Number(durationDays),
        priceCents: priceCents ? Math.round(Number(priceCents) * 100) : undefined,
      };
      if (plan) {
        await api.patch(`membership-plans/${plan.id}`, payload);
      } else {
        await api.post("membership-plans", payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this plan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={plan ? "Edit Plan" : "New Membership Plan"}>
      <form onSubmit={onSubmit}>
        {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextAreaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Duration (days)" type="number" min={1} required value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
          <TextField
            label="Price (EUR)"
            type="number"
            step="0.01"
            min={0}
            value={priceCents}
            onChange={(e) => setPriceCents(e.target.value)}
            hint="Leave blank until real Illyrian Gym pricing is confirmed."
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {plan ? "Save changes" : "Create plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
