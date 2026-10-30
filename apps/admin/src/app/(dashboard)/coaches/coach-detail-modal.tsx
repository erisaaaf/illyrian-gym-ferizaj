"use client";

import { useEffect, useState } from "react";
import { api, ApiError, qs } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState } from "../../../components/ui/states";
import { ClassListItem, PaginatedClasses } from "../classes/types";
import { CoachListItem } from "./types";

export function CoachDetailModal({ coach, onClose }: { coach: CoachListItem | null; onClose: () => void }) {
  const [classes, setClasses] = useState<ClassListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coach) return;
    let cancelled = false;
    setClasses(null);
    setError(null);
    api
      .get<PaginatedClasses>(`classes${qs({ coachId: coach.id, pageSize: 20 })}`)
      .then((r) => !cancelled && setClasses(r.data))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "Could not load classes."));
    return () => {
      cancelled = true;
    };
  }, [coach]);

  return (
    <Modal open={coach !== null} onClose={onClose} title="Trainer details" width="max-w-xl">
      {coach && (
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-base font-medium text-text-primary">
              {coach.user.firstName} {coach.user.lastName}
            </p>
            <p className="text-text-secondary">{coach.user.email}</p>
            {coach.user.phone && <p className="text-text-secondary">{coach.user.phone}</p>}
            <div className="mt-2 flex gap-2">
              <Badge variant={coach.isActive ? "success" : "neutral"}>{coach.isActive ? "Active" : "Inactive"}</Badge>
            </div>
          </div>

          {coach.bio && <p className="text-text-secondary">{coach.bio}</p>}

          <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
            <dt className="text-text-muted">Specialties</dt>
            <dd>{coach.specialties.length > 0 ? coach.specialties.join(", ") : "—"}</dd>
            <dt className="text-text-muted">Certifications</dt>
            <dd>{coach.certifications.length > 0 ? coach.certifications.join(", ") : "—"}</dd>
          </dl>

          <div>
            <h3 className="mb-2 font-medium text-text-primary">Assigned classes</h3>
            {error && <ErrorState message={error} />}
            {!error && classes === null && <LoadingState label="Loading classes..." />}
            {classes?.length === 0 && <p className="text-text-muted">No classes assigned yet.</p>}
            {classes && classes.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {classes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-text-primary">{c.title}</p>
                      <p className="text-xs text-text-muted">{new Date(c.startTime).toLocaleString()}</p>
                    </div>
                    <span className="shrink-0 text-xs text-text-secondary">
                      {c.bookedCount}/{c.capacity} · {c.status.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
