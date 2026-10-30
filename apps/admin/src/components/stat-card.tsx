import { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type Tone = "neutral" | "warning" | "danger" | "success";

/**
 * A headline number. `value` null/undefined renders an em dash (data not loaded or not available) - never a
 * fabricated figure. `trend` is a real comparison computed by the API, shown only when provided.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  trend,
}: {
  label: string;
  value: number | string | null | undefined;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
  trend?: { percent: number | null; label: string };
}) {
  const toneClass = { neutral: "text-text-primary", warning: "text-warning", danger: "text-danger", success: "text-success" }[tone];
  const empty = value === null || value === undefined;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow !text-text-muted">{label}</p>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-accent-muted text-accent-text" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p className={`heading-display tabular mt-3 text-4xl ${empty ? "text-text-muted" : toneClass}`}>{empty ? "—" : value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
        {trend && trend.percent !== null && (
          <span className={`inline-flex items-center gap-0.5 font-bold ${trend.percent >= 0 ? "text-success" : "text-danger"}`}>
            {trend.percent >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
            {Math.abs(trend.percent)}%
          </span>
        )}
        {trend && trend.percent !== null && <span>{trend.label}</span>}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

/** A horizontal bar whose width is a real ratio (value / max). Renders nothing misleading when max is 0. */
export function BarRow({ label, value, max, display }: { label: string; value: number; max: number; display?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-text-secondary">{label}</span>
        <span className="tabular font-bold text-text-primary">{display ?? value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-surface-sunken" role="img" aria-label={`${label}: ${display ?? value}`}>
        <div className="h-full rounded-pill bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
