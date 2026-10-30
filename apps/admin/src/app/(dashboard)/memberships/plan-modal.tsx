"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { parseMoneyToCents, PLAN_PERIOD_LABEL, PLAN_TYPE_LABEL } from "../../../lib/format";
import { Modal } from "../../../components/ui/modal";
import { TextField, TextAreaField, SelectField, CheckboxField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../components/ui/toast";
import type { Plan } from "../../../components/money/sell-membership-modal";

export type PlanRow = Plan & { description: string | null };

// A package's usual length per period. Only a starting suggestion: the owner can set any number of days.
const SUGGESTED_DAYS: Record<string, number> = { MONTHLY: 30, QUARTERLY: 90, SEMIANNUAL: 180, ANNUAL: 365 };

export function PlanModal({ open, onClose, onSaved, plan }: { open: boolean; onClose: () => void; onSaved: () => void; plan: PlanRow | null }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [planType, setPlanType] = useState("COMBINED");
  const [period, setPeriod] = useState("MONTHLY");
  const [durationDays, setDurationDays] = useState("30");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(plan?.name ?? "");
    setDescription(plan?.description ?? "");
    setPlanType(plan?.planType ?? "COMBINED");
    setPeriod(plan?.period ?? "MONTHLY");
    setDurationDays(String(plan?.durationDays ?? 30));
    setPrice(plan?.priceCents != null ? (plan.priceCents / 100).toFixed(2) : "");
    setIsActive(plan?.isActive ?? true);
    setError(null);
  }, [open, plan]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = price.trim() ? parseMoneyToCents(price) : undefined;
    if (cents === null) return setError("Enter the price like 25 or 25.50, or leave it empty until it is confirmed.");
    setBusy(true);
    setError(null);
    try {
      const payload = { name, description: description || undefined, planType, period, durationDays: Number(durationDays), priceCents: cents, isActive };
      if (plan) await api.patch(`membership-plans/${plan.id}`, payload);
      else await api.post("membership-plans", payload);
      toast.success(plan ? "Package updated" : "Package created");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.validation?.[0] ?? err.message) : "Could not save this package.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan ? "Edit package" : "New package"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="plan-form" loading={busy}>
            {plan ? "Save changes" : "Create package"}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit}>
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <SelectField label="What it includes" value={planType} onChange={(e) => setPlanType(e.target.value)}>
            {Object.entries(PLAN_TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Billing period"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              if (SUGGESTED_DAYS[e.target.value]) setDurationDays(String(SUGGESTED_DAYS[e.target.value]));
            }}
          >
            {Object.entries(PLAN_PERIOD_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectField>
          <TextField label="Length (days)" type="number" min={1} required value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
          <TextField label="Price (EUR)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} hint="Leave empty until the real price is confirmed. Nothing is invoiced for a package without a price." />
        </div>
        <TextAreaField label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <CheckboxField label="Available to sell" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} hint="Turn off to retire a package without losing members' history." />
      </form>
    </Modal>
  );
}
