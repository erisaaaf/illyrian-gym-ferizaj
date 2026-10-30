"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { formatMoney, parseMoneyToCents, PLAN_PERIOD_LABEL, PLAN_TYPE_LABEL } from "../../lib/format";
import { Modal } from "../ui/modal";
import { SelectField, TextField, TextAreaField } from "../ui/field";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import { MemberPicker, PickedMember } from "./member-picker";

export interface Plan {
  id: string;
  name: string;
  durationDays: number;
  planType: string;
  period: string;
  priceCents: number | null;
  currency: string;
  isActive: boolean;
}
interface Promotion {
  id: string;
  name: string;
  percentOff: number | null;
  amountOffCents: number | null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Percent / fixed promotion → cents off, mirroring what the server will apply. */
function promotionOff(p: Promotion | undefined, price: number): number {
  if (!p) return 0;
  if (p.percentOff) return Math.round((price * p.percentOff) / 100);
  return Math.min(p.amountOffCents ?? 0, price);
}

/**
 * Sells (or, with `renewFrom`, renews) a package. The price shown is the package's configured price - a package
 * without a price is never given an invented one: the person selling either enters the agreed amount or sells
 * without an invoice.
 */
export function SellMembershipModal({
  open,
  onClose,
  onDone,
  member: fixedMember,
  renewFrom,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  member?: PickedMember;
  renewFrom?: { id: string; planId: string; endDate: string };
}) {
  const toast = useToast();
  const [member, setMember] = useState<PickedMember | null>(fixedMember ?? null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [planId, setPlanId] = useState(renewFrom?.planId ?? "");
  const [startDate, setStartDate] = useState(todayIso());
  const [priceInput, setPriceInput] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [payNow, setPayNow] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMember(fixedMember ?? null);
    setError(null);
    Promise.all([api.get<Plan[]>("membership-plans"), api.get<Promotion[]>("promotions").catch(() => [] as Promotion[])]).then(([p, promo]) => {
      const active = p.filter((x) => x.isActive);
      setPlans(active);
      setPromotions(promo);
      setPlanId((cur) => cur || active[0]?.id || "");
    });
  }, [open, fixedMember]);

  const plan = plans.find((p) => p.id === planId);
  // Whatever the person typed wins; otherwise the package price; null = no price known.
  const typedPrice = priceInput.trim() ? parseMoneyToCents(priceInput) : undefined;
  const basePrice = typedPrice !== undefined ? typedPrice : (plan?.priceCents ?? null);
  const promotion = promotions.find((p) => p.id === promotionId);
  const extraDiscount = discountInput.trim() ? (parseMoneyToCents(discountInput) ?? 0) : 0;
  const total = useMemo(() => (basePrice === null ? null : Math.max(0, basePrice - promotionOff(promotion, basePrice) - extraDiscount)), [basePrice, promotion, extraDiscount]);

  useEffect(() => {
    if (total !== null) setPayAmount((total / 100).toFixed(2));
  }, [total]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!member || !plan) return;
    if (typedPrice === null || (discountInput.trim() && parseMoneyToCents(discountInput) === null)) {
      setError("Enter amounts like 25 or 25.50.");
      return;
    }
    let initialPayment: { amountCents: number; method: string } | undefined;
    if (payNow && total !== null) {
      const cents = parseMoneyToCents(payAmount);
      if (cents === null || cents < 1 || cents > total) {
        setError(`The payment must be between 0.01 and ${formatMoney(total, plan.currency)}.`);
        return;
      }
      initialPayment = { amountCents: cents, method };
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...(renewFrom ? { planId } : { userId: member.id, planId }),
        startDate: new Date(`${startDate}T00:00:00`).toISOString(),
        ...(typedPrice !== undefined ? { priceCents: typedPrice } : {}),
        ...(promotionId ? { promotionId } : {}),
        ...(extraDiscount > 0 ? { discountCents: extraDiscount, discountNote: discountNote || undefined } : {}),
        ...(initialPayment ? { initialPayment } : {}),
      };
      await api.post(renewFrom ? `admin/memberships/${renewFrom.id}/renew` : "admin/memberships", body);
      toast.success(renewFrom ? "Membership renewed" : "Membership sold");
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the membership.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={renewFrom ? "Renew membership" : "Sell a membership"}
      description="The invoice, the payment and the member's status are all created together."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="sell-membership" loading={busy} disabled={!member || !plan}>
            {renewFrom ? "Renew" : "Sell membership"}
          </Button>
        </>
      }
    >
      <form id="sell-membership" onSubmit={submit}>
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        {!fixedMember && <MemberPicker value={member} onChange={setMember} />}
        <SelectField label="Package" required value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {PLAN_TYPE_LABEL[p.planType] ?? p.planType} · {PLAN_PERIOD_LABEL[p.period] ?? p.period} · {p.priceCents === null ? "no price set" : formatMoney(p.priceCents, p.currency)}
            </option>
          ))}
        </SelectField>
        {plans.length === 0 && <p className="mb-4 text-xs text-text-muted">There are no active packages yet. The owner creates them under Memberships.</p>}
        <TextField label="Start date" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} hint={renewFrom ? "Leave as today to start now; a renewal normally starts when the current membership ends." : undefined} />
        <TextField
          label={`Price (${plan?.currency ?? "EUR"})`}
          inputMode="decimal"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          placeholder={plan?.priceCents != null ? (plan.priceCents / 100).toFixed(2) : "Enter the agreed price"}
          hint={plan && plan.priceCents === null ? "This package has no price set. Enter the agreed amount, or leave empty to sell without an invoice." : "Leave empty to use the package price."}
        />
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <SelectField label="Promotion" value={promotionId} onChange={(e) => setPromotionId(e.target.value)}>
            <option value="">None</option>
            {promotions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.percentOff ? `${p.percentOff}%` : formatMoney(p.amountOffCents)} off)
              </option>
            ))}
          </SelectField>
          <TextField label="Extra discount" inputMode="decimal" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder="0" />
        </div>
        {extraDiscount > 0 && <TextAreaField label="Reason for the discount" rows={2} value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} />}

        <div className="mb-4 rounded-lg bg-surface-elevated p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-text-secondary">Total to pay</span>
            <span className="heading-display tabular text-2xl">{total === null ? "No invoice" : formatMoney(total, plan?.currency)}</span>
          </div>
          {total !== null && (
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="h-4 w-4 accent-ink" />
              Member is paying now
            </label>
          )}
          {payNow && total !== null && (
            <div className="mt-3 grid grid-cols-1 gap-x-3 sm:grid-cols-2">
              <TextField label="Amount received" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} hint="Less than the total records a partial payment." />
              <SelectField label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank transfer</option>
                <option value="CARD">Card</option>
              </SelectField>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
