"use client";

import Image from "next/image";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "../../components/ui/button";
import { TextField } from "../../components/ui/field";

function LoginForm() {
  const router = useRouter();
  const changed = useSearchParams().get("changed") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Login failed. Please try again.");
        return;
      }
      // A temporary password (new account or reset) must be replaced before anything else works.
      router.push(data.user?.mustChangePassword ? "/change-password" : "/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel: the website's hero photograph and headline treatment */}
      <section className="relative hidden overflow-hidden bg-ink lg:block" aria-hidden="true">
        <Image src="/brand/hero.jpg" alt="" fill priority sizes="55vw" className="object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/20" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="text-[11px] font-bold uppercase tracking-eyebrow text-lime">Illyrian Gym &amp; CrossFit</p>
          <p className="heading-display mt-4 text-6xl text-white">
            Stërvitu fort.
            <br />
            <span className="text-lime">Jeto fort.</span>
          </p>
          <p className="mt-4 max-w-sm text-sm text-white/70">Ferizaj, Kosovë</p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-background px-5 py-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm" noValidate={false}>
          <Image src="/brand/logo.png" alt="Illyrian Gym" width={56} height={56} className="mb-8 h-14 w-14 rounded-full" priority />
          <p className="eyebrow mb-2">Staff portal</p>
          <h1 className="heading-display text-4xl text-text-primary">Sign in</h1>
          <p className="mb-8 mt-3 text-sm text-text-secondary">Administrators, reception and trainers. Members use the mobile app.</p>

          {!error && changed && (
            <div role="status" className="mb-5 rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm font-medium text-success">
              Password saved. Sign in with your new password.
            </div>
          )}
          {error && (
            <div role="alert" className="mb-5 rounded-md border border-danger/25 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
              {error}
            </div>
          )}

          <TextField label="Email" id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />

          <div className="relative">
            <TextField label="Password" id="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-[30px] inline-flex h-8 w-8 items-center justify-center rounded-pill text-text-muted hover:bg-surface-sunken hover:text-text-primary"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-2 w-full">
            {!loading && <LogIn className="h-4 w-4" aria-hidden="true" />}
            {loading ? "Signing in..." : "Sign in"}
          </Button>

          <p className="mt-6 text-center text-xs text-text-muted">Accounts are created by the gym. Forgot your password? Ask the owner or reception to reset it.</p>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
