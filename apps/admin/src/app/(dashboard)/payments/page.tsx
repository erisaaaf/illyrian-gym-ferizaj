"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Wallet } from "lucide-react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { useFetch } from "../../../lib/use-fetch";
import { useStaffUser } from "../../../lib/staff-context";
import { dayEndIso, dayStartIso } from "../../../components/ui/page-header";
import { formatDateTime, formatMoney, fullName, parseMoneyToCents, PAYMENT_METHOD_LABEL } from "../../../lib/format";
import { PageHeader, SearchInput, FilterSelect, DateFilter, FilterBar } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { PaymentStatusBadge } from "../../../components/ui/badge";
import { DataEmptyState, ErrorState, TableSkeleton } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { SelectField, TextField } from "../../../components/ui/field";
import { StatCard } from "../../../components/stat-card";
import { useToast } from "../../../components/ui/toast";
import { RecordPaymentModal } from "../../../components/money/record-payment-modal";
import { ReasonDialog } from "../../../components/money/reason-dialog";
import { ExportButtons } from "../../../components/money/export-buttons";

interface PaymentRow {
  id: string;
  amountCents: number;
  method: string;
  status: "COMPLETED" | "VOIDED";
  receivedAt: string;
  reference: string | null;
  notes: string | null;
  user: { id: string; firstName: string; lastName: string; memberNumber: string | null };
  invoice: { id: string; number: string } | null;
  membership: { plan: { name: string } } | null;
}
interface Page {
  data: PaymentRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  totals: { receivedCents: number };
}

function PaymentsView() {
  const params = useSearchParams();
  const { role } = useStaffUser();
  const toast = useToast();
  const isAdmin = role === "ADMIN";
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [record, setRecord] = useState(params.get("record") === "1");
  const [voiding, setVoiding] = useState<PaymentRow | null>(null);
  const [correcting, setCorrecting] = useState<PaymentRow | null>(null);
  const [amount, setAmount] = useState("");
  const [corrMethod, setCorrMethod] = useState("CASH");
  const [corrRef, setCorrRef] = useState("");

  useEffect(() => setPage(1), [debounced, method, status, from, to]);
  const filters = { search: debounced || undefined, method: method || undefined, status: status || undefined, from: dayStartIso(from), to: dayEndIso(to) };
  const { data, loading, error, reload } = useFetch<Page>(`admin/payments${qs({ ...filters, page, pageSize: 20 })}`);

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Payments"
        description="Money actually received. A payment is never deleted: a mistake is voided or corrected with a reason, and the history stays."
        action={
          <>
            {isAdmin && <ExportButtons type="payments" filters={{ from: filters.from, to: filters.to, method: filters.method }} />}
            <Button variant="primary" onClick={() => setRecord(true)}>
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Record payment
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Received (this filter)" value={data ? formatMoney(data.totals.receivedCents) : undefined} hint="Completed payments only" />
        <StatCard label="Payments" value={data?.meta.total} />
      </div>

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Member, invoice or reference" label="Search payments" />
        <FilterSelect
          value={method}
          onChange={setMethod}
          label="Method"
          options={[{ value: "", label: "All methods" }, { value: "CASH", label: "Cash" }, { value: "BANK", label: "Bank transfer" }, { value: "CARD", label: "Card" }]}
        />
        <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ value: "", label: "All" }, { value: "COMPLETED", label: "Completed" }, { value: "VOIDED", label: "Voided" }]} />
        <DateFilter label="From" value={from} onChange={setFrom} />
        <DateFilter label="To" value={to} onChange={setTo} />
      </FilterBar>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={7} />}
      {data && data.data.length === 0 && <DataEmptyState title="No payments" message="No payment matches these filters. Payments are recorded against an invoice from a member's profile or with the button above." />}
      {data && data.data.length > 0 && (
        <div className={loading ? "opacity-60 transition" : "transition"}>
          <Table caption="Payments">
            <Thead>
              <Th>Received</Th>
              <Th>Member</Th>
              <Th>Invoice</Th>
              <Th>Method</Th>
              <Th align="right">Amount</Th>
              <Th>Status</Th>
              {isAdmin && <Th />}
            </Thead>
            <Tbody>
              {data.data.map((p) => (
                <Tr key={p.id}>
                  <Td className="text-text-secondary">{formatDateTime(p.receivedAt)}</Td>
                  <Td>
                    <Link href={`/members/${p.user.id}`} className="font-semibold hover:underline">
                      {fullName(p.user)}
                    </Link>
                    <p className="text-xs text-text-muted">{p.membership?.plan.name ?? p.user.memberNumber}</p>
                  </Td>
                  <Td>{p.invoice ? <Link href={`/invoices?search=${p.invoice.number}`} className="tabular hover:underline">{p.invoice.number}</Link> : "—"}</Td>
                  <Td>
                    {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                    {p.reference && <p className="text-xs text-text-muted">{p.reference}</p>}
                  </Td>
                  <Td align="right" className={p.status === "VOIDED" ? "text-text-muted line-through" : "font-bold"}>
                    {formatMoney(p.amountCents)}
                  </Td>
                  <Td>
                    <PaymentStatusBadge status={p.status} />
                  </Td>
                  {isAdmin && (
                    <Td>
                      {p.status === "COMPLETED" && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAmount((p.amountCents / 100).toFixed(2));
                              setCorrMethod(p.method);
                              setCorrRef(p.reference ?? "");
                              setCorrecting(p);
                            }}
                          >
                            Correct
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setVoiding(p)}>
                            Void
                          </Button>
                        </div>
                      )}
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />
        </div>
      )}

      <RecordPaymentModal open={record} onClose={() => setRecord(false)} onDone={reload} />
      <ReasonDialog
        open={voiding !== null}
        onClose={() => setVoiding(null)}
        title="Void this payment?"
        description={voiding ? `${formatMoney(voiding.amountCents)} from ${fullName(voiding.user)}. It stops counting as revenue and the invoice becomes unpaid again.` : undefined}
        confirmLabel="Void payment"
        danger
        onSubmit={async (reason) => {
          try {
            await api.patch(`admin/payments/${voiding!.id}/void`, { reason });
            toast.success("Payment voided");
            reload();
          } catch (e) {
            throw new Error(e instanceof ApiError ? e.message : "Could not void");
          }
        }}
      />
      <ReasonDialog
        open={correcting !== null}
        onClose={() => setCorrecting(null)}
        title="Correct this payment"
        description="The old values are kept in the audit history."
        confirmLabel="Save correction"
        onSubmit={async (reason) => {
          const cents = parseMoneyToCents(amount);
          if (cents === null || cents < 1) throw new Error("Enter a valid amount");
          try {
            await api.patch(`admin/payments/${correcting!.id}/correct`, { reason, amountCents: cents, method: corrMethod, reference: corrRef || undefined });
            toast.success("Payment corrected");
            reload();
          } catch (e) {
            throw new Error(e instanceof ApiError ? e.message : "Could not correct");
          }
        }}
      >
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <TextField label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <SelectField label="Method" value={corrMethod} onChange={(e) => setCorrMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="BANK">Bank transfer</option>
            <option value="CARD">Card</option>
          </SelectField>
        </div>
        <TextField label="Reference" value={corrRef} onChange={(e) => setCorrRef(e.target.value)} />
      </ReasonDialog>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<TableSkeleton cols={7} />}>
      <PaymentsView />
    </Suspense>
  );
}
