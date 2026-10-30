"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

/**
 * Confirmation for destructive or hard-to-reverse actions. If `onConfirm` throws, the dialog stays open and
 * shows the error instead of pretending the action worked.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The action failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={handleConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">{message}</p>
      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  );
}
