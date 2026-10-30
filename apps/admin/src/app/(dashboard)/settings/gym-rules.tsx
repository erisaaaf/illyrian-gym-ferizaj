"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { useFetch } from "../../../lib/use-fetch";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { CheckboxField, TextField } from "../../../components/ui/field";
import { useToast } from "../../../components/ui/toast";

interface Rules {
  expiringSoonDays: number;
  atRiskShortDays: number;
  atRiskLongDays: number;
  duplicateScanMinutes: number;
  blockUnpaidCheckIn: boolean;
  maxFreezeDays: number | null;
  invoiceDueDays: number;
  configured?: boolean;
}

/**
 * Operating rules. The starting values are sensible defaults, not the gym's decisions: anything the gym has not
 * confirmed is labelled so, and the freeze limit stays empty (no limit) until the owner sets the real policy.
 */
export function GymRules() {
  const toast = useToast();
  const { data, reload } = useFetch<Rules>("admin/settings/gym");
  const [form, setForm] = useState<Record<string, string>>({});
  const [block, setBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      expiringSoonDays: String(data.expiringSoonDays),
      atRiskShortDays: String(data.atRiskShortDays),
      atRiskLongDays: String(data.atRiskLongDays),
      duplicateScanMinutes: String(data.duplicateScanMinutes),
      maxFreezeDays: data.maxFreezeDays === null ? "" : String(data.maxFreezeDays),
      invoiceDueDays: String(data.invoiceDueDays),
    });
    setBlock(data.blockUnpaidCheckIn);
  }, [data]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch("admin/settings/gym", {
        expiringSoonDays: Number(form.expiringSoonDays),
        atRiskShortDays: Number(form.atRiskShortDays),
        atRiskLongDays: Number(form.atRiskLongDays),
        duplicateScanMinutes: Number(form.duplicateScanMinutes),
        invoiceDueDays: Number(form.invoiceDueDays),
        maxFreezeDays: form.maxFreezeDays === "" ? null : Number(form.maxFreezeDays),
        blockUnpaidCheckIn: block,
      });
      toast.success("Rules saved. They apply immediately.");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.validation?.[0] ?? err.message) : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5" aria-labelledby="rules-title">
      <h2 id="rules-title" className="font-heading text-base font-extrabold tracking-heading">
        Gym rules
      </h2>
      <p className="mb-4 mt-1 text-xs text-text-muted">These control reminders, reports and check-in. Values marked &ldquo;to confirm&rdquo; are starting points: set what the gym actually decides.</p>
      {error && (
        <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField label="Membership is “expiring soon” within (days)" type="number" min={1} max={90} required value={form.expiringSoonDays ?? ""} onChange={set("expiringSoonDays")} />
          <TextField label="Invoice due after (days)" type="number" min={0} max={90} required value={form.invoiceDueDays ?? ""} onChange={set("invoiceDueDays")} hint="0 = due the day it is issued." />
          <TextField label="Member “not visiting” after (days)" type="number" min={1} max={365} required value={form.atRiskShortDays ?? ""} onChange={set("atRiskShortDays")} />
          <TextField label="Member “at serious risk” after (days)" type="number" min={1} max={365} required value={form.atRiskLongDays ?? ""} onChange={set("atRiskLongDays")} />
          <TextField label="Ignore a second scan within (minutes)" type="number" min={0} max={240} required value={form.duplicateScanMinutes ?? ""} onChange={set("duplicateScanMinutes")} hint={<ToConfirm />} />
          <TextField label="Longest freeze allowed (days)" type="number" min={1} max={730} value={form.maxFreezeDays ?? ""} onChange={set("maxFreezeDays")} hint={<ToConfirm text="Empty means no limit: the freeze policy has not been set." />} />
        </div>
        <CheckboxField label="Refuse entry when the membership is unpaid" checked={block} onChange={(e) => setBlock(e.target.checked)} hint="Off by default. Turn on only if the gym decides unpaid members may not enter." />
        <div className="mt-2 flex justify-end">
          <Button variant="primary" type="submit" loading={busy}>
            Save rules
          </Button>
        </div>
      </form>
    </section>
  );
}

function ToConfirm({ text = "Default value, to confirm with the gym." }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Badge variant="warning">To confirm</Badge>
      {text}
    </span>
  );
}
