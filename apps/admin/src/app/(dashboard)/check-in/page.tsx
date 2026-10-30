"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Clock, ScanLine, XCircle } from "lucide-react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { useFetch } from "../../../lib/use-fetch";
import { formatDate, formatTime, fullName } from "../../../lib/format";
import { PageHeader } from "../../../components/ui/page-header";
import { StatCard } from "../../../components/stat-card";
import { Button } from "../../../components/ui/button";
import { fieldClass } from "../../../components/ui/field";
import { Badge, PaymentStatusBadge } from "../../../components/ui/badge";
import { DataEmptyState } from "../../../components/ui/states";
import { RecordPaymentModal } from "../../../components/money/record-payment-modal";

interface Outcome {
  outcome: string;
  allowed: boolean;
  message: string;
  member: { id?: string; name?: string; memberNumber?: string | null; assignedTrainer?: string | null } | null;
  membership: { status: string; plan: string; endDate: string; daysRemaining: number; paymentStatus: string } | null;
  visitCount?: number;
  duplicateOf?: string;
}
interface Today {
  count: number;
  uniqueMembers: number;
  recent: Array<{ id: string; checkedInAt: string; method: string; user: { id: string; firstName: string; lastName: string; memberNumber: string | null }; membership: { plan: { name: string } } | null }>;
}
interface Found {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
  membershipStatus: string;
}

// What the desk sees at a glance: green = let them in, amber = let them in but mention something, red = stop.
const TONE = {
  ok: { box: "border-success/40 bg-success/10", icon: CheckCircle2, color: "text-success" },
  warn: { box: "border-warning/40 bg-warning/10", icon: AlertTriangle, color: "text-warning" },
  stop: { box: "border-danger/40 bg-danger/10", icon: XCircle, color: "text-danger" },
} as const;

function toneOf(o: Outcome): keyof typeof TONE {
  if (o.outcome === "OK") return o.membership?.status === "EXPIRING_SOON" || o.membership?.paymentStatus === "PARTIAL" ? "warn" : "ok";
  if (o.outcome === "DUPLICATE") return "warn";
  return "stop";
}

// A real QR token is `IGM1.<uuid>.<n>.<signature>`; staff may also type a member number (IG-01013) or a name.
const looksLikeQr = (v: string) => /^IGM1\./i.test(v.trim());
const looksLikeNumber = (v: string) => /^[A-Za-z]{1,4}-?\d{2,}$/.test(v.trim());

declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>> };
  }
}

