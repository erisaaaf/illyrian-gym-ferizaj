"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError, qs } from "../../lib/api";
import { formatDate, formatMoney, parseMoneyToCents } from "../../lib/format";
import { Modal } from "../ui/modal";
import { SelectField, TextAreaField, TextField } from "../ui/field";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import { MemberPicker, PickedMember } from "./member-picker";

interface OpenInvoice {
  id: string;
  number: string;
  balanceCents: number;
  totalCents: number;
  dueDate: string;
  displayStatus: string;
}

/**
 * Records money received against an invoice. Payments are never edited or deleted afterwards - corrections are
 * made by the owner with a written reason, so the history stays complete.
 */
export function RecordPaymentModal({
  open,
  onClose,
  onDone,
  member: fixedMember,
  invoiceId: fixedInvoiceId,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  member?: PickedMember;
  invoiceId?: string;
}) {
  const toast = useToast();
  const [member, setMember] = useState<PickedMember | null>(fixedMember ?? null);
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [invoiceId, setInvoiceId] = useState(fixedInvoiceId ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMember(fixedMember ?? null);
    setInvoiceId(fixedInvoiceId ?? "");
    setError(null);
  }, [open, fixedMember, fixedInvoiceId]);

  useEffect(() => {
    if (!open || !member) {
      setInvoices([]);
      return;
    }
    api
      .get<{ data: OpenInvoice[] }>(`admin/invoices${qs({ userId: member.id, status: "OUTSTANDING", pageSize: 50 })}`)
      .then((r) => {
        setInvoices(r.data);
        setInvoiceId((cur) => (r.data.some((i) => i.id === cur) ? cur : (r.data[0]?.id ?? "")));
      })
      .catch(() => setInvoices([]));
  }, [open, member]);

  const invoice = invoices.find((i) => i.id === invoiceId);
  useEffect(() => {
    if (invoice) setAmount((invoice.balanceCents / 100).toFixed(2));
  }, [invoice]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!member || !invoice) return;
    const cents = parseMoneyToCents(amount);
    if (cents === null || cents < 1) return setError("Enter the amount received, like 25 or 25.50.");
    if (cents > invoice.balanceCents) return setError(`This invoice only has ${formatMoney(invoice.balanceCents)} left to pay.`);
    setBusy(true);
    setError(null);
    try {
      await api.post("admin/payments", { userId: member.id, invoiceId: invoice.id, amountCents: cents, method, reference: reference || undefined, notes: notes || undefined });
      toast.success(cents < invoice.balanceCents ? "Partial payment recorded" : "Payment recorded");
      onDone();
      onClose();
      setReference("");
      setNotes("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a payment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="record-payment" loading={busy} disabled={!invoice}>
            Record payment
          </Button>
        </>
      }
    >
      <form id="record-payment" onSubmit={submit}>
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        {!fixedMember && <MemberPicker value={member} onChange={setMember} />}
        {member && invoices.length === 0 && <p className="mb-4 rounded-md bg-surface-elevated p-3 text-sm text-text-secondary">{member.firstName} has no unpaid invoices.</p>}
        {invoices.length > 0 && (
          <SelectField label="Invoice" required value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} disabled={!!fixedInvoiceId}>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.number} · {formatMoney(i.balanceCents)} left · due {formatDate(i.dueDate)}
                {i.displayStatus === "OVERDUE" ? " · overdue" : ""}
              </option>
            ))}
          </SelectField>
        )}
        {invoice && (
          <>
            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
              <TextField label="Amount received" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} hint={`Balance: ${formatMoney(invoice.balanceCents)}`} />
              <SelectField label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank transfer</option>
                <option value="CARD">Card</option>
              </SelectField>
            </div>
            <TextField label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transfer number, receipt, ..." />
            <TextAreaField label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </>
        )}
      </form>
    </Modal>
  );
}
