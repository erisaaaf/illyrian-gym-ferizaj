import { ChevronDown, Search } from "lucide-react";

/** Page title block: website-style eyebrow + heavy tracked heading, with the primary action on the right. */
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="heading-display text-3xl text-text-primary">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-text-secondary">{description}</p>}
      </div>
      {action && <div className="flex max-w-full flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div className="relative w-full max-w-xs sm:w-72">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className="h-10 w-full rounded-pill border border-border-strong bg-surface pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted outline-none transition focus:border-ink"
      />
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  label?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label ?? options[0]?.label}
        className="h-10 appearance-none rounded-pill border border-border-strong bg-surface pl-4 pr-9 text-sm font-semibold text-text-primary outline-none transition focus:border-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
    </div>
  );
}

/** A labelled date filter. Value is a `YYYY-MM-DD` string ("" when empty). */
export function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold text-text-muted">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-pill border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary outline-none transition focus:border-ink"
      />
    </label>
  );
}

/** Start/end of a local calendar day as ISO instants, for from/to API filters. */
export const dayStartIso = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
export const dayEndIso = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined);

/** Horizontal filter row used above tables. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>;
}
