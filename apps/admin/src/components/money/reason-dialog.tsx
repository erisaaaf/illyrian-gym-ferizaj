"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import { TextAreaField } from "../ui/field";
import { Button } from "../ui/button";

/**
 * Asks for the written reason that every correction of a money record requires. The reason is kept with the
 * change in the audit history, so the original record is never silently altered.
 */
export function ReasonDialog({
  open,
  onClose,
  onSubmit,
  title,
  description,
  confirmLabel,
  danger,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} type="submit" form="reason-form" loading={busy} disabled={reason.trim().length < 3}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id="reason-form" onSubmit={submit}>
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        {children}
        <TextAreaField label="Reason" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} hint="Required. Saved in the audit history with who made the change and when." />
      </form>
    </Modal>
  );
}
