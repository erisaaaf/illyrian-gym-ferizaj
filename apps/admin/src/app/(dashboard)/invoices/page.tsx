"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { downloadFile, useFetch } from "../../../lib/use-fetch";
import { useStaffUser } from "../../../lib/staff-context";
import { formatDate, formatDateTime, formatMoney, fullName, parseMoneyToCents, PAYMENT_METHOD_LABEL } from "../../../lib/format";
import { PageHeader, SearchInput, FilterSelect, DateFilter, FilterBar, dayEndIso, dayStartIso } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { PaymentStatusBadge } from "../../../components/ui/badge";
import { DataEmptyState, ErrorState, TableSkeleton } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { Drawer, Modal } from "../../../components/ui/modal";
import { TextAreaField, TextField } from "../../../components/ui/field";
import { useToast } from "../../../components/ui/toast";
import { RecordPaymentModal } from "../../../components/money/record-payment-modal";
import { ReasonDialog } from "../../../components/money/reason-dialog";
import { ExportButtons } from "../../../components/money/export-buttons";
import { MemberPicker, PickedMember } from "../../../components/money/member-picker";

interface InvoiceRow {
  id: string;
  number: string;
  description: string;
  status: string;
  displayStatus: string;
  issuedAt: string;
  dueDate: string;
  totalCents: number;
  discountCents: number;
  paidCents: number;
  balanceCents: number;
  notes: string | null;
  voidReason: string | null;
  user: { id: string; firstName: string; lastName: string; memberNumber: string | null; email: string };
  membership: { plan: { name: string } } | null;
  lines: Array<{ id: string; description: string; amountCents: number }>;
  payments: Array<{ id: string; amountCents: number; method: string; status: string; receivedAt: string; reference: string | null }>;
}
interface Page {
  data: InvoiceRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

function CreateInvoiceModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [member, setMember] = useState<PickedMember | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMember(null);
      setDescription("");
      setAmount("");
      setDue("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseMoneyToCents(amount);
    if (!member || cents === null || cents < 1) return setError("Choose a member and enter an amount like 25 or 25.50.");
    setBusy(true);
    setError(null);
    try {
      await api.post("admin/invoices", { userId: member.id, description, lines: [{ description, amountCents: cents }], dueDate: due ? new Date(`${due}T00:00:00`).toISOString() : undefined, notes: notes || undefined });
      toast.success("Invoice created");
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.validation?.[0] ?? err.message) : "Could not create the invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New invoice"
      description="For anything that is not a membership sale (for example a day pass or merchandise). Membership invoices are created when the membership is sold."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="invoice-form" loading={busy}>
            Create invoice
          </Button>
        </>
      }
    >
      <form id="invoice-form" onSubmit={submit}>
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <MemberPicker value={member} onChange={setMember} />
        <TextField label="What is it for?" required value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <TextField label="Amount (EUR)" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} hint="Defaults to the gym's payment term." />
        </div>
        <TextAreaField label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </form>
    </Modal>
  );
}

function InvoiceDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { role } = useStaffUser();
  const toast = useToast();
  const { data: inv, reload, error } = useFetch<InvoiceRow>(`admin/invoices/${id}`);
  const [pay, setPay] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  async function pdf() {
    setPdfBusy(true);
    try {
      await downloadFile(`admin/invoices/${id}/pdf`, `invoice-${inv?.number ?? id}.pdf`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not download the invoice");
    } finally {
      setPdfBusy(false);
    }
  }

  const refreshAll = () => {
    reload();
    onChanged();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={inv ? `Invoice ${inv.number}` : "Invoice"}
      footer={
        inv && (
          <>
            <Button variant="secondary" onClick={pdf} loading={pdfBusy}>
              <Download className="h-4 w-4" aria-hidden="true" />
              PDF
            </Button>
            {role === "ADMIN" && inv.status === "OPEN" && (
              <Button variant="ghost" onClick={() => setVoiding(true)}>
                Void
              </Button>
            )}
            {inv.status === "OPEN" && inv.balanceCents > 0 && (
              <Button variant="primary" onClick={() => setPay(true)}>
                Record payment
              </Button>
            )}
          </>
        )
      }
    >
      {error && <ErrorState message={error} onRetry={reload} />}
      {inv && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <PaymentStatusBadge status={inv.displayStatus} />
            <p className="text-xs text-text-muted">Issued {formatDate(inv.issuedAt)} · due {formatDate(inv.dueDate)}</p>
          </div>
          <p className="text-sm">
            <Link href={`/members/${inv.user.id}`} className="font-semibold hover:underline">
              {fullName(inv.user)}
            </Link>{" "}
            <span className="text-text-muted">{inv.user.memberNumber}</span>
          </p>
          <p className="mb-4 text-sm text-text-secondary">{inv.description}</p>
          <table className="mb-4 w-full text-sm">
            <tbody className="divide-y divide-border">
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-2">{l.description}</td>
                  <td className="tabular py-2 text-right">{formatMoney(l.amountCents)}</td>
                </tr>
              ))}
              {inv.discountCents > 0 && (
                <tr>
                  <td className="py-2 text-text-secondary">Discount</td>
                  <td className="tabular py-2 text-right">−{formatMoney(inv.discountCents)}</td>
                </tr>
              )}
              <tr className="font-bold">
                <td className="py-2">Total</td>
                <td className="tabular py-2 text-right">{formatMoney(inv.totalCents)}</td>
              </tr>
              <tr>
                <td className="py-2 text-text-secondary">Paid</td>
                <td className="tabular py-2 text-right">{formatMoney(inv.paidCents)}</td>
              </tr>
              <tr className="font-bold">
                <td className="py-2">Balance</td>
                <td className={`tabular py-2 text-right ${inv.balanceCents > 0 && inv.displayStatus === "OVERDUE" ? "text-danger" : ""}`}>{formatMoney(inv.balanceCents)}</td>
              </tr>
            </tbody>
          </table>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">Payments</h3>
          {inv.payments.length === 0 && <p className="text-sm text-text-muted">No payments yet.</p>}
          <ul className="divide-y divide-border">
            {inv.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {formatMoney(p.amountCents)} · {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                  <span className="block text-xs text-text-muted">{formatDateTime(p.receivedAt)}{p.reference && ` · ${p.reference}`}</span>
                </span>
                <PaymentStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
          {inv.voidReason && <p className="mt-4 rounded-md bg-surface-elevated p-3 text-sm text-text-secondary">Voided: {inv.voidReason}</p>}
          {inv.notes && <p className="mt-4 text-sm text-text-secondary">{inv.notes}</p>}
          <RecordPaymentModal open={pay} onClose={() => setPay(false)} onDone={refreshAll} member={{ id: inv.user.id, firstName: inv.user.firstName, lastName: inv.user.lastName, memberNumber: inv.user.memberNumber }} invoiceId={inv.id} />
          <ReasonDialog
            open={voiding}
            onClose={() => setVoiding(false)}
            title="Void this invoice?"
            description="A voided invoice no longer counts as owed. It stays in the records."
            confirmLabel="Void invoice"
            danger
            onSubmit={async (reason) => {
              try {
                await api.patch(`admin/invoices/${id}/void`, { reason });
                toast.success("Invoice voided");
                refreshAll();
              } catch (e) {
                throw new Error(e instanceof ApiError ? e.message : "Could not void");
              }
            }}
          />
        </div>
      )}
    </Drawer>
  );
}

