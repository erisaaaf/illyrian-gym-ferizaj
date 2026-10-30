import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

/**
 * Data table. Scrolls horizontally inside its card on narrow screens (never overflows the page) and
 * keeps the header visible while the body scrolls vertically when `maxHeight` is set.
 */
export function Table({ children, maxHeight, caption }: { children: React.ReactNode; maxHeight?: string; caption?: string }) {
  return (
    <div className={`card overflow-auto ${maxHeight ?? ""}`}>
      <table className="w-full min-w-max text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 border-b border-border bg-surface-elevated">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  align = "left",
  sort,
  onSort,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  /** Current sort direction for this column, or null if the table is sorted by another column. Omit if not sortable. */
  sort?: "asc" | "desc" | null;
  onSort?: () => void;
}) {
  const base = `whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted ${align === "right" ? "text-right" : ""}`;
  if (!onSort) return <th className={base}>{children}</th>;
  return (
    <th className={base} aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none"}>
      <button type="button" onClick={onSort} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-text-primary">
        {children}
        {sort === "asc" ? <ChevronUp className="h-3 w-3" /> : sort === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3 opacity-50" />}
      </button>
    </th>
  );
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function Tr({ children, onClick, selected }: { children: React.ReactNode; onClick?: () => void; selected?: boolean }) {
  return (
    <tr
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick()) : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`${onClick ? "cursor-pointer hover:bg-surface-elevated focus-visible:bg-surface-elevated" : ""} ${selected ? "bg-accent-muted" : ""}`}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className = "", align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" }) {
  return <td className={`px-4 py-3 align-middle text-text-primary ${align === "right" ? "text-right tabular" : ""} ${className}`}>{children}</td>;
}

export function Pagination({
  page,
  totalPages,
  onChange,
  total,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  total?: number;
}) {
  if (totalPages <= 1 && total === undefined) return null;
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between gap-3 text-sm text-text-secondary">
      <span className="text-xs text-text-muted">{total !== undefined ? `${total} ${total === 1 ? "record" : "records"}` : ""}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            className="inline-flex h-8 items-center gap-1 rounded-pill border border-border-strong bg-surface px-3 text-xs font-semibold transition hover:bg-surface-sunken disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Previous
          </button>
          <span className="tabular text-xs">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
            className="inline-flex h-8 items-center gap-1 rounded-pill border border-border-strong bg-surface px-3 text-xs font-semibold transition hover:bg-surface-sunken disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
