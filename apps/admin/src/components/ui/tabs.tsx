"use client";

import { KeyboardEvent, ReactNode, useRef } from "react";

export interface TabItem {
  id: string;
  label: string;
  /** Optional small count shown next to the label. */
  count?: number;
  icon?: ReactNode;
}

/** Accessible tab list (arrow keys, roving tabindex). The caller renders the active panel. */
export function Tabs({ items, active, onChange, label }: { items: TabItem[]; active: string; onChange: (id: string) => void; label: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="flex max-w-full gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
      {items.map((t, i) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              selected ? "border-ink text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && <span className="tabular rounded-pill bg-surface-sunken px-2 py-0.5 text-[11px] font-bold text-text-secondary">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: string; children: ReactNode }) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}
