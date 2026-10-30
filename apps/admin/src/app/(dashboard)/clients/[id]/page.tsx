"use client";

import { FormEvent, use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Trash2 } from "lucide-react";
import { api, ApiError } from "../../../../lib/api";
import { useFetch } from "../../../../lib/use-fetch";
import { useStaffUser } from "../../../../lib/staff-context";
import { formatDate, formatDateTime, fullName, WEEKDAYS } from "../../../../lib/format";
import { Avatar } from "../../../../components/ui/avatar";
import { Badge, MembershipStatusBadge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { TextAreaField } from "../../../../components/ui/field";
import { Tabs } from "../../../../components/ui/tabs";
import { ErrorState, Skeleton } from "../../../../components/ui/states";
import { StatCard } from "../../../../components/stat-card";
import { useToast } from "../../../../components/ui/toast";
import { ClientReport } from "../../../../components/coaching/client-report";

interface Detail {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
  createdAt: string;
  assignedCoach: { id: string; user: { firstName: string; lastName: string } } | null;
  membership: { plan: string; planType: string; status: string; endDate: string; daysRemaining: number } | null;
  progress: { workoutsCompleted: number; classesAttended: number; prCount: number; currentStreakDays: number; trainingDaysLast30: number; recentPrs: Array<{ id: string; value: string; unit: string; achievedAt: string; exercise: { name: string } }> };
  plans: Array<{ id: string; title: string; goal: string | null; startsOn: string; endsOn: string | null; items: Array<{ id: string; weekday: number; sets: number | null; reps: number | null; weightKg: string | null; exercise: { name: string } }>; adherence: { plannedDays: number; completedDays: number; percent: number | null } }>;
  notes: Array<{ id: string; body: string; createdAt: string; authorId: string; author: { id: string; firstName: string; lastName: string } | null }>;
  shared: { measurements: number; photos: number };
}
interface Shared {
  measurements: Array<{ id: string; measuredAt: string; weightKg: string | null; bodyFatPercent: string | null; chestCm: string | null; waistCm: string | null; hipsCm: string | null; armCm: string | null; thighCm: string | null; notes: string | null }>;
  photos: Array<{ id: string; takenAt: string; note: string | null }>;
}

function SharedBody({ clientId }: { clientId: string }) {
  const { data, error, reload } = useFetch<Shared>(`clients/${clientId}/body`);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="card p-5">
        <h3 className="mb-1 font-heading text-base font-extrabold tracking-heading">Shared measurements</h3>
        <p className="mb-3 text-xs text-text-muted">Only what the client chose to share with you.</p>
        {data.measurements.length === 0 && <p className="text-sm text-text-muted">Nothing shared yet.</p>}
        <ul className="divide-y divide-border text-sm">
          {data.measurements.map((m) => (
            <li key={m.id} className="py-2">
              <p className="font-semibold">{formatDate(m.measuredAt)}</p>
              <p className="text-xs text-text-secondary">
                {[m.weightKg && `${m.weightKg} kg`, m.bodyFatPercent && `${m.bodyFatPercent}% fat`, m.chestCm && `chest ${m.chestCm}`, m.waistCm && `waist ${m.waistCm}`, m.hipsCm && `hips ${m.hipsCm}`, m.armCm && `arm ${m.armCm}`, m.thighCm && `thigh ${m.thighCm}`].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-5">
        <h3 className="mb-1 font-heading text-base font-extrabold tracking-heading">Shared photos</h3>
        <p className="mb-3 text-xs text-text-muted">Viewing a photo is recorded. Do not save or forward a client&apos;s photos.</p>
        {data.photos.length === 0 && <p className="text-sm text-text-muted">No photos shared.</p>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.photos.map((p) => (
            <li key={p.id}>
              {/* An authenticated same-origin image through the proxy, so next/image cannot optimise it. */}
              <img src={`/api/proxy/body/photos/${p.id}/image`} alt={`Progress photo from ${formatDate(p.takenAt)}`} className="aspect-[3/4] w-full rounded-md border border-border object-cover" loading="lazy" />
              <p className="mt-1 text-xs text-text-muted">{formatDate(p.takenAt)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role } = useStaffUser();
  const toast = useToast();
  const { data: c, loading, error, reload } = useFetch<Detail>(`clients/${id}`);
  const [tab, setTab] = useState("overview");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function addNote(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`clients/${id}/notes`, { body: note });
      setNote("");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the note");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !c) return <Skeleton className="h-64 w-full" />;
  if (!c) return null;

  return (
    <div>
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Clients
      </Link>
      <div className="card mb-5 flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-4">
          <Avatar firstName={c.firstName} lastName={c.lastName} size="lg" />
          <div>
            <h1 className="heading-display text-2xl">{fullName(c)}</h1>
            <p className="text-sm text-text-secondary">
              {c.memberNumber} · Member since {formatDate(c.createdAt)}
              {c.assignedCoach && ` · Trainer ${fullName(c.assignedCoach.user)}`}
            </p>
            <div className="mt-2 flex gap-2">{c.membership ? <MembershipStatusBadge status={c.membership.status} /> : <Badge>No membership</Badge>}</div>
          </div>
        </div>
        <Link href={`/plans?client=${c.id}`} className="inline-flex h-10 items-center gap-2 rounded-pill bg-accent px-5 text-sm font-bold text-accent-contrast hover:bg-accent-hover">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Workout plans
        </Link>
      </div>

      <div className="mb-5">
        <Tabs
          label="Client sections"
          active={tab}
          onChange={setTab}
          items={[
            { id: "overview", label: "Overview" },
            { id: "report", label: "Progress report" },
            ...(role === "COACH" ? [{ id: "body", label: "Shared body data", count: c.shared.measurements + c.shared.photos }] : []),
          ]}
        />
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Workouts logged" value={c.progress.workoutsCompleted} />
            <StatCard label="Training days (30d)" value={c.progress.trainingDaysLast30} />
            <StatCard label="Current streak" value={`${c.progress.currentStreakDays} ${c.progress.currentStreakDays === 1 ? "day" : "days"}`} />
            <StatCard label="Personal records" value={c.progress.prCount} />
          </div>
          <section className="card p-5 xl:col-span-2">
            <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">Active plans</h2>
            {c.plans.length === 0 && <p className="text-sm text-text-muted">No active plan. Create one under Workout plans.</p>}
            <ul className="space-y-4">
              {c.plans.map((p) => (
                <li key={p.id}>
                  <p className="font-semibold">
                    {p.title} {p.adherence.percent !== null && <Badge variant={p.adherence.percent >= 70 ? "success" : "warning"}>{p.adherence.percent}% followed</Badge>}
                  </p>
                  <p className="text-xs text-text-muted">
                    {p.goal && `${p.goal} · `}from {formatDate(p.startsOn)}
                    {p.endsOn && ` to ${formatDate(p.endsOn)}`}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {Array.from(new Set(p.items.map((i) => i.weekday)))
                      .sort()
                      .map((d) => WEEKDAYS[d - 1])
                      .join(", ") || "No sessions yet"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">Recent records</h2>
            {c.progress.recentPrs.length === 0 && <p className="text-sm text-text-muted">No records yet.</p>}
            <ul className="divide-y divide-border text-sm">
              {c.progress.recentPrs.map((p) => (
                <li key={p.id} className="py-2">
                  <span className="font-semibold">{p.exercise.name}</span> <span className="text-text-secondary">{p.value} {p.unit.toLowerCase()}</span>
                  <p className="text-xs text-text-muted">{formatDate(p.achievedAt)}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-5 xl:col-span-3">
            <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">Notes</h2>
            <form onSubmit={addNote} className="mb-4">
              <TextAreaField label="Add a note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} hint="Notes are visible to staff only, never to the client." />
              <Button variant="primary" type="submit" loading={busy} disabled={!note.trim()}>
                Save note
              </Button>
            </form>
            {c.notes.length === 0 && <p className="text-sm text-text-muted">No notes yet.</p>}
            <ul className="divide-y divide-border">
              {c.notes.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                    <p className="text-xs text-text-muted">
                      {n.author ? fullName(n.author) : "Staff"} · {formatDateTime(n.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete note"
                    onClick={async () => {
                      try {
                        await api.delete(`trainer-notes/${n.id}`);
                        reload();
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : "Could not delete");
                      }
                    }}
                    className="rounded-pill p-2 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      {tab === "report" && <ClientReport clientId={c.id} />}
      {tab === "body" && role === "COACH" && <SharedBody clientId={c.id} />}
    </div>
  );
}
