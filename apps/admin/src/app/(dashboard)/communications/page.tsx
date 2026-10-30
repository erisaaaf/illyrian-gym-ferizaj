"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";
import { api, ApiError, qs } from "../../../lib/api";
import { useFetch } from "../../../lib/use-fetch";
import { useStaffUser } from "../../../lib/staff-context";
import { formatDateTime, fullName } from "../../../lib/format";
import { PageHeader } from "../../../components/ui/page-header";
import { Button } from "../../../components/ui/button";
import { SelectField, TextAreaField, TextField } from "../../../components/ui/field";
import { Badge } from "../../../components/ui/badge";
import { Drawer } from "../../../components/ui/modal";
import { DataEmptyState, ErrorState, Skeleton } from "../../../components/ui/states";
import { Pagination } from "../../../components/ui/table";
import { useToast } from "../../../components/ui/toast";
import { MemberPicker, PickedMember } from "../../../components/money/member-picker";

type Audience = "INDIVIDUAL" | "ALL_ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "UNPAID" | "AT_RISK" | "ASSIGNED_CLIENTS";

// Mirrors what the API allows per role; the API enforces it regardless of what this list shows.
const AUDIENCES: Record<string, Array<{ value: Audience; label: string }>> = {
  ADMIN: [
    { value: "INDIVIDUAL", label: "One member" },
    { value: "ALL_ACTIVE", label: "All active members" },
    { value: "EXPIRING_SOON", label: "Memberships ending soon" },
    { value: "EXPIRED", label: "Expired memberships" },
    { value: "UNPAID", label: "Members with unpaid invoices" },
    { value: "AT_RISK", label: "Members not visiting" },
  ],
  RECEPTIONIST: [
    { value: "INDIVIDUAL", label: "One member" },
    { value: "EXPIRING_SOON", label: "Memberships ending soon" },
    { value: "EXPIRED", label: "Expired memberships" },
    { value: "UNPAID", label: "Members with unpaid invoices" },
  ],
  COACH: [
    { value: "INDIVIDUAL", label: "One of my clients" },
    { value: "ASSIGNED_CLIENTS", label: "All my clients" },
  ],
};
const TYPES = [
  { value: "MESSAGE", label: "Message" },
  { value: "MEMBERSHIP_EXPIRING", label: "Membership reminder" },
  { value: "OFFER", label: "Offer" },
  { value: "SCHEDULE_CHANGE", label: "Schedule change" },
];

