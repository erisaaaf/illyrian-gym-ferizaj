"use client";

import { useState } from "react";
import { Button } from "./ui/button";

// Shown once, right after the Admin creates an account or resets a password.
// The API never returns the password again (only a hash is stored), and there
// is no email provider yet, so the Admin hands these to the person directly.
export function CredentialsPanel({
  name,
  email,
  password,
  audience,
}: {
  name: string;
  email: string;
  password: string;
  audience: "member" | "trainer";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Email: ${email}\nTemporary password: ${password}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mb-4">
      <p className="mb-3 text-sm text-text-secondary">
        <span className="font-medium text-text-primary">{name}</span> can now sign in to the Illyrian Gym mobile app
        {audience === "trainer" ? " as a trainer" : ""}. No email provider is configured yet, so give them these
        credentials directly. The password is shown <strong>only this once</strong>.
      </p>
      <div className="rounded-md border border-border bg-surface-elevated p-3">
        <p className="text-xs text-text-muted">Email</p>
        <p className="mb-2 text-sm text-text-primary">{email}</p>
        <p className="text-xs text-text-muted">Temporary password</p>
        <p className="font-mono text-sm text-text-primary" data-testid="temporary-password">
          {password}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? "Copied" : "Copy credentials"}
        </Button>
        <span className="text-xs text-text-muted">Lost it later? Use “Reset password” to issue a new one.</span>
      </div>
    </div>
  );
}
