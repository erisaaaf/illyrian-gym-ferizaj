"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { useFetch } from "../../../lib/use-fetch";
import { formatDate, formatMoney, parseMoneyToCents } from "../../../lib/format";
import { PageHeader, SearchInput, FilterSelect, DateFilter, FilterBar, dayEndIso, dayStartIso } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { DataEmptyState, ErrorState, TableSkeleton } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { SelectField, TextField } from "../../../components/ui/field";
import { StatCard } from "../../../components/stat-card";
import { useToast } from "../../../components/ui/toast";
import { ReasonDialog } from "../../../components/money/reason-dialog";
import { ExportButtons } from "../../../components/money/export-buttons";

const CATEGORIES: Record<string, string> = { RENT: "Rent", EQUIPMENT: "Equipment", MAINTENANCE: "Maintenance", UTILITIES: "Utilities", SALARIES: "Salaries", MARKETING: "Marketing", OTHER: "Other" };

interface Expense {
  id: string;
  category: string;
  description: string;
  amountCents: number;
  spentAt: string;
}
interface Page {
  data: Expense[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  totals: { spentCents: number };
}

export default function ExpensesPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const [voiding, setVoiding] = useState<Expense | null>(null);

  useEffect(() => setPage(1), [debounced, category, from, to]);
  const filters = { search: debounced || undefined, category: category || undefined, from: dayStartIso(from), to: dayEndIso(to) };
  const { data, loading, error, reload } = useFetch<Page>(`admin/expenses${qs({ ...filters, page, pageSize: 20 })}`);

  const [cat, setCat] = useState("RENT");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [spent, setSpent] = useState(new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    const cents = parseMoneyToCents(amount);
    if (cents === null || cents < 1) return setFormError("Enter an amount like 120 or 120.50.");
    setBusy(true);
    setFormError(null);
    try {
      await api.post("admin/expenses", { category: cat, description, amountCents: cents, spentAt: new Date(`${spent}T12:00:00`).toISOString() });
      toast.success("Expense recorded");
      setCreate(false);
      setDescription("");
      setAmount("");
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? (err.errors?.validation?.[0] ?? err.message) : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Expenses"
        description="Money the gym spends. Only expenses you record here are counted; nothing is estimated."
        action={
          <>
            <ExportButtons type="expenses" filters={{ from: filters.from, to: filters.to }} />
            <Button variant="primary" onClick={() => setCreate(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add expense
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Spent (this filter)" value={data ? formatMoney(data.totals.spentCents) : undefined} />
        <StatCard label="Expenses" value={data?.meta.total} />
      </div>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search description" label="Search expenses" />
        <FilterSelect value={category} onChange={setCategory} label="Category" options={[{ value: "", label: "All categories" }, ...Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }))]} />
        <DateFilter label="From" value={from} onChange={setFrom} />
        <DateFilter label="To" value={to} onChange={setTo} />
      </FilterBar>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={5} />}
      {data && data.data.length === 0 && <DataEmptyState title="No expenses" message="Record rent, equipment, salaries and other costs to see the gym's net result." />}
      {data && data.data.length > 0 && (
        <div className={loading ? "opacity-60 transition" : "transition"}>
          <Table caption="Expenses">
            <Thead>
              <Th>Date</Th>
              <Th>Category</Th>
              <Th>Description</Th>
              <Th align="right">Amount</Th>
              <Th />
            </Thead>
            <Tbody>
              {data.data.map((x) => (
                <Tr key={x.id}>
                  <Td className="text-text-secondary">{formatDate(x.spentAt)}</Td>
                  <Td>
                    <Badge>{CATEGORIES[x.category] ?? x.category}</Badge>
                  </Td>
                  <Td>{x.description}</Td>
                  <Td align="right" className="font-bold">
                    {formatMoney(x.amountCents)}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setVoiding(x)}>
                        Void
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />
        </div>
      )}

      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title="Add an expense"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreate(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="expense-form" loading={busy}>
              Save expense
            </Button>
          </>
        }
      >
        <form id="expense-form" onSubmit={save}>
          {formError && (
            <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              {formError}
            </p>
          )}
          <SelectField label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
            {Object.entries(CATEGORIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectField>
          <TextField label="Description" required value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <TextField label="Amount (EUR)" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <TextField label="Date" type="date" required value={spent} onChange={(e) => setSpent(e.target.value)} />
          </div>
        </form>
      </Modal>
      <ReasonDialog
        open={voiding !== null}
        onClose={() => setVoiding(null)}
        title="Void this expense?"
        description={voiding ? `${voiding.description} · ${formatMoney(voiding.amountCents)}. It stops counting in the totals but stays in the records.` : undefined}
        confirmLabel="Void expense"
        danger
        onSubmit={async (reason) => {
          try {
            await api.patch(`admin/expenses/${voiding!.id}/void`, { reason });
            toast.success("Expense voided");
            reload();
          } catch (e) {
            throw new Error(e instanceof ApiError ? e.message : "Could not void");
          }
        }}
      />
    </div>
  );
}
