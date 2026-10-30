"use client";

import { FormEvent, useRef, useState } from "react";
import { Bot, FileSpreadsheet, FileText, Send } from "lucide-react";
import { api, ApiError, qs } from "../../../lib/api";
import { downloadFile, useFetch } from "../../../lib/use-fetch";
import { formatDate, formatMoney, fullName, PAYMENT_METHOD_LABEL } from "../../../lib/format";
import { PageHeader } from "../../../components/ui/page-header";
import { StatCard } from "../../../components/stat-card";
import { Button } from "../../../components/ui/button";
import { fieldClass } from "../../../components/ui/field";
import { Badge } from "../../../components/ui/badge";
import { DonutChart } from "../../../components/ui/charts";
import { ErrorState, Skeleton } from "../../../components/ui/states";
import { useToast } from "../../../components/ui/toast";

interface Monthly {
  month: string;
  period: { from: string; to: string; isComplete: boolean };
  finance: {
    receivedCents: number;
    billedCents: number;
    expensesCents: number;
    netCents: number;
    outstandingCents: number;
    overdueCents: number;
    previousPeriodReceivedCents: number;
    receivedChangePercent: number | null;
    byMethod: Array<{ method: string; cents: number; count: number }>;
    expensesByCategory: Array<{ category: string; cents: number }>;
  };
  members: { totalRegistered: number; activeAtEnd: number | null; newMembers: number; newMemberships: number; renewals: number; lost: number; renewalRatePercent: number | null };
  packagesSold: Array<{ name: string; cents: number; count: number }>;
  attendance: { totalVisits: number; uniqueMembers: number; peakHour: { hour: number; visits: number } | null };
  unpaidObligations: Array<{ id: string; firstName: string; lastName: string; memberNumber: string | null; balanceCents: number; overdueCents: number; openInvoices: number }>;
}
interface Answer {
  answer: string;
  intent: string;
  engine: string;
  data?: unknown;
}
interface Turn {
  question: string;
  answer?: Answer;
  error?: string;
}

