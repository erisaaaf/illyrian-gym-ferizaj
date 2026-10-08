import { Spinner } from "./button";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
      <Spinner />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 p-6 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 text-xs font-medium text-danger underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function DataEmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
      <p className="mb-1 text-sm font-medium text-text-primary">{title}</p>
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}
