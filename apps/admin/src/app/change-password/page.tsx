"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { TextField } from "../../components/ui/field";

/**
 * First sign-in with a temporary password. The API refuses everything else until the password is changed, so this
 * page is the only way forward. Afterwards the person signs in again with the password they chose.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) return setError("The two new passwords do not match.");
    setLoading(true);
    try {
      await api.post("auth/change-password", { currentPassword: current, newPassword: next });
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      router.push("/login?changed=1");
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.validation?.[0] ?? err.message) : "Could not change the password. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-8">
        <Image src="/brand/logo.png" alt="Illyrian Gym" width={48} height={48} className="mb-6 h-12 w-12 rounded-full" priority />
        <p className="eyebrow mb-2">First sign-in</p>
        <h1 className="heading-display text-3xl">Choose your password</h1>
        <p className="mb-6 mt-3 text-sm text-text-secondary">You signed in with a temporary password. Choose your own before you continue. Only you should know it.</p>
        {error && (
          <div role="alert" className="mb-5 rounded-md border border-danger/25 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
            {error}
          </div>
        )}
        <TextField label="Temporary password" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <TextField label="New password" type="password" required autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} hint="At least 10 characters, with an uppercase letter, a lowercase letter and a number." />
        <TextField label="Repeat new password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-2 w-full">
          {!loading && <KeyRound className="h-4 w-4" aria-hidden="true" />}
          Save password
        </Button>
      </form>
    </main>
  );
}