interface Sent {
  id: string;
  subject: string;
  body: string;
  type: string;
  audience: string;
  recipientCount: number;
  delivered: number;
  read: number;
  createdAt: string;
  sentBy: { firstName: string; lastName: string } | null;
}
interface HistoryPage {
  data: Sent[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
interface Preview {
  recipientCount: number;
  sample: Array<{ firstName: string; lastName: string; memberNumber: string | null }>;
}
interface Detail extends Sent {
  recipients: Array<{ user: { id: string; firstName: string; lastName: string; memberNumber: string | null }; deliveredInApp: boolean; readAt: string | null }>;
}

function audienceLabel(a: string) {
  return Object.values(AUDIENCES).flat().find((x) => x.value === a)?.label ?? a;
}

function Compose({ onSent }: { onSent: () => void }) {
  const { role } = useStaffUser();
  const toast = useToast();
  const options = AUDIENCES[role] ?? [];
  const [audience, setAudience] = useState<Audience>(options[0]?.value ?? "INDIVIDUAL");
  const [member, setMember] = useState<PickedMember | null>(null);
  const [type, setType] = useState("MESSAGE");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payload = { audience, subject, body, ...(audience === "INDIVIDUAL" ? { userId: member?.id } : {}), ...(role !== "COACH" ? { type } : {}) };

  async function doPreview() {
    setBusy("preview");
    setError(null);
    try {
      setPreview(await api.post<Preview>("messages/preview", payload));
    } catch (e) {
      setPreview(null);
      setError(e instanceof ApiError ? (e.errors?.validation?.[0] ?? e.message) : "Could not check the audience.");
    } finally {
      setBusy(null);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!preview) return void doPreview();
    setBusy("send");
    setError(null);
    try {
      const r = await api.post<{ recipientCount: number }>("messages", payload);
      toast.success(`Sent to ${r.recipientCount} ${r.recipientCount === 1 ? "member" : "members"}`);
      setSubject("");
      setBody("");
      setPreview(null);
      setMember(null);
      onSent();
    } catch (e2) {
      setError(e2 instanceof ApiError ? (e2.errors?.validation?.[0] ?? e2.message) : "Could not send.");
    } finally {
      setBusy(null);
    }
  }

  const ready = subject.trim() && body.trim() && (audience !== "INDIVIDUAL" || member);

  return (
    <form onSubmit={send} className="card p-5" aria-labelledby="compose-title">
      <h2 id="compose-title" className="mb-1 font-heading text-lg font-extrabold tracking-heading">
        New message
      </h2>
      <p className="mb-4 text-xs text-text-muted">Sent to the member&apos;s notifications in the Illyrian Gym app. E-mail, SMS and push messages are not set up, so none are sent.</p>
      {error && (
        <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <SelectField
          label="To"
          value={audience}
          onChange={(e) => {
            setAudience(e.target.value as Audience);
            setPreview(null);
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        {role !== "COACH" && (
          <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      {audience === "INDIVIDUAL" && <MemberPicker value={member} onChange={(m) => (setMember(m), setPreview(null))} />}
      <TextField label="Subject" required maxLength={120} value={subject} onChange={(e) => (setSubject(e.target.value), setPreview(null))} />
      <TextAreaField label="Message" required rows={5} maxLength={2000} value={body} onChange={(e) => (setBody(e.target.value), setPreview(null))} hint={`${body.length}/2000`} />

      {preview && (
        <div className="mb-4 rounded-lg bg-surface-elevated p-4 text-sm" role="status">
          <p className="font-semibold">
            This will reach {preview.recipientCount} {preview.recipientCount === 1 ? "member" : "members"}
            {preview.sample.length > 0 && <span className="font-medium text-text-secondary"> — for example {preview.sample.slice(0, 3).map(fullName).join(", ")}</span>}.
          </p>
          <p className="mt-1 text-xs text-text-muted">Check the audience, then press Send message.</p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        {preview && (
          <Button variant="ghost" onClick={doPreview} loading={busy === "preview"}>
            Recheck audience
          </Button>
        )}
        <Button variant="primary" type="submit" loading={busy !== null} disabled={!ready || (preview?.recipientCount === 0)}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {preview ? "Send message" : "Check audience"}
        </Button>
      </div>
    </form>
  );
}

function DetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, reload } = useFetch<Detail>(`messages/${id}`);
  return (
    <Drawer open onClose={onClose} title={data?.subject ?? "Message"} description={data ? `${audienceLabel(data.audience)} · ${formatDateTime(data.createdAt)}` : undefined}>
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div>
          <p className="mb-4 whitespace-pre-wrap text-sm">{data.body}</p>
          <p className="mb-2 text-xs text-text-muted">
            In the app: {data.delivered} · Read: {data.read} of {data.recipientCount}
          </p>
          <ul className="divide-y divide-border">
            {data.recipients.map((r) => (
              <li key={r.user.id} className="flex items-center justify-between py-2 text-sm">
                <span>{fullName(r.user)}</span>
                {r.readAt ? <Badge variant="success">Read {formatDateTime(r.readAt)}</Badge> : <Badge>Delivered, unread</Badge>}
              </li>
            ))}
          </ul>
          {data.recipientCount > data.recipients.length && <p className="mt-2 text-xs text-text-muted">Showing the first {data.recipients.length} recipients.</p>}
        </div>
      )}
    </Drawer>
  );
}

export default function CommunicationsPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, loading, error, reload } = useFetch<HistoryPage>(`messages${qs({ page, pageSize: 10 })}`);

  return (
    <div>
      <PageHeader eyebrow="Communication" title="Messages" description="Write to members individually or by group, and see who has actually received and read it." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Compose onSent={reload} />
        </div>
        <section className="xl:col-span-2" aria-labelledby="history-title">
          <h2 id="history-title" className="mb-3 font-heading text-lg font-extrabold tracking-heading">
            Sent messages
          </h2>
          {error && <ErrorState message={error} onRetry={reload} />}
          {loading && !data && <Skeleton className="h-40 w-full" />}
          {data && data.data.length === 0 && <DataEmptyState title="Nothing sent yet" message="Messages you send appear here with their delivery and read counts." />}
          <ul className="space-y-3">
            {data?.data.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setOpen(m.id)} className="card block w-full p-4 text-left transition hover:border-border-strong hover:shadow-popover">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{m.subject}</p>
                    <Badge variant="accent">{audienceLabel(m.audience)}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{m.body}</p>
                  <p className="mt-2 text-xs text-text-muted">
                    {formatDateTime(m.createdAt)} · {m.sentBy ? fullName(m.sentBy) : "—"} · {m.delivered} delivered · {m.read} read
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />}
        </section>
      </div>
      {open && <DetailDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