function InvoicesView() {
  const params = useSearchParams();
  const { role } = useStaffUser();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const debounced = useDebouncedValue(search);
  const [status, setStatus] = useState(params.get("status") === "unpaid" ? "OUTSTANDING" : "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const userId = params.get("userId") ?? undefined;

  useEffect(() => setPage(1), [debounced, status, from, to]);
  const filters = { search: debounced || undefined, status: status || undefined, userId, from: dayStartIso(from), to: dayEndIso(to) };
  const { data, loading, error, reload } = useFetch<Page>(`admin/invoices${qs({ ...filters, page, pageSize: 20 })}`);

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Invoices"
        description="What members were billed and what is still owed. Status is worked out from the payments received, so it can never disagree with them."
        action={
          <>
            {role === "ADMIN" && <ExportButtons type="invoices" filters={{ from: filters.from, to: filters.to }} />}
            <Button variant="primary" onClick={() => setCreate(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New invoice
            </Button>
          </>
        }
      />
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Invoice number or member" label="Search invoices" />
        <FilterSelect
          value={status}
          onChange={setStatus}
          label="Status"
          options={[
            { value: "", label: "All statuses" },
            { value: "OUTSTANDING", label: "Unpaid (any)" },
            { value: "PENDING", label: "Pending" },
            { value: "PARTIAL", label: "Partly paid" },
            { value: "OVERDUE", label: "Overdue" },
            { value: "PAID", label: "Paid" },
            { value: "VOID", label: "Void" },
          ]}
        />
        <DateFilter label="Issued from" value={from} onChange={setFrom} />
        <DateFilter label="to" value={to} onChange={setTo} />
        {userId && (
          <Link href="/invoices" className="text-xs font-bold text-accent-text hover:underline">
            Showing one member · show all
          </Link>
        )}
      </FilterBar>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={7} />}
      {data && data.data.length === 0 && <DataEmptyState title="No invoices" message="No invoice matches. Invoices are created automatically when a membership is sold, or manually for other charges." />}
      {data && data.data.length > 0 && (
        <div className={loading ? "opacity-60 transition" : "transition"}>
          <Table caption="Invoices">
            <Thead>
              <Th>Number</Th>
              <Th>Member</Th>
              <Th>Issued</Th>
              <Th>Due</Th>
              <Th align="right">Total</Th>
              <Th align="right">Balance</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {data.data.map((i) => (
                <Tr key={i.id} onClick={() => setOpen(i.id)}>
                  <Td className="tabular font-semibold">{i.number}</Td>
                  <Td>
                    <p className="font-semibold">{fullName(i.user)}</p>
                    <p className="text-xs text-text-muted">{i.membership?.plan.name ?? i.description}</p>
                  </Td>
                  <Td className="text-text-secondary">{formatDate(i.issuedAt)}</Td>
                  <Td className="text-text-secondary">{formatDate(i.dueDate)}</Td>
                  <Td align="right">{formatMoney(i.totalCents)}</Td>
                  <Td align="right" className={i.balanceCents > 0 ? "font-bold" : "text-text-muted"}>
                    {formatMoney(i.balanceCents)}
                  </Td>
                  <Td>
                    <PaymentStatusBadge status={i.displayStatus} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />
        </div>
      )}
      {open && <InvoiceDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
      <CreateInvoiceModal open={create} onClose={() => setCreate(false)} onDone={reload} />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<TableSkeleton cols={7} />}>
      <InvoicesView />
    </Suspense>
  );
}
