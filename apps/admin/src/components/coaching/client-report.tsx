"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { qs } from "../../lib/api";
import { useFetch } from "../../lib/use-fetch";
import { formatDate, fullName } from "../../lib/format";
import { StatCard } from "../stat-card";
import { Button } from "../ui/button";
import { TextField } from "../ui/field";
import { ErrorState, Skeleton } from "../ui/states";
import { BarChart } from "../ui/charts";

interface Report {
  client: { id: string; firstName: string; lastName: string; memberNumber: string | null };
  period: { from: string; to: string };
  workoutFrequency: { trainingDays: number; workoutsLogged: number; averageTrainingDaysPerWeek: number };
  planAdherence: Array<{ planId: string; title: string; plannedDays: number; completedDays: number; percent: number | null }>;
  strengthProgress: Array<{ exercise: string; unit: string; startValue: number; currentValue: number; changePercent: number | null; newRecords: number }>;
  newPersonalRecords: number;
  totalPersonalRecords: number;
  attendance: { gymVisits: number; classesAttended: number };
  bodyMeasurements: { sharedByMember: boolean; note?: string; changes: Array<{ field: string; first: number; latest: number; change: number; readings: number }> };
  trainerNotes: Array<{ id: string; body: string; createdAt: string }>;
}

const FIELD_LABEL: Record<string, string> = { weightKg: "Weight (kg)", bodyFatPercent: "Body fat (%)", chestCm: "Chest (cm)", waistCm: "Waist (cm)", hipsCm: "Hips (cm)", armCm: "Arm (cm)", thighCm: "Thigh (cm)" };

/** The progress report of one client for a period. Built only from recorded data; body numbers appear only if the member shared them. */
export function ClientReport({ clientId }: { clientId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, loading, error, reload } = useFetch<Report>(`clients/${clientId}/report${qs({ from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined })}`);

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="!mb-0" />
        <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="!mb-0" />
        <Button variant="secondary" onClick={() => window.print()} disabled={!data}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          Print
        </Button>
        <span className="text-xs text-text-muted">{from || to ? "" : "Last 30 days by default"}</span>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-64 w-full" />}
      {data && (
        <div className={loading ? "opacity-60 transition" : "transition"}>
          <p className="mb-3 text-sm text-text-secondary">
            {fullName(data.client)} · {formatDate(data.period.from)} – {formatDate(data.period.to)}
          </p>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Training days" value={data.workoutFrequency.trainingDays} hint={`${data.workoutFrequency.averageTrainingDaysPerWeek} per week`} />
            <StatCard label="Workouts logged" value={data.workoutFrequency.workoutsLogged} />
            <StatCard label="Gym visits" value={data.attendance.gymVisits} hint={`${data.attendance.classesAttended} classes`} />
            <StatCard label="Personal records" value={data.newPersonalRecords} hint={`${data.totalPersonalRecords} in total`} />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="card p-5">
              <h3 className="mb-3 font-heading text-base font-extrabold tracking-heading">Plan adherence</h3>
              {data.planAdherence.length === 0 && <p className="text-sm text-text-muted">No active workout plan.</p>}
              {data.planAdherence.length > 0 && (
                <BarChart ariaLabel="Plan adherence percent" labels={data.planAdherence.map((p) => p.title)} series={[{ name: "Adherence %", values: data.planAdherence.map((p) => p.percent ?? 0) }]} format={(n) => `${Math.round(n)}%`} />
              )}
            </section>
            <section className="card p-5">
              <h3 className="mb-3 font-heading text-base font-extrabold tracking-heading">Strength progress</h3>
              {data.strengthProgress.length === 0 && <p className="text-sm text-text-muted">No records logged in this period.</p>}
              <ul className="divide-y divide-border text-sm">
                {data.strengthProgress.map((s) => (
                  <li key={s.exercise} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="font-semibold">{s.exercise}</span>
                      <span className="block text-xs text-text-muted">
                        {s.startValue} → {s.currentValue} {s.unit.toLowerCase()} · {s.newRecords} {s.newRecords === 1 ? "entry" : "entries"}
                      </span>
                    </span>
                    {s.changePercent !== null && <span className="tabular font-bold">{s.changePercent > 0 ? "+" : ""}{s.changePercent}%</span>}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="card mb-4 p-5">
            <h3 className="mb-1 font-heading text-base font-extrabold tracking-heading">Body measurements</h3>
            <p className="mb-3 text-xs text-text-muted">Private to the member unless they choose to share them with their trainer.</p>
            {!data.bodyMeasurements.sharedByMember ? (
              <p className="text-sm text-text-secondary">{data.bodyMeasurements.note ?? "The member has not shared body measurements."}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {data.bodyMeasurements.changes.map((c) => (
                  <li key={c.field} className="flex items-center justify-between py-2">
                    <span className="font-semibold">{FIELD_LABEL[c.field] ?? c.field}</span>
                    <span className="tabular">
                      {c.first} → {c.latest} <span className="font-bold">({c.change > 0 ? "+" : ""}{c.change})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h3 className="mb-3 font-heading text-base font-extrabold tracking-heading">Trainer notes</h3>
            {data.trainerNotes.length === 0 && <p className="text-sm text-text-muted">No notes in this period.</p>}
            <ul className="space-y-3 text-sm">
              {data.trainerNotes.map((n) => (
                <li key={n.id}>
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-text-muted">{formatDate(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