const SUGGESTIONS = ["Sa kemi të hyra këtë muaj?", "How much did we earn this month?", "Cilat paketa shiten më shumë?", "Which memberships expire this week?", "Who has not visited recently?", "Who owes us money?"];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Plain-language assistant over the gym's own records. It queries the database; it is not a language model and says so. */
function Assistant() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setQuestion("");
    const index = turns.length;
    setTurns((t) => [...t, { question: q }]);
    try {
      const answer = await api.post<Answer>("admin/reports/assistant", { question: q });
      setTurns((t) => t.map((x, i) => (i === index ? { ...x, answer } : x)));
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === index ? { ...x, error: e instanceof ApiError ? e.message : "The assistant could not answer." } : x)));
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  return (
    <section className="card p-5" aria-labelledby="assistant-title">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-ink text-lime" aria-hidden="true">
          <Bot className="h-4 w-4" />
        </span>
        <h2 id="assistant-title" className="font-heading text-lg font-extrabold tracking-heading">
          Business assistant
        </h2>
        <Badge variant="info">Reads your records</Badge>
      </div>
      <p className="mb-4 text-xs text-text-muted">Ask in Albanian or English. Answers come straight from the gym&apos;s database (payments, memberships, visits): the assistant does not guess, and says when it does not understand.</p>

      <div className="mb-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => ask(s)} disabled={busy} className="rounded-pill border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-sunken disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      <div className="mb-3 max-h-96 space-y-3 overflow-y-auto" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-ink px-3.5 py-2 text-sm text-mint">{t.question}</p>
            {t.error ? (
              <p role="alert" className="max-w-[90%] rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2 text-sm text-danger">
                {t.error}
              </p>
            ) : t.answer ? (
              <div className="max-w-[90%] rounded-lg bg-surface-elevated px-3.5 py-2.5 text-sm">
                <p>{t.answer.answer}</p>
                {t.answer.data !== undefined && (
                  <details className="mt-2 text-xs text-text-muted">
                    <summary className="cursor-pointer font-semibold">Show the records behind this answer</summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-surface p-2">{JSON.stringify(t.answer.data, null, 2)}</pre>
                  </details>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-muted">Looking at the records…</p>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input className={fieldClass} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about revenue, packages, expiring memberships…" aria-label="Your question" maxLength={500} disabled={busy} />
        <Button variant="primary" type="submit" loading={busy} disabled={!question.trim()} aria-label="Ask">
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </section>
  );
}

export default function ReportsPage() {
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const { data, loading, error, reload } = useFetch<Monthly>(`admin/reports/monthly${qs({ month })}`);
  const [busy, setBusy] = useState<string | null>(null);

  async function exportMonth(format: "xlsx" | "pdf") {
    setBusy(format);
    try {
      await downloadFile(`admin/reports/monthly/export${qs({ month, format })}`, `monthly-report-${month}.${format}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The export failed");
    } finally {
      setBusy(null);
    }
  }

  const f = data?.finance;
  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Business reports"
        description="The monthly report for the owner: money received, spending, members, packages and what is still unpaid."
        action={
          <>
            <label className="flex items-center gap-2 text-xs font-bold text-text-muted">
              Month
              <input type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-10 rounded-pill border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:border-ink" />
            </label>
            <Button variant="secondary" onClick={() => exportMonth("xlsx")} loading={busy === "xlsx"}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Excel
            </Button>
            <Button variant="secondary" onClick={() => exportMonth("pdf")} loading={busy === "pdf"}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              PDF
            </Button>
          </>
        }
      />

      <div className="mb-6">
        <Assistant />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-64 w-full" />}
      {data && f && (
        <div className={loading ? "opacity-60 transition" : "transition"}>
          <p className="mb-3 text-xs text-text-muted">
            {formatDate(data.period.from)} – {formatDate(data.period.to)} {!data.period.isComplete && "· month still in progress"}
          </p>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Received" value={formatMoney(f.receivedCents)} trend={{ percent: f.receivedChangePercent, label: "vs previous month" }} />
            <StatCard label="Expenses" value={formatMoney(f.expensesCents)} />
            <StatCard label="Net" value={formatMoney(f.netCents)} tone={f.netCents < 0 ? "danger" : "neutral"} hint="Received − expenses" />
            <StatCard label="Billed" value={formatMoney(f.billedCents)} hint="Invoiced, not yet revenue" />
          </div>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="New members" value={data.members.newMembers} />
            <StatCard label="Memberships sold" value={data.members.newMemberships} hint={`${data.members.renewals} renewals`} />
            <StatCard label="Gym visits" value={data.attendance.totalVisits} hint={`${data.attendance.uniqueMembers} different members`} />
            <StatCard label="Renewal rate" value={data.members.renewalRatePercent === null ? null : `${data.members.renewalRatePercent}%`} />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className="card p-5">
              <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">Received by method</h2>
              <DonutChart ariaLabel="Money received by payment method" centerLabel="payments" segments={f.byMethod.map((m) => ({ label: PAYMENT_METHOD_LABEL[m.method] ?? m.method, value: m.count }))} />
              <ul className="mt-3 space-y-1 text-sm">
                {f.byMethod.map((m) => (
                  <li key={m.method} className="flex justify-between">
                    <span className="text-text-secondary">{PAYMENT_METHOD_LABEL[m.method] ?? m.method}</span>
                    <span className="tabular font-bold">{formatMoney(m.cents)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card p-5">
              <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">Packages sold</h2>
              {data.packagesSold.length === 0 && <p className="text-sm text-text-muted">No package revenue this month.</p>}
              <ul className="divide-y divide-border text-sm">
                {data.packagesSold.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {p.name} <span className="text-xs text-text-muted">× {p.count}</span>
                    </span>
                    <span className="tabular font-bold">{formatMoney(p.cents)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card p-5">
              <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">Expenses by category</h2>
              {f.expensesByCategory.length === 0 && <p className="text-sm text-text-muted">No expenses recorded this month.</p>}
              <ul className="divide-y divide-border text-sm">
                {f.expensesByCategory.map((c) => (
                  <li key={c.category} className="flex justify-between py-2">
                    <span className="capitalize text-text-secondary">{c.category.toLowerCase()}</span>
                    <span className="tabular font-bold">{formatMoney(c.cents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="card p-5">
            <h2 className="mb-1 font-heading text-base font-extrabold tracking-heading">Unpaid right now</h2>
            <p className="mb-3 text-xs text-text-muted">
              {formatMoney(f.outstandingCents)} outstanding, of which {formatMoney(f.overdueCents)} is overdue. Not limited to the month.
            </p>
            {data.unpaidObligations.length === 0 && <p className="text-sm text-text-muted">Nobody owes anything.</p>}
            <ul className="divide-y divide-border text-sm">
              {data.unpaidObligations.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {fullName(d)} <span className="text-xs text-text-muted">{d.memberNumber} · {d.openInvoices} open</span>
                  </span>
                  <span className="tabular font-bold">{formatMoney(d.balanceCents)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
