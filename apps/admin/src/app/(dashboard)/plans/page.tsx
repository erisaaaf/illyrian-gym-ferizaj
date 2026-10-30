"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { useFetch } from "../../../lib/use-fetch";
import { formatDate, fullName, WEEKDAYS } from "../../../lib/format";
import { PageHeader, SearchInput, FilterSelect, FilterBar } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { DataEmptyState, ErrorState, TableSkeleton } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { Drawer } from "../../../components/ui/modal";
import { SelectField, TextAreaField, TextField } from "../../../components/ui/field";
import { useToast } from "../../../components/ui/toast";

interface PlanRow {
  id: string;
  title: string;
  goal: string | null;
  notes: string | null;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  startsOn: string;
  endsOn: string | null;
  user: { id: string; firstName: string; lastName: string; memberNumber: string | null };
  items: Array<{ id: string; weekday: number; exerciseId: string; sets: number | null; reps: number | null; weightKg: string | null; durationSeconds: number | null; notes: string | null; exercise: { name: string } }>;
}
interface Paged {
  data: PlanRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
interface Client {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
}
interface Exercise {
  id: string;
  name: string;
}
interface Row {
  key: number;
  weekday: number;
  exerciseId: string;
  sets: string;
  reps: string;
  weightKg: string;
  durationSeconds: string;
  notes: string;
}

let rowKey = 0;
const blankRow = (weekday = 1): Row => ({ key: ++rowKey, weekday, exerciseId: "", sets: "", reps: "", weightKg: "", durationSeconds: "", notes: "" });
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

function PlanEditor({ plan, presetClient, onClose, onSaved }: { plan: PlanRow | null; presetClient?: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const clients = useFetch<{ data: Client[] }>("clients?pageSize=100");
  const exercises = useFetch<{ data: Exercise[] }>("exercises?pageSize=100&active=true");
  const [userId, setUserId] = useState(plan?.user.id ?? presetClient ?? "");
  const [title, setTitle] = useState(plan?.title ?? "");
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [startsOn, setStartsOn] = useState((plan?.startsOn ?? new Date().toISOString()).slice(0, 10));
  const [endsOn, setEndsOn] = useState(plan?.endsOn?.slice(0, 10) ?? "");
  const [rows, setRows] = useState<Row[]>(
    plan
      ? plan.items.map((i) => ({ key: ++rowKey, weekday: i.weekday, exerciseId: i.exerciseId, sets: i.sets?.toString() ?? "", reps: i.reps?.toString() ?? "", weightKg: i.weightKg ?? "", durationSeconds: i.durationSeconds?.toString() ?? "", notes: i.notes ?? "" }))
      : [blankRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const filled = rows.filter((r) => r.exerciseId);
    if (!plan && !userId) return setError("Choose the client this plan is for.");
    setBusy(true);
    setError(null);
    try {
      const items = filled.map((r, position) => ({ weekday: r.weekday, exerciseId: r.exerciseId, position, sets: num(r.sets), reps: num(r.reps), weightKg: num(r.weightKg), durationSeconds: num(r.durationSeconds), notes: r.notes || undefined }));
      const base = { title, goal: goal || undefined, notes: notes || undefined, startsOn: new Date(`${startsOn}T00:00:00`).toISOString(), endsOn: endsOn ? new Date(`${endsOn}T00:00:00`).toISOString() : undefined, items };
      if (plan) await api.patch(`workout-plans/${plan.id}`, base);
      else await api.post("workout-plans", { ...base, userId });
      toast.success(plan ? "Plan updated" : "Plan created. The client sees it in their app.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.validation?.[0] ?? err.message) : "Could not save the plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width="sm:max-w-3xl"
      title={plan ? "Edit workout plan" : "New workout plan"}
      description="A weekly plan. It shows up in the client's app as today's session."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="plan-editor" loading={busy}>
            {plan ? "Save plan" : "Create plan"}
          </Button>
        </>
      }
    >
      <form id="plan-editor" onSubmit={submit}>
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        {!plan && (
          <SelectField label="Client" required value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Choose a client…</option>
            {clients.data?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {fullName(c)} {c.memberNumber ? `(${c.memberNumber})` : ""}
              </option>
            ))}
          </SelectField>
        )}
        <TextField label="Title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField label="Goal" maxLength={300} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="For example: add 10 kg to the back squat" />
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <TextField label="Starts" type="date" required value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          <TextField label="Ends" type="date" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} hint="Optional" />
        </div>
        <TextAreaField label="Notes for the client" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <h3 className="mb-2 mt-2 text-xs font-bold uppercase tracking-wider text-text-muted">Sessions</h3>
        <ul className="mb-3 space-y-3">
          {rows.map((r) => (
            <li key={r.key} className="rounded-lg border border-border bg-surface-elevated p-3">
              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
                <SelectField label="Day" value={r.weekday} onChange={(e) => update(r.key, { weekday: Number(e.target.value) })}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </SelectField>
                <div className="sm:col-span-2">
                  <SelectField label="Exercise" value={r.exerciseId} onChange={(e) => update(r.key, { exerciseId: e.target.value })}>
                    <option value="">Choose…</option>
                    {exercises.data?.data.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-4">
                <TextField label="Sets" type="number" min={0} max={100} value={r.sets} onChange={(e) => update(r.key, { sets: e.target.value })} />
                <TextField label="Reps" type="number" min={0} max={1000} value={r.reps} onChange={(e) => update(r.key, { reps: e.target.value })} />
                <TextField label="Weight (kg)" type="number" min={0} step="0.5" value={r.weightKg} onChange={(e) => update(r.key, { weightKg: e.target.value })} />
                <TextField label="Time (sec)" type="number" min={0} value={r.durationSeconds} onChange={(e) => update(r.key, { durationSeconds: e.target.value })} />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <TextField label="Note" maxLength={500} value={r.notes} onChange={(e) => update(r.key, { notes: e.target.value })} className="!mb-0" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove this exercise">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, blankRow(rs[rs.length - 1]?.weekday ?? 1)])}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add exercise
        </Button>
      </form>
    </Drawer>
  );
}

function PlansView() {
  const params = useSearchParams();
  const preset = params.get("client") ?? undefined;
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PlanRow | null | undefined>(preset ? null : undefined);
  useEffect(() => setPage(1), [debounced, status]);
  const { data, loading, error, reload } = useFetch<Paged>(`workout-plans${qs({ search: debounced, status: status || undefined, userId: preset, page, pageSize: 20 })}`);

  async function setPlanStatus(p: PlanRow, next: PlanRow["status"]) {
    try {
      await api.patch(`workout-plans/${p.id}`, { status: next });
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Training"
        title="Workout plans"
        description="Plans you write for your clients. The client sees the plan in their app and logs the workouts; you see how much of it they followed."
        action={
          <Button variant="primary" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New plan
          </Button>
        }
      />
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Plan or client name" label="Search plans" />
        <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ value: "ACTIVE", label: "Active" }, { value: "COMPLETED", label: "Completed" }, { value: "ARCHIVED", label: "Archived" }, { value: "", label: "All" }]} />
      </FilterBar>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={5} />}
      {data && data.data.length === 0 && <DataEmptyState title="No plans" message="Create a plan for one of your clients and it appears in their app straight away." />}
      {data && data.data.length > 0 && (
        <>
          <Table caption="Workout plans">
            <Thead>
              <Th>Plan</Th>
              <Th>Client</Th>
              <Th>Days</Th>
              <Th>Period</Th>
              <Th>Status</Th>
              <Th />
            </Thead>
            <Tbody>
              {data.data.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <p className="font-semibold">{p.title}</p>
                    {p.goal && <p className="max-w-xs truncate text-xs text-text-muted">{p.goal}</p>}
                  </Td>
                  <Td>{fullName(p.user)}</Td>
                  <Td className="text-text-secondary">
                    {Array.from(new Set(p.items.map((i) => i.weekday)))
                      .sort()
                      .map((d) => WEEKDAYS[d - 1])
                      .join(", ") || "—"}
                  </Td>
                  <Td className="text-text-secondary">
                    {formatDate(p.startsOn)}
                    {p.endsOn && ` – ${formatDate(p.endsOn)}`}
                  </Td>
                  <Td>
                    <Badge variant={p.status === "ACTIVE" ? "success" : "neutral"}>{p.status.toLowerCase()}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                      {p.status === "ACTIVE" ? (
                        <Button size="sm" variant="ghost" onClick={() => setPlanStatus(p, "ARCHIVED")}>
                          Archive
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setPlanStatus(p, "ACTIVE")}>
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />
        </>
      )}
      {editing !== undefined && <PlanEditor plan={editing} presetClient={preset} onClose={() => setEditing(undefined)} onSaved={reload} />}
    </div>
  );
}

export default function PlansPage() {
  return (
    <Suspense fallback={<TableSkeleton cols={5} />}>
      <PlansView />
    </Suspense>
  );
}
