"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ toast: (kind: ToastKind, message: string) => void } | null>(null);

const STYLES: Record<ToastKind, { icon: typeof Info; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2, ring: "border-success/30", iconColor: "text-success" },
  error: { icon: AlertCircle, ring: "border-danger/30", iconColor: "text-danger" },
  info: { icon: Info, ring: "border-info/30", iconColor: "text-info" },
};

/** Success/failure feedback after an action. Errors stay until dismissed; others clear themselves. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random();
      setItems((all) => [...all.slice(-3), { id, kind, message }]);
      if (kind !== "error") setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="no-print pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => {
          const { icon: Icon, ring, iconColor } = STYLES[t.kind];
          return (
            <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={`pointer-events-auto flex animate-slide-up items-start gap-3 rounded-lg border bg-surface p-4 shadow-popover ${ring}`}>
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
              <p className="flex-1 text-sm text-text-primary">{t.message}</p>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return {
    success: (message: string) => ctx.toast("success", message),
    error: (message: string) => ctx.toast("error", message),
    info: (message: string) => ctx.toast("info", message),
  };
}
