"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { CredentialsPanel } from "./credentials-panel";

export function ResetPasswordModal({
  open,
  onClose,
  name,
  path,
  audience,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  /** API path that issues the new password, e.g. admin/members/<id>/reset-password */
  path: string;
  audience: "member" | "trainer";
}) {
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
    }
  }, [open]);

  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.post<{ email: string; temporaryPassword: string }>(path));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset the password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Reset password" width="max-w-md" persistent={result !== null}>
      {result ? (
        <>
          <CredentialsPanel name={name} email={result.email} password={result.temporaryPassword} audience={audience} />
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-text-secondary">
            Issue a new temporary password for <span className="font-medium text-text-primary">{name}</span>? Their
            current password stops working and they are signed out on every device.
          </p>
          {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm} loading={loading}>
              Reset password
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
