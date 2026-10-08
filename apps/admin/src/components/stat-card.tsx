export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number | string | null | undefined;
  hint?: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const toneClass = { neutral: "text-text-primary", warning: "text-warning", danger: "text-danger", success: "text-success" }[tone];
  const empty = value === null || value === undefined;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${empty ? "text-text-muted" : toneClass}`}>{empty ? "—" : value}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

/** A horizontal bar whose width is a real ratio (value / max). Renders nothing misleading when max is 0. */
export function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="font-medium text-text-primary">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-elevated" role="img" aria-label={`${label}: ${value}`}>
        <div className="h-full rounded-full bg-info" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
