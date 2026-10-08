"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { Modal } from "../../../components/ui/modal";
import { TextField, SelectField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { MembershipPlan } from "./types";

interface MemberOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function AssignMembershipModal({
  open,
  onClose,
  onCreated,
  plans,
  presetMember,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  plans: MembershipPlan[];
  /** When set, the member is fixed (e.g. opened from a member's own page). */
  presetMember?: { id: string; label: string };
}) {
  const presetMemberId = presetMember?.id;
  const [memberSearch, setMemberSearch] = useState("");
  const debouncedSearch = useDebouncedValue(memberSearch);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [userId, setUserId] = useState("");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("UNPAID");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (open) {
      setPlanId(plans[0]?.id ?? "");
      if (presetMemberId) setUserId(presetMemberId);
    }
  }, [open, plans, presetMemberId]);

  // Suggest an end date from the plan's duration; the admin can still change it.
  useEffect(() => {
    const plan = plans.find((p) => p.id === planId);
    if (plan && startDate) {
      const d = new Date(`${startDate}T00:00:00`);
      d.setDate(d.getDate() + plan.durationDays);
      setEndDate(d.toISOString().slice(0, 10));
    }
  }, [planId, startDate, plans]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) {
      setError("Search for and select a member first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("admin/memberships", { userId, planId, startDate, endDate, paymentStatus });
      onCreated();
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign membership.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setMemberSearch("");
    setMemberOptions([]);
    setUserId(presetMember?.id ?? "");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setPaymentStatus("UNPAID");
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Assign Membership">
      <form onSubmit={onSubmit}>
        {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}

        <TextField
          label="Member"
          required
          disabled={!!presetMember}
          placeholder="Search by name or email..."
          value={presetMember ? presetMember.label : userId ? memberOptions.find((m) => m.id === userId)?.email ?? memberSearch : memberSearch}
          onChange={(e) => {
            setUserId("");
            setMemberSearch(e.target.value);
          }}
        />
        {!presetMember && memberOptions.length > 0 && !userId && (
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

        <SelectField label="Plan" required value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.durationDays}d{p.priceCents != null ? ` · ${(p.priceCents / 100).toFixed(2)} ${p.currency}` : ""})
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Start date" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <TextField label="End date" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <SelectField label="Payment status" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
        </SelectField>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Assign membership
          </Button>
        </div>
      </form>
    </Modal>
  );
}