export default function CheckInPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const debounced = useDebouncedValue(value, 250);
  const [result, setResult] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found[]>([]);
  const [pay, setPay] = useState<{ id: string; firstName: string; lastName: string; memberNumber: string | null } | null>(null);
  const [camera, setCamera] = useState(false);
  const today = useFetch<Today>("admin/check-in/today");

  // The scanner types into this field like a keyboard, so it must always be ready for the next member.
  const focus = useCallback(() => inputRef.current?.focus(), []);
  useEffect(focus, [focus]);

  // Name search for manual lookup (only for text that is not a scan or a member number).
  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2 || looksLikeQr(q) || looksLikeNumber(q)) {
      setFound([]);
      return;
    }
    let live = true;
    api
      .get<{ data: Found[] }>(`admin/members${qs({ search: q, pageSize: 6 })}`)
      .then((r) => live && setFound(r.data))
      .catch(() => live && setFound([]));
    return () => {
      live = false;
    };
  }, [debounced]);

  const submit = useCallback(
    async (body: { code?: string; memberNumber?: string; userId?: string }) => {
      setBusy(true);
      setError(null);
      try {
        const r = await api.post<Outcome>("admin/check-in", body);
        setResult(r);
        today.reload();
      } catch (e) {
        setResult(null);
        setError(e instanceof ApiError ? e.message : "Check-in failed. Try again.");
      } finally {
        setBusy(false);
        setValue("");
        setFound([]);
        focus();
      }
    },
    [today, focus],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    if (looksLikeQr(v)) void submit({ code: v });
    else if (looksLikeNumber(v)) void submit({ memberNumber: v });
    else if (found.length === 1) void submit({ userId: found[0].id });
  }

  const tone = result ? TONE[toneOf(result)] : null;

  return (
    <div>
      <PageHeader
        eyebrow="Front desk"
        title="Check-in"
        description="Scan the member's QR code, or type their member number or name. Entry is always checked against their live membership."
        action={
          typeof window !== "undefined" && "BarcodeDetector" in window ? (
            <Button variant="secondary" onClick={() => setCamera((c) => !c)} aria-pressed={camera}>
              <Camera className="h-4 w-4" aria-hidden="true" />
              {camera ? "Stop camera" : "Use camera"}
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <form onSubmit={onSubmit} className="card mb-4 p-5">
            <label htmlFor="scan" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
              <ScanLine className="h-4 w-4" aria-hidden="true" />
              Scan or type
            </label>
            <input
              id="scan"
              ref={inputRef}
              className={`${fieldClass} !py-4 text-lg`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Scan QR code · IG-01013 · or a name"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={busy}
              aria-describedby="scan-help"
            />
            <p id="scan-help" className="mt-2 text-xs text-text-muted">
              A hardware scanner types the code and presses Enter by itself. Press Enter to check in a member number.
            </p>
            {found.length > 0 && (
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border-strong">
                {found.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 bg-surface px-4 py-2.5 text-sm">
                    <span>
                      <span className="font-semibold">{fullName(m)}</span> <span className="text-xs text-text-muted">{m.memberNumber}</span>
                    </span>
                    <Button size="sm" variant="primary" onClick={() => void submit({ userId: m.id })}>
                      Check in
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          {camera && <CameraScanner onCode={(code) => void submit({ code })} onStop={() => setCamera(false)} />}

          <div aria-live="assertive" aria-atomic="true">
            {error && (
              <div role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-5 text-sm font-semibold text-danger">
                {error}
              </div>
            )}
            {result && tone && (
              <div className={`mb-4 rounded-lg border-2 p-6 ${tone.box}`}>
                <div className="flex items-start gap-4">
                  <tone.icon className={`h-10 w-10 shrink-0 ${tone.color}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className={`font-heading text-2xl font-extrabold tracking-heading ${tone.color}`}>{result.allowed ? "Welcome in" : result.outcome === "DUPLICATE" ? "Already in" : "Do not admit"}</p>
                    <p className="mt-0.5 text-base font-semibold text-text-primary">{result.message}</p>
                    {result.member?.name && (
                      <div className="mt-4">
                        <p className="font-heading text-xl font-extrabold tracking-heading">
                          {result.member.id ? (
                            <Link href={`/members/${result.member.id}`} className="hover:underline">
                              {result.member.name}
                            </Link>
                          ) : (
                            result.member.name
                          )}
                        </p>
                        <p className="tabular text-sm text-text-secondary">
                          {result.member.memberNumber}
                          {result.member.assignedTrainer && ` · Trainer ${result.member.assignedTrainer}`}
                          {result.visitCount !== undefined && ` · visit #${result.visitCount}`}
                        </p>
                      </div>
                    )}
                    {result.membership && (
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wider text-text-muted">Package</dt>
                          <dd className="font-semibold">{result.membership.plan}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wider text-text-muted">Ends</dt>
                          <dd className="font-semibold">
                            {formatDate(result.membership.endDate)} ({result.membership.daysRemaining}d)
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wider text-text-muted">Payment</dt>
                          <dd>
                            <PaymentStatusBadge status={result.membership.paymentStatus} />
                          </dd>
                        </div>
                      </dl>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {result.member?.id && result.membership && (result.membership.paymentStatus !== "PAID" || ["EXPIRED", "EXPIRING_SOON"].includes(result.membership.status)) && (
                        <>
                          {result.membership.paymentStatus !== "PAID" && (
                            <Button size="sm" variant="secondary" onClick={() => setPay({ id: result.member!.id!, firstName: result.member!.name!.split(" ")[0], lastName: result.member!.name!.split(" ").slice(1).join(" "), memberNumber: result.member!.memberNumber ?? null })}>
                              Record payment
                            </Button>
                          )}
                          <Link href={`/members/${result.member.id}`} className="inline-flex h-8 items-center rounded-pill border border-border-strong bg-surface px-3.5 text-xs font-semibold hover:bg-surface-sunken">
                            Open profile to renew
                          </Link>
                        </>
                      )}
                      {result.member?.id && !result.allowed && result.outcome !== "DUPLICATE" && result.outcome !== "INVALID_CODE" && result.outcome !== "NOT_FOUND" && (
                        <Link href={`/members/${result.member.id}`} className="inline-flex h-8 items-center rounded-pill bg-accent px-3.5 text-xs font-bold text-accent-contrast hover:bg-accent-hover">
                          Open profile
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!result && !error && (
              <div className="card flex items-center gap-3 p-6 text-sm text-text-muted">
                <Clock className="h-5 w-5" aria-hidden="true" />
                Waiting for the next member…
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <StatCard label="Today" value={today.data?.count} />
            <StatCard label="Members" value={today.data?.uniqueMembers} />
          </div>
          <section className="card p-5">
            <h2 className="mb-3 font-heading text-base font-extrabold tracking-heading">Today&apos;s entries</h2>
            {today.data && today.data.recent.length === 0 ? (
              <DataEmptyState title="Nobody yet" message="Entries show up here as members check in." />
            ) : (
              <ul className="divide-y divide-border">
                {today.data?.recent.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/members/${v.user.id}`} className="font-semibold hover:underline">
                        {fullName(v.user)}
                      </Link>
                      <p className="truncate text-xs text-text-muted">{v.membership ? v.membership.plan.name : "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={v.method === "QR" ? "accent" : "neutral"}>{v.method === "QR" ? "QR" : "Desk"}</Badge>
                      <span className="tabular text-xs text-text-muted">{formatTime(v.checkedInAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      {pay && <RecordPaymentModal open onClose={() => { setPay(null); focus(); }} onDone={() => undefined} member={pay} />}
    </div>
  );
}

/** Optional webcam scanning via the browser's BarcodeDetector (not available everywhere - the field above always works). */
function CameraScanner({ onCode, onStop }: { onCode: (code: string) => void; onStop: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let last = "";
    let lastAt = 0;
    (async () => {
      try {
        const Detector = window.BarcodeDetector;
        if (!Detector) throw new Error("This browser cannot scan QR codes. Use the scanner field.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({ formats: ["qr_code"] });
        timer = setInterval(async () => {
          if (!videoRef.current) return;
          const codes = await detector.detect(videoRef.current).catch(() => []);
          const raw = codes[0]?.rawValue;
          // The same code held in front of the camera must not check the member in repeatedly.
          if (raw && looksLikeQr(raw) && (raw !== last || Date.now() - lastAt > 6000)) {
            last = raw;
            lastAt = Date.now();
            onCode(raw);
          }
        }, 400);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open the camera.");
      }
    })();
    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="card mb-4 overflow-hidden">
      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 p-4 text-sm text-danger">
          {error}
          <Button size="sm" variant="secondary" onClick={onStop}>
            Close
          </Button>
        </div>
      ) : (
        <video ref={videoRef} className="aspect-video w-full bg-ink object-cover" muted playsInline aria-label="Camera view for scanning member QR codes" />
      )}
    </div>
  );
}
