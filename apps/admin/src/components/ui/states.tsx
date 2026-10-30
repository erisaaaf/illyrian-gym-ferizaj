import { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Spinner } from "./button";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`relative overflow-hidden rounded-md bg-surface-sunken before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent ${className}`} />;
}

/** Placeholder rows with the same footprint as a table, so the page does not jump when data arrives. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden" role="status" aria-label="Loading">
      <div className="border-b border-border bg-surface-elevated px-4 py-3">
        <Skeleton className="h-3 w-40" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? "w-40" : "w-24"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="card p-5" role="status" aria-label="Loading">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-20" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
      <Spinner className="h-4 w-4" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-lg border border-danger/25 bg-danger/5 p-8 text-center">
      <AlertTriangle className="mb-2 h-5 w-5 text-danger" aria-hidden="true" />
      <p className="text-sm font-medium text-danger">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-pill border border-danger/30 px-4 py-1.5 text-xs font-bold text-danger transition hover:bg-danger/10">
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Empty state: says what is missing and, for people who are allowed to fix it, what to do next.
 * Pass `action` only for actions the current user can actually perform.
 */
export function DataEmptyState({ title, message, icon, action }: { title: string; message: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong bg-surface p-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-pill bg-accent-muted text-accent-text" aria-hidden="true">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="font-heading text-base font-extrabold tracking-heading text-text-primary">{title}</p>
      <p className="mt-1 max-w-md text-sm text-text-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
