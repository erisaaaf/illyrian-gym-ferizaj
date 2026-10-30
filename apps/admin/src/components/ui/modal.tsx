"use client";

import { ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Shared dialog behaviour: Escape closes (unless persistent), Tab stays inside, focus moves in on open and
 * returns to the opener on close, and the page behind does not scroll.
 */
function useDialog(open: boolean, onClose: () => void, persistent: boolean) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // always call the latest handler without re-running the effect (which would steal focus)

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), select, textarea") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !persistent) {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open, persistent]);

  return panelRef;
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Tailwind max-width class for the panel. */
  width?: string;
  /** Ignore outside-clicks and Escape; only the close button / explicit actions dismiss it (for one-time secrets). */
  persistent?: boolean;
  /** Sticky footer content (actions). */
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, description, children, width = "max-w-lg", persistent = false, footer }: DialogProps) {
  const titleId = useId();
  const panelRef = useDialog(open, onClose, persistent);
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink/60" onClick={persistent ? undefined : onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 flex max-h-[92vh] w-full ${width} animate-slide-up flex-col rounded-t-xl border border-border bg-surface shadow-modal outline-none sm:rounded-xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 id={titleId} className="font-heading text-lg font-extrabold tracking-heading text-text-primary">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-pill text-text-muted transition hover:bg-surface-sunken hover:text-text-primary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border bg-surface-elevated px-6 py-3 sm:rounded-b-xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Right-hand side panel for details and long forms. Full-screen on phones. */
export function Drawer({ open, onClose, title, description, children, width = "sm:max-w-xl", footer }: Omit<DialogProps, "persistent">) {
  const titleId = useId();
  const panelRef = useDialog(open, onClose, false);
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 flex h-full w-full ${width} animate-slide-in-right flex-col border-l border-border bg-surface shadow-modal outline-none`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 id={titleId} className="font-heading text-lg font-extrabold tracking-heading text-text-primary">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-pill text-text-muted transition hover:bg-surface-sunken hover:text-text-primary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border bg-surface-elevated px-6 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
