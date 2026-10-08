"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/page-header";
import { TextField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { LoadingState } from "../../../components/ui/states";

interface Me {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

interface GymSettings {
  name: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  updatedAt: string | null;
}

interface SystemInfo {
  environment: string;
  integrations: { email: boolean; pushNotifications: boolean; aiCoach: boolean; fileStorage: boolean };
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Your account, the gym's own details, and what's actually connected." />
      <div className="flex max-w-3xl flex-col gap-6">
        <AccountSection />
        <PasswordSection />
        <GymSection />
        <SystemSection />
      </div>
    </div>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      {description && <p className="mb-4 mt-1 text-xs text-text-muted">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Feedback({ ok, error }: { ok: string | null; error: string | null }) {
  if (error) return <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>;
  if (ok) return <p className="mb-3 rounded-md border border-success/30 bg-success/10 p-2 text-sm text-success">{ok}</p>;
  return null;
}

function AccountSection() {
  const [me, setMe] = useState<Me | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Me>("users/me").then((m) => {
      setMe(m);
      setFirstName(m.firstName);
      setLastName(m.lastName);
      setPhone(m.phone ?? "");
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setOk(null);
    setError(null);
    try {
      await api.patch("users/me", { firstName, lastName, phone: phone || undefined });
      setOk("Profile saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!me) return <LoadingState label="Loading your profile..." />;

  return (
    <Card title="Admin profile">
      <form onSubmit={onSubmit}>
        <Feedback ok={ok} error={error} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <TextField label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <TextField label="Email" value={me.email} disabled readOnly hint="Your login. It can't be changed here." />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button type="submit" loading={saving}>
          Save profile
        </Button>
      </form>
    </Card>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    setError(null);
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await api.post("auth/change-password", { currentPassword: current, newPassword: next });
      setOk("Password changed. Your other devices are signed out.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.validation?.join(" ") ?? err.message) : "Could not change your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Password & security" description="At least 10 characters with an uppercase letter, a lowercase letter and a number.">
      <form onSubmit={onSubmit}>
        <Feedback ok={ok} error={error} />
        <TextField label="Current password" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <TextField label="New password" type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <TextField label="Confirm new password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit" loading={saving}>
          Change password
        </Button>
      </form>
    </Card>
  );
}

function GymSection() {
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<GymSettings>("admin/settings/gym").then((s) => {
      setSettings(s);
      setName(s.name ?? "");
      setContactEmail(s.contactEmail ?? "");
      setContactPhone(s.contactPhone ?? "");
      setAddress(s.address ?? "");
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setOk(null);
    setError(null);
    try {
      const saved = await api.patch<GymSettings>("admin/settings/gym", {
        name: name || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        address: address || undefined,
      });
      setSettings(saved);
      setOk("Gym details saved.");
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.validation?.join(" ") ?? err.message) : "Could not save gym details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Gym details"
      description="Entered by you - nothing is pre-filled, and no official details are assumed."
    >
      {settings && !settings.updatedAt && (
        <p className="mb-3 text-sm text-text-secondary">Not configured yet. Fill these in when you&apos;re ready.</p>
      )}
      <form onSubmit={onSubmit}>
        <Feedback ok={ok} error={error} />
        <TextField label="Gym name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Contact email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <TextField label="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
        <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Button type="submit" loading={saving}>
          Save gym details
        </Button>
      </form>
    </Card>
  );
}

function SystemSection() {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    api.get<SystemInfo>("admin/settings/system").then(setInfo);
  }, []);

  if (!info) return null;

  const rows: Array<[string, boolean, string]> = [
    ["Email delivery", info.integrations.email, "Without it, credentials are shown to you when you create accounts."],
    ["Push notifications", info.integrations.pushNotifications, "Needs Firebase credentials."],
    ["AI Coach", info.integrations.aiCoach, "Needs an OpenAI API key."],
    ["File storage", info.integrations.fileStorage, "Needed for profile and announcement images."],
  ];

  return (
    <Card title="System" description={`Read-only. These reflect the server's actual configuration (environment: ${info.environment}).`}>
      <div className="flex flex-col gap-2">
        {rows.map(([label, on, note]) => (
          <div key={label} className="flex items-center justify-between rounded-md border border-border/60 bg-surface-elevated px-3 py-2">
            <div>
              <p className="text-sm text-text-primary">{label}</p>
              <p className="text-xs text-text-muted">{note}</p>
            </div>
            <Badge variant={on ? "success" : "neutral"}>{on ? "Configured" : "Not configured"}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
