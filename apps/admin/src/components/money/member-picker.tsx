"use client";

import { useEffect, useState } from "react";
import { api, qs } from "../../lib/api";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { fullName } from "../../lib/format";
import { fieldClass } from "../ui/field";

export interface PickedMember {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
}

/** Search-as-you-type member selector (by name, number, phone or email). */
export function MemberPicker({ value, onChange, label = "Member" }: { value: PickedMember | null; onChange: (m: PickedMember | null) => void; label?: string }) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [results, setResults] = useState<PickedMember[]>([]);

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    api
      .get<{ data: PickedMember[] }>(`admin/members${qs({ search: debounced, pageSize: 6 })}`)
      .then((r) => live && setResults(r.data))
      .catch(() => live && setResults([]));
    return () => {
      live = false;
    };
  }, [debounced]);

  if (value) {
    return (
      <div className="mb-4">
        <p className="mb-1.5 text-xs font-bold text-text-secondary">{label}</p>
        <div className="flex items-center justify-between rounded-md border border-border-strong bg-surface-elevated px-3.5 py-2.5 text-sm">
          <span className="font-semibold">
            {fullName(value)} {value.memberNumber && <span className="ml-1 font-medium text-text-muted">{value.memberNumber}</span>}
          </span>
          <button type="button" onClick={() => onChange(null)} className="text-xs font-bold text-accent-text hover:underline">
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-bold text-text-secondary" htmlFor="member-picker">
        {label} <span className="text-danger" aria-hidden="true">*</span>
      </label>
      <input id="member-picker" className={fieldClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name, member number, phone or email" autoComplete="off" />
      {results.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-md border border-border-strong bg-surface shadow-popover">
          {results.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onChange(m)} className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-surface-elevated">
                <span className="font-semibold">{fullName(m)}</span>
                <span className="text-xs text-text-muted">{m.memberNumber}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {debounced.trim().length >= 2 && results.length === 0 && <p className="mt-1.5 text-xs text-text-muted">No member matches &ldquo;{debounced}&rdquo;.</p>}
    </div>
  );
}
